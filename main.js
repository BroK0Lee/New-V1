/**
 * Script principal pour la bibliothèque de géométries 3D
 * Initialise Three.js, gère le rendu et les opérations CSG
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
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

// Variables globales pour la scène Three.js
let scene, camera, renderer, controls, labelRenderer;
let cubeScene, cubeCamera, cubeRenderer, cubeMesh, cubeObject;
let isDraggingCube = false;
let lastCubePointer = new THREE.Vector2();
let cubeOffsetQuat = new THREE.Quaternion();
let currentPanelMesh = null;
let xLabelObj = null, yLabelObj = null, zLabelObj = null; // Références aux labels des axes
let axesHelper = null; // Référence aux axes pour pouvoir les redimensionner

// Variables du modal gérées dans src/modals/circularCutModal.js

// Configuration du panneau principal et des découpes - importée depuis src/config.js
const config = { ...defaultConfig };

// Définition des matériaux disponibles (déplacée dans src/materials.js)

/**
 * Calcule la position optimale de la caméra en fonction des dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 * @returns {Object} Position et paramètres de caméra optimaux
 */
function calculateOptimalCameraSettings(panelConfig) {
  const { length, width, thickness } = panelConfig;
  
  // Calcul de la diagonale du panneau pour déterminer la distance optimale
  const diagonal = Math.sqrt(length * length + width * width + thickness * thickness);
  
  // Distance de la caméra basée sur la diagonale avec un facteur de sécurité
  const cameraDistance = Math.max(diagonal * 1.5, 300); // Minimum 300 pour les très petits objets
  
  // Limites de zoom adaptatives
  const minDistance = Math.max(diagonal * 0.1, 10);  // Zoom minimum adaptatif
  const maxDistance = Math.max(diagonal * 5, 1000);  // Zoom maximum adaptatif
  
  return {
    distance: cameraDistance,
    minDistance: minDistance,
    maxDistance: maxDistance,
    position: {
      x: cameraDistance * 0.7,
      y: cameraDistance * 0.7,
      z: cameraDistance * 0.7
    }
  };
}

/**
 * Met à jour la position et les limites de la caméra
 * @param {Object} panelConfig - Configuration du panneau
 */
function updateCameraSettings(panelConfig) {
  const cameraSettings = calculateOptimalCameraSettings(panelConfig);
  
  // Mise à jour de la position de la caméra
  camera.position.set(
    cameraSettings.position.x,
    cameraSettings.position.y,
    cameraSettings.position.z
  );
  
  // Mise à jour des limites des contrôles
  if (controls) {
    controls.minDistance = cameraSettings.minDistance;
    controls.maxDistance = cameraSettings.maxDistance;
    
    // Recentrage sur l'objet
    controls.target.set(0, panelConfig.thickness / 2, 0);
    controls.update();
  }
  
  console.log(`Caméra mise à jour - Distance: ${cameraSettings.distance.toFixed(0)}mm, Zoom: ${cameraSettings.minDistance.toFixed(0)}-${cameraSettings.maxDistance.toFixed(0)}mm`);
}

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
  
  // Configuration de la caméra perspective avec paramètres adaptatifs
  const container = document.getElementById('scene-container');
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000); // Augmentation du far plane
  
  // Position initiale de la caméra basée sur la configuration par défaut
  updateCameraSettings(config.panel);
  
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

  // Renderer pour les labels CSS2D
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // Scène et renderer pour le cube de visualisation
  cubeScene = new THREE.Scene();
  cubeCamera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  cubeRenderer = new CSS3DRenderer();
  cubeRenderer.setSize(200, 200);
  cubeRenderer.domElement.id = 'view-cube';
  cubeRenderer.domElement.style.position = 'absolute';
  cubeRenderer.domElement.style.bottom = '10px';
  cubeRenderer.domElement.style.right = '10px';
  cubeRenderer.domElement.style.pointerEvents = 'auto';
  container.appendChild(cubeRenderer.domElement);

 cubeObject = createViewCube(60);
  cubeScene.add(cubeObject);

  cubeRenderer.domElement.addEventListener('click', onCubeFaceClick);
  cubeRenderer.domElement.addEventListener('pointerdown', onCubePointerDown);
  cubeRenderer.domElement.addEventListener('pointermove', onCubePointerMove);
  window.addEventListener('pointerup', onCubePointerUp);
  
  // Configuration des contrôles orbit avec paramètres adaptatifs
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI;
  
  // Les limites de distance seront définies par updateCameraSettings
  updateCameraSettings(config.panel);
  
  // Éclairage de la scène
  setupLighting();
  
  // Axes de référence adaptatifs
  updateAxes(config.panel);

  // Labels des axes adaptatifs
  updateAxisLabels(config.panel);
}

/**
 * Met à jour les axes en fonction des dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 */
function updateAxes(panelConfig) {
  // Suppression des anciens axes
  if (axesHelper) {
    scene.remove(axesHelper);
  }
  
  // Calcul de la taille des axes basée sur les dimensions du panneau
  const maxDimension = Math.max(panelConfig.length, panelConfig.width, panelConfig.thickness);
  const axesSize = Math.max(maxDimension * 0.7, 140); // 70% de la plus grande dimension, minimum 140
  
  // Création des nouveaux axes
  axesHelper = new THREE.AxesHelper(axesSize);
  scene.add(axesHelper);
}

/**
 * Met à jour les labels des axes en fonction des dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 */
