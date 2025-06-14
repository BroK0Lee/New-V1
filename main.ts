/**
 * Script principal pour la bibliothèque de géométries 3D
 * Initialise Three.js, gère le rendu et les opérations CSG
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createPanelGeometry } from './src/models/index.js';
import { materials, constraints } from './src/materials.js';
import { defaultConfig } from './src/config.js';
import {
  initCircularCutModal,
  animateModal,
  getModalCamera,
  getModalRenderer
} from './src/modals/circularCutModal.js';
import { CSGManager } from './src/csg/CSGManager.ts';
import {
  updateGrid,
  toggleGrid as toggleGridHelper,
  updateGridSettings as updateGridSettingsHelper,
  calculateOptimalGridSize,
  disposeGrid
} from './src/Tools/grid.js';
import {
  updateAxes,
  updateAxisLabels,
  updateAxesAndLabels,
  disposeAxes
} from './src/Tools/axesHelper.js';
import {
  initViewCube,
  animateViewCube,
  resizeViewCube,
  updatePanelConfig,
  disposeViewCube
} from './src/Tools/viewCube.js';
import {
  initCamera,
  updateCameraForPanel,
  updateCameraControls,
  resizeCamera,
  setControlsCanvas,
  getCamera,
  getControls,
  disposeCamera
} from './src/Tools/cameraManager.js';

// Variables globales pour la scène Three.js
let scene, camera, renderer, controls, labelRenderer;
let currentPanelMesh = null;

// Variables du modal gérées dans src/modals/circularCutModal.js

// Configuration du panneau principal et des découpes - importée depuis src/config.js
const config = { ...defaultConfig };

/**
 * Valide les dimensions du panneau selon les contraintes
 * @param {number} length - Longueur
 * @param {number} width - Largeur
 * @param {number} thickness - Épaisseur
 * @param {string} material - Matériau
 * @returns {Object} Résultat de validation avec erreurs éventuelles
 */
function validatePanelDimensions(length, width, thickness, material) {
  const errors = [];
  
  // Validation de la longueur
  if (length < constraints.panel.length.min || length > constraints.panel.length.max) {
    errors.push(`La longueur doit être entre ${constraints.panel.length.min} et ${constraints.panel.length.max}mm`);
  }
  
  // Validation de la largeur
  if (width < constraints.panel.width.min || width > constraints.panel.width.max) {
    errors.push(`La largeur doit être entre ${constraints.panel.width.min} et ${constraints.panel.width.max}mm`);
  }
  
  // Validation de l'épaisseur selon le matériau
  const availableThicknesses = constraints.panel.thickness[material] || [];
  if (!availableThicknesses.includes(thickness)) {
    errors.push(`Épaisseur ${thickness}mm non disponible pour ${materials[material]?.name || material}. Épaisseurs disponibles: ${availableThicknesses.join(', ')}mm`);
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Met à jour les options d'épaisseur selon le matériau sélectionné
 * @param {string} material - Matériau sélectionné
 */
function updateThicknessOptions(material) {
  const thicknessSelect = document.getElementById('panel-thickness');
  const availableThicknesses = constraints.panel.thickness[material] || [];
  
  // Sauvegarde de la valeur actuelle
  const currentThickness = parseInt(thicknessSelect.value);
  
  // Vider les options existantes
  thicknessSelect.innerHTML = '';
  
  // Ajouter les nouvelles options
  availableThicknesses.forEach(thickness => {
    const option = document.createElement('option');
    option.value = thickness;
    option.textContent = `${thickness}mm`;
    thicknessSelect.appendChild(option);
  });
  
  // Restaurer la valeur si elle est disponible, sinon prendre la première
  if (availableThicknesses.includes(currentThickness)) {
    thicknessSelect.value = currentThickness;
  } else {
    thicknessSelect.value = availableThicknesses[0] || 18;
    config.panel.thickness = parseInt(thicknessSelect.value);
  }
}

/**
 * Initialisation de la scène Three.js
 */
function initThreeJS() {
  // Création de la scène
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  // Récupération du conteneur
  const container = document.getElementById('scene-container');
  
  // Création du renderer
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true 
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  
  // Ajout du canvas au conteneur
  container.appendChild(renderer.domElement);

  // Initialisation de la caméra et des contrôles via le module cameraManager
  const cameraData = initCamera(container, config.panel);
  camera = cameraData.camera;
  controls = cameraData.controls;
  
  // Configuration du canvas pour les contrôles
  setControlsCanvas(renderer.domElement);

  // Renderer pour les labels CSS2D
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // Initialisation du cube de visualisation
  initViewCube(container, camera, controls, config.panel);
  
  // Éclairage de la scène
  setupLighting();
  
  // Axes de référence adaptatifs et leurs labels
  updateAxesAndLabels(config.panel, scene);
}

/**
 * Configuration de l'éclairage de la scène
 */
function setupLighting() {
  // Lumière ambiante douce
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);
  
  // Lumière directionnelle principale
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  scene.add(directionalLight);
  
  // Lumière d'appoint
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-50, 50, -50);
  scene.add(fillLight);
}

