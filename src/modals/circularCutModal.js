import * as THREE from 'three';
import { createCylinderGeometryForHole } from '../models/index.js';
import { updateAxesAndLabels, disposeAxes } from '../Tools/axesHelper.js';
import { 
  initCamera,
  updateCameraForPanel,
  updateCameraControls,
  resizeCamera,
  setControlsCanvas,
  calculateOptimalCameraSettings,
  getCamera,
  getControls,
  disposeCamera
} from '../Tools/cameraManager.js';

let modalScene = null;
let modalCamera = null;
let modalRenderer = null;
let modalControls = null;
let modalCutMesh = null;
let cfg = null;

// Contraintes pour le modal de découpe circulaire
const CIRCULAR_CUT_CONSTRAINTS = {
  diameter: { min: 1, max: 3000 }, // Diamètre en mm
  depth: { min: 0.2, max: null }   // Profondeur en mm (max = épaisseur du panneau)
};

/**
 * Calcule les paramètres optimaux de caméra pour un cylindre
 * @param {number} diameter - Diamètre du cylindre
 * @param {number} depth - Profondeur du cylindre
 * @returns {Object} Paramètres de caméra optimaux
 */
function calculateOptimalCameraSettingsForCylinder(diameter, depth) {
  // Utilise le diamètre comme dimension principale
  const maxDimension = Math.max(diameter, depth);
  
  // Calcul de la distance optimale
  const distance = Math.max(maxDimension * 2.5, 10); // Facteur plus élevé pour bien voir le cylindre
  
  // Limites adaptatives
  const minDistance = Math.max(maxDimension * 0.1, 1);   // Zoom minimum très proche pour les petits objets
  const maxDistance = Math.max(maxDimension * 10, 100);  // Zoom maximum adaptatif
  
  return {
    distance,
    minDistance,
    maxDistance,
    position: {
      x: distance * 0.7,
      y: distance * 0.7,
      z: distance * 0.7
    }
  };
}

/**
 * Met à jour la caméra du modal selon les dimensions du cylindre
 * @param {number} diameter - Diamètre du cylindre
 * @param {number} depth - Profondeur du cylindre
 */
function updateModalCamera(diameter, depth) {
  if (!modalCamera || !modalControls) return;
  
  const cameraSettings = calculateOptimalCameraSettingsForCylinder(diameter, depth);
  
  // Mise à jour de la position de la caméra
  modalCamera.position.set(
    cameraSettings.position.x,
    cameraSettings.position.y,
    cameraSettings.position.z
  );
  
  // Mise à jour des limites des contrôles
  modalControls.minDistance = cameraSettings.minDistance;
  modalControls.maxDistance = cameraSettings.maxDistance;
  
  // Recentrage sur l'origine
  modalControls.target.set(0, 0, 0);
  modalControls.update();
  
  console.log(`Caméra modal mise à jour - Diamètre: ${diameter}mm, Distance: ${cameraSettings.distance.toFixed(1)}mm, Zoom: ${cameraSettings.minDistance.toFixed(1)}-${cameraSettings.maxDistance.toFixed(1)}mm`);
}

/**
 * Valide les paramètres de la découpe circulaire
 * @param {number} diameter - Diamètre du cylindre
 * @param {number} depth - Profondeur du cylindre
 * @returns {Object} Résultat de validation
 */