function updateAxisLabels(panelConfig) {
  // Suppression des anciens labels
  if (xLabelObj) {
    scene.remove(xLabelObj);
    xLabelObj = null;
  }
  if (yLabelObj) {
    scene.remove(yLabelObj);
    yLabelObj = null;
  }
  if (zLabelObj) {
    scene.remove(zLabelObj);
    zLabelObj = null;
  }
  
  // Calcul des nouvelles positions basées sur les dimensions du panneau
  const xPosition = (panelConfig.length / 2) + 300; // Position X basée sur la longueur + décalage
  const yPosition = (panelConfig.thickness / 2) + 300; // Position Y basée sur l'épaisseur + décalage
  const zPosition = (panelConfig.width / 2) + 500; // Position Z basée sur la largeur + décalage
  
  // Création des nouveaux labels
  xLabelObj = createAxisLabel('X');
  xLabelObj.position.set(xPosition, 0, 0);
  
  yLabelObj = createAxisLabel('Y');
  yLabelObj.position.set(0, yPosition, 0);
  
  zLabelObj = createAxisLabel('Z');
  zLabelObj.position.set(0, 0, zPosition);
  
  // Ajout des labels à la scène
  scene.add(xLabelObj, yLabelObj, zLabelObj);
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
 * Crée un label pour un axe
 * @param {string} text - Texte du label
 * @returns {CSS2DObject}
 */
function createAxisLabel(text) {
  const div = document.createElement('div');
  div.className = 'axis-label';
  div.textContent = text;
  return new CSS2DObject(div);
}

/**
 * Crée le cube de visualisation avec des faces cliquables
 * @param {number} size - Taille du cube
 * @returns {THREE.Object3D}
 */
function createViewCube(size) {
  const cube = new THREE.Object3D();
  const faces = [
    { pos: [size / 2, 0, 0], rot: [0, Math.PI / 2, 0], label: '+X', axis: 'x', dir: 1 },
    { pos: [-size / 2, 0, 0], rot: [0, -Math.PI / 2, 0], label: '-X', axis: 'x', dir: -1 },
    { pos: [0, size / 2, 0], rot: [-Math.PI / 2, 0, 0], label: '+Y', axis: 'y', dir: 1 },
    { pos: [0, -size / 2, 0], rot: [Math.PI / 2, 0, 0], label: '-Y', axis: 'y', dir: -1 },
    { pos: [0, 0, size / 2], rot: [0, 0, 0], label: '+Z', axis: 'z', dir: 1 },
    { pos: [0, 0, -size / 2], rot: [0, Math.PI, 0], label: '-Z', axis: 'z', dir: -1 }
  ];
  for (const f of faces) {
    const div = document.createElement('div');
    div.className = 'cube-face';
    div.textContent = f.label;
    div.dataset.axis = f.axis;
    div.dataset.dir = f.dir;
    const obj = new CSS3DObject(div);
    obj.position.set(...f.pos);
    obj.rotation.set(...f.rot);
    cube.add(obj);
  }
  return cube;
}

/**
 * Gère le clic sur une face du cube de visualisation
 * @param {MouseEvent} event
 */
function onCubeFaceClick(event) {
  if (isDraggingCube) return;
  const axis = event.target.dataset.axis;
  const dir = event.target.dataset.dir ? parseFloat(event.target.dataset.dir) : NaN;
  if (!axis || isNaN(dir)) return;
  
  // Calcul de la distance adaptative basée sur les dimensions du panneau
  const cameraSettings = calculateOptimalCameraSettings(config.panel);
  const distance = cameraSettings.distance;
  
  const pos = new THREE.Vector3();
  pos[axis] = dir * distance;
  camera.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
  camera.lookAt(0, config.panel.thickness / 2, 0);
  controls.update();
  cubeOffsetQuat.identity();
}

function onCubePointerDown(event) {
  isDraggingCube = true;
  lastCubePointer.set(event.clientX, event.clientY);
  event.preventDefault();
}

function onCubePointerMove(event) {
  if (!isDraggingCube) return;
  const deltaX = event.clientX - lastCubePointer.x;
  const deltaY = event.clientY - lastCubePointer.y;
  const speed = 0.01;
  const euler = new THREE.Euler(deltaY * speed, deltaX * speed, 0, 'XYZ');
  const q = new THREE.Quaternion().setFromEuler(euler);
  cubeOffsetQuat.multiply(q);
  lastCubePointer.set(event.clientX, event.clientY);
}

function onCubePointerUp() {
  isDraggingCube = false;
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

    // Mise à jour de la caméra selon les nouvelles dimensions
    updateCameraSettings(config.panel);

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
  
  // Mise à jour des axes selon les nouvelles dimensions du panneau
  updateAxes(panelConfig.panel);
  
  // Mise à jour des labels des axes selon les nouvelles dimensions du panneau
  updateAxisLabels(panelConfig.panel);
  
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
  
  // Mise à jour des contrôles
  controls.update();
  
  // Rendu de la scène
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  cubeObject.quaternion.copy(camera.quaternion).multiply(cubeOffsetQuat);
  cubeCamera.position.copy(camera.position);
  cubeCamera.position.sub(controls.target);
  cubeCamera.position.setLength(100);
  cubeCamera.lookAt(cubeScene.position);
  cubeRenderer.render(cubeScene, cubeCamera);
  
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
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);  
  cubeRenderer.setSize(200, 200);
  
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