/**
 * Wrapper functions pour la grille - utilisent le module grid.js
 */
function toggleGridDisplay(show) {
  toggleGridHelper(show, config.grid, config.panel, scene);
}

function updateGridSettingsWrapper(sizeX, sizeZ, autoSize) {
  updateGridSettingsHelper(sizeX, sizeZ, autoSize, config.grid, config.panel, scene);
}

/**
 * Initialise les contrôles de l'interface utilisateur
 */
function initUIControls() {
  // Récupération des éléments de l'interface
  const lengthInput = document.getElementById('panel-length');
  const widthInput = document.getElementById('panel-width');
  const thicknessSelect = document.getElementById('panel-thickness');
  const materialSelect = document.getElementById('panel-material');
  const updateButton = document.getElementById('update-panel');

  // Synchronisation des valeurs initiales avec la configuration
  lengthInput.value = config.panel.length;
  widthInput.value = config.panel.width;
  materialSelect.value = config.panel.material;
  
  // Mise à jour des options d'épaisseur selon le matériau initial
  updateThicknessOptions(config.panel.material);
  thicknessSelect.value = config.panel.thickness;

  // Fonction de mise à jour du panneau
  function updatePanelFromUI() {
    // Récupération des nouvelles valeurs
    const newLength = parseFloat(lengthInput.value);
    const newWidth = parseFloat(widthInput.value);
    const newThickness = parseInt(thicknessSelect.value);
    const newMaterial = materialSelect.value;

    // Validation des valeurs avec les nouvelles contraintes
    const validation = validatePanelDimensions(newLength, newWidth, newThickness, newMaterial);
    
    if (!validation.isValid) {
      // Affichage des erreurs de validation
      alert('Erreurs de validation:\n' + validation.errors.join('\n'));
      
      // Restauration des valeurs précédentes
      lengthInput.value = config.panel.length;
      widthInput.value = config.panel.width;
      thicknessSelect.value = config.panel.thickness;
      materialSelect.value = config.panel.material;
      return;
    }

    // Mise à jour de la configuration
    config.panel.length = newLength;
    config.panel.width = newWidth;
    config.panel.thickness = newThickness;
    config.panel.material = newMaterial;

    // Mise à jour de la configuration du panneau pour le cube de visualisation
    updatePanelConfig(config.panel);

    // Mise à jour de la caméra selon les nouvelles dimensions via le module cameraManager
    updateCameraForPanel(config.panel);

    // Mise à jour du panneau 3D
    updatePanel3D(config);

    console.log('Panneau mis à jour:', config.panel);
  }

  // Événements
  updateButton.addEventListener('click', updatePanelFromUI);

  // Mise à jour en temps réel avec Enter
  [lengthInput, widthInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        updatePanelFromUI();
      }
    });
  });

  // Gestion du changement de matériau
  materialSelect.addEventListener('change', () => {
    updateThicknessOptions(materialSelect.value);
    updatePanelFromUI();
  });

  // Gestion du changement d'épaisseur
  thicknessSelect.addEventListener('change', updatePanelFromUI);

  // Initialisation des contrôles de grille
  initGridControls();

  // Initialisation des contrôles du modal de découpe circulaire
  initCircularCutModal(config);
}

/**
 * Initialise les contrôles de grille dans l'interface utilisateur
 */