function validateCircularCutParameters(diameter, depth) {
  const errors = [];
  
  // Validation du diamètre
  if (diameter < CIRCULAR_CUT_CONSTRAINTS.diameter.min || diameter > CIRCULAR_CUT_CONSTRAINTS.diameter.max) {
    errors.push(`Le diamètre doit être entre ${CIRCULAR_CUT_CONSTRAINTS.diameter.min} et ${CIRCULAR_CUT_CONSTRAINTS.diameter.max}mm`);
  }
  
  // Validation de la profondeur
  if (depth < CIRCULAR_CUT_CONSTRAINTS.depth.min) {
    errors.push(`La profondeur doit être d'au moins ${CIRCULAR_CUT_CONSTRAINTS.depth.min}mm`);
  }
  
  // Validation par rapport à l'épaisseur du panneau
  if (cfg && depth > cfg.panel.thickness) {
    errors.push(`La profondeur ne peut pas dépasser l'épaisseur du panneau (${cfg.panel.thickness}mm)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function initModalScene(config) {
  cfg = config;
  const modalContainer = document.querySelector('.modal-3d-display');
  modalContainer.innerHTML = '';

  modalScene = new THREE.Scene();
  modalScene.background = new THREE.Color(0xf0f0f0);

  const aspect = modalContainer.clientWidth / modalContainer.clientHeight;
  modalCamera = new THREE.PerspectiveCamera(75, aspect, 0.01, 50000); // Near et far planes étendus
  
  modalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  modalRenderer.setSize(modalContainer.clientWidth, modalContainer.clientHeight);
  modalRenderer.setPixelRatio(window.devicePixelRatio);
  modalRenderer.shadowMap.enabled = true;
  modalRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  modalRenderer.outputColorSpace = THREE.SRGBColorSpace;

  modalContainer.appendChild(modalRenderer.domElement);

  // Utilisation des contrôles manuels adaptés au modal
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
  modalControls = new OrbitControls(modalCamera, modalRenderer.domElement);
  modalControls.enableDamping = true;
  modalControls.dampingFactor = 0.05;
  modalControls.target.set(0, 0, 0);
  
  // Les limites seront définies par updateModalCamera
  modalControls.minDistance = 1;
  modalControls.maxDistance = 10000;

  setupModalLighting();
  updateModalPreview();
}

function setupModalLighting() {
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  modalScene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 25);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 200;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  modalScene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-25, 25, -25);
  modalScene.add(fillLight);
}

function updateModalPreview() {
  // Suppression du mesh de découpe existant
  if (modalCutMesh) {
    modalScene.remove(modalCutMesh);
    modalCutMesh.geometry.dispose();
    modalCutMesh.material.dispose();
    modalCutMesh = null;
  }

  // Lecture des paramètres depuis l'interface
  const cutDiameter = parseFloat(document.getElementById('cut-diameter').value) || 50;
  const cutRadius = cutDiameter / 2; // Conversion diamètre -> rayon
  const cutThroughCheckbox = document.getElementById('cut-through');
  const cutDepthInput = document.getElementById('cut-depth');
  
  let cutDepth;
  if (cutThroughCheckbox && cutThroughCheckbox.checked) {
    // Si découpe traversante, utiliser l'épaisseur du panneau
    cutDepth = cfg.panel.thickness;
  } else {
    // Sinon, utiliser la valeur saisie
    cutDepth = parseFloat(cutDepthInput.value) || 18;
  }

  // Validation des paramètres
  const validation = validateCircularCutParameters(cutDiameter, cutDepth);
  if (!validation.isValid) {
    console.warn('Paramètres de découpe invalides:', validation.errors);
    // Afficher les erreurs dans l'interface si nécessaire
  }

  // Création de la géométrie du cylindre
  const cutGeometry = createCylinderGeometryForHole({
    radius: cutRadius,
    depth: cutDepth,
    segments: Math.max(8, Math.min(64, Math.round(cutDiameter / 2))) // Segments adaptatifs selon le diamètre
  });

  const cutMaterial = new THREE.MeshLambertMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.8
  });

  modalCutMesh = new THREE.Mesh(cutGeometry, cutMaterial);
  modalCutMesh.position.set(0, 0, 0); // Centré à l'origine
  modalCutMesh.castShadow = true;
  modalScene.add(modalCutMesh);

  // Mise à jour de la caméra selon les dimensions du cylindre
  updateModalCamera(cutDiameter, cutDepth);

  // Mise à jour des axes selon les dimensions du cylindre
  const cylinderConfig = {
    length: cutDiameter,
    width: cutDiameter,
    thickness: cutDepth
  };
  updateAxesAndLabels(cylinderConfig, modalScene);

  console.log(`Aperçu modal mis à jour - Diamètre: ${cutDiameter}mm, Profondeur: ${cutDepth}mm`);
}

function animateModal() {
  if (modalRenderer && modalScene && modalCamera && modalControls) {
    modalControls.update();
    modalRenderer.render(modalScene, modalCamera);
  }
}

function cleanupModalScene() {
  if (modalCutMesh) {
    modalScene.remove(modalCutMesh);
    modalCutMesh.geometry.dispose();
    modalCutMesh.material.dispose();
    modalCutMesh = null;
  }

  // Nettoyage des axes du modal
  if (modalScene) {
    disposeAxes(modalScene);
  }

  if (modalRenderer) {
    modalRenderer.dispose();
    modalRenderer = null;
  }

  if (modalControls) {
    modalControls.dispose();
    modalControls = null;
  }

  modalScene = null;
  modalCamera = null;
}

function initCircularCutModal(config) {
  cfg = config;
  const openModalButton = document.getElementById('open-circular-cut-modal');
  const closeModalButton = document.getElementById('close-circular-cut-modal');
  const modal = document.getElementById('circular-cut-modal');
  const cancelButton = document.getElementById('cancel-cut');
  const applyButton = document.getElementById('apply-cut');
  const cutThroughCheckbox = document.getElementById('cut-through');
  const cutDepthInput = document.getElementById('cut-depth');
  const cutDiameterInput = document.getElementById('cut-diameter');

  openModalButton.addEventListener('click', () => {
    modal.classList.add('active');
    setTimeout(() => {
      initModalScene(cfg);
    }, 100);
  });

  function closeModal() {
    modal.classList.remove('active');
    cleanupModalScene();
  }

  closeModalButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // Gestion de la case à cocher "Découpe traversante"
  if (cutThroughCheckbox && cutDepthInput) {
    cutThroughCheckbox.addEventListener('change', () => {
      if (cutThroughCheckbox.checked) {
        // Découpe traversante : désactiver l'input de profondeur et utiliser l'épaisseur du panneau
        cutDepthInput.value = cfg.panel.thickness;
        cutDepthInput.disabled = true;
      } else {
        // Découpe normale : réactiver l'input et remettre une valeur par défaut
        cutDepthInput.disabled = false;
        cutDepthInput.value = Math.max(CIRCULAR_CUT_CONSTRAINTS.depth.min, 18);
      }
      
      // Mise à jour de l'aperçu si le modal est actif
      if (modalScene) {
        updateModalPreview();
      }
    });
  }

  // Validation et mise à jour en temps réel pour le diamètre
  if (cutDiameterInput) {
    cutDiameterInput.addEventListener('input', () => {
      const diameter = parseFloat(cutDiameterInput.value);
      
      // Validation et correction automatique
      if (diameter < CIRCULAR_CUT_CONSTRAINTS.diameter.min) {
        cutDiameterInput.value = CIRCULAR_CUT_CONSTRAINTS.diameter.min;
      } else if (diameter > CIRCULAR_CUT_CONSTRAINTS.diameter.max) {
        cutDiameterInput.value = CIRCULAR_CUT_CONSTRAINTS.diameter.max;
      }
      
      if (modalScene) {
        updateModalPreview();
      }
    });
  }

  // Validation et mise à jour en temps réel pour la profondeur
  if (cutDepthInput) {
    cutDepthInput.addEventListener('input', () => {
      const depth = parseFloat(cutDepthInput.value);
      
      // Validation et correction automatique
      if (depth < CIRCULAR_CUT_CONSTRAINTS.depth.min) {
        cutDepthInput.value = CIRCULAR_CUT_CONSTRAINTS.depth.min;
      } else if (cfg && depth > cfg.panel.thickness) {
        cutDepthInput.value = cfg.panel.thickness;
      }
      
      if (modalScene) {
        updateModalPreview();
      }
    });
  }

  applyButton.addEventListener('click', () => {
    // Validation finale avant application
    const diameter = parseFloat(cutDiameterInput.value);
    const depth = parseFloat(cutDepthInput.value);
    const validation = validateCircularCutParameters(diameter, depth);
    
    if (!validation.isValid) {
      alert('Erreurs de validation:\n' + validation.errors.join('\n'));
      return;
    }
    
    // TODO: appliquer la découpe au panneau principal
    console.log('Découpe circulaire validée:', { diameter, depth });
    closeModal();
  });
}

function getModalCamera() {
  return modalCamera;
}

function getModalRenderer() {
  return modalRenderer;
}

export { initCircularCutModal, animateModal, getModalCamera, getModalRenderer };