function initGridControls() {
  // Création de la section de contrôle de grille
  const gridSection = document.createElement('div');
  gridSection.className = 'control-section';
  gridSection.innerHTML = `
    <h3>Grille de référence</h3>
    <button id="toggle-grid" class="update-button">Afficher la grille</button>
    
    <div id="grid-controls" style="display: none; margin-top: 15px;">
      <div class="parameter-group">
        <label>
          <input type="checkbox" id="grid-auto-size" ${config.grid.autoSize ? 'checked' : ''}>
          Taille automatique
        </label>
        <small>Ajuste automatiquement la taille selon le modèle</small>
      </div>
      
      <div id="manual-grid-controls" style="${config.grid.autoSize ? 'display: none;' : ''}">
        <div class="parameter-group">
          <label for="grid-size-x">Taille case X (mm):</label>
          <input type="number" id="grid-size-x" value="${config.grid.sizeX}" min="1" max="500" step="1">
        </div>
        
        <div class="parameter-group">
          <label for="grid-size-z">Taille case Z (mm):</label>
          <input type="number" id="grid-size-z" value="${config.grid.sizeZ}" min="1" max="500" step="1">
        </div>
      </div>
      
      <button id="apply-grid-settings" class="update-button" style="margin-top: 10px;">Appliquer</button>
    </div>
  `;
  
  // Insertion après la section des découpes
  const cutsSection = document.querySelector('.control-section:nth-child(2)');
  cutsSection.parentNode.insertBefore(gridSection, cutsSection.nextSibling);
  
  // Événements pour les contrôles de grille
  const toggleGridButton = document.getElementById('toggle-grid');
  const gridAutoSizeCheckbox = document.getElementById('grid-auto-size');
  const manualGridControls = document.getElementById('manual-grid-controls');
  const gridSizeXInput = document.getElementById('grid-size-x');
  const gridSizeZInput = document.getElementById('grid-size-z');
  const applyGridButton = document.getElementById('apply-grid-settings');
  
  // Bouton d'affichage/masquage de la grille
  toggleGridButton.addEventListener('click', () => {
    toggleGridDisplay(!config.grid.show);
  });
  
  // Checkbox pour la taille automatique
  gridAutoSizeCheckbox.addEventListener('change', () => {
    const autoSize = gridAutoSizeCheckbox.checked;
    manualGridControls.style.display = autoSize ? 'none' : 'block';
    
    if (autoSize) {
      // Mise à jour immédiate avec taille automatique
      const optimalSize = calculateOptimalGridSize(config.panel);
      gridSizeXInput.value = optimalSize.sizeX;
      gridSizeZInput.value = optimalSize.sizeZ;
      updateGridSettingsWrapper(optimalSize.sizeX, optimalSize.sizeZ, true);
    }
  });
  
  // Bouton d'application des paramètres
  applyGridButton.addEventListener('click', () => {
    const sizeX = parseInt(gridSizeXInput.value);
    const sizeZ = parseInt(gridSizeZInput.value);
    const autoSize = gridAutoSizeCheckbox.checked;
    
    updateGridSettingsWrapper(sizeX, sizeZ, autoSize);
  });
  
  // Mise à jour en temps réel avec Enter
  [gridSizeXInput, gridSizeZInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyGridButton.click();
      }
    });
  });
}

/**
 * Fonction principale pour mettre à jour le panneau 3D avec les opérations CSG
 * @param {Object} panelConfig - Configuration du panneau et des découpes
 */
function updatePanel3D(panelConfig) {
  // Suppression du mesh existant
  if (currentPanelMesh) {
    scene.remove(currentPanelMesh);
    currentPanelMesh.geometry.dispose();
    if (currentPanelMesh.material) {
      currentPanelMesh.material.dispose();
    }
  }
  
  // Mise à jour de la grille selon les nouvelles dimensions du panneau
  updateGrid(panelConfig.panel, config.grid, scene);
  
  // Mise à jour des axes et leurs labels selon les nouvelles dimensions du panneau
  updateAxesAndLabels(panelConfig.panel, scene);
  
  try {
    currentPanelMesh = CSGManager.applyCuts(panelConfig);
    
    // Ajout à la scène
    scene.add(currentPanelMesh);
    
    console.log('Panneau 3D mis à jour avec succès');
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du panneau 3D:', error);
    
    // Création d'un panneau simple en cas d'erreur
    const fallbackGeometry = createPanelGeometry(panelConfig.panel);
    const fallbackMaterial = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    currentPanelMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    currentPanelMesh.castShadow = true;
    currentPanelMesh.receiveShadow = true;
    scene.add(currentPanelMesh);
  }
}

/**
 * Boucle d'animation principal
 */
function animate() {
  requestAnimationFrame(animate);
  
  // Mise à jour des contrôles de caméra via le module cameraManager
  updateCameraControls();
  
  // Rendu de la scène
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  // Animation du cube de visualisation
  animateViewCube();
  
  // Animation du modal si actif
  animateModal();
}

/**
 * Gestion du redimensionnement de la fenêtre
 */
function handleWindowResize() {
  const container = document.getElementById('scene-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // Redimensionnement de la caméra via le module cameraManager
  resizeCamera(width, height);
  
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);  
  
  // Redimensionnement du cube de visualisation
  resizeViewCube();
  
  // Redimensionnement du renderer du modal si actif
  const modalRenderer = getModalRenderer();
  const modalCamera = getModalCamera();
  if (modalRenderer && modalCamera) {
    const modalContainer = document.querySelector('.modal-3d-display');
    if (modalContainer) {
      modalCamera.aspect = modalContainer.clientWidth / modalContainer.clientHeight;
      modalCamera.updateProjectionMatrix();
      modalRenderer.setSize(modalContainer.clientWidth, modalContainer.clientHeight);
    }
  }
}

/**
 * Initialisation de l'application
 */
function init() {
  // Initialisation de Three.js
  initThreeJS();
  
  // Initialisation des contrôles UI
  initUIControls();
  
  // Création du panneau initial
  updatePanel3D(config);
  
  // Démarrage de l'animation
  animate();
  
  // Gestion du redimensionnement
  window.addEventListener('resize', handleWindowResize);
  
  console.log('Bibliothèque de géométries 3D initialisée');
  console.log('Configuration actuelle:', config);
}

// Attendre que le DOM soit chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export des fonctions utiles pour les futures extensions
window.updatePanel3D = updatePanel3D;
window.config = config;
window.toggleGrid = toggleGridDisplay;
window.updateGridSettings = updateGridSettingsWrapper;
window.getCamera = getCamera;
window.getControls = getControls;