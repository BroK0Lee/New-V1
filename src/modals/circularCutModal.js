import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCylinderGeometryForHole } from '../models/index.js';
import { updateAxesAndLabels, disposeAxes } from '../Tools/axesHelper.js';

let modalScene = null;
let modalCamera = null;
let modalRenderer = null;
let modalControls = null;
let modalCutMesh = null;
let cfg = null;

function initModalScene(config) {
  cfg = config;
  const modalContainer = document.querySelector('.modal-3d-display');
  modalContainer.innerHTML = '';

  modalScene = new THREE.Scene();
  modalScene.background = new THREE.Color(0xf0f0f0);

  const aspect = modalContainer.clientWidth / modalContainer.clientHeight;
  modalCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  modalCamera.position.set(100, 100, 100);
  modalCamera.lookAt(0, 0, 0);

  modalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  modalRenderer.setSize(modalContainer.clientWidth, modalContainer.clientHeight);
  modalRenderer.setPixelRatio(window.devicePixelRatio);
  modalRenderer.shadowMap.enabled = true;
  modalRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  modalRenderer.outputColorSpace = THREE.SRGBColorSpace;

  modalContainer.appendChild(modalRenderer.domElement);

  modalControls = new OrbitControls(modalCamera, modalRenderer.domElement);
  modalControls.enableDamping = true;
  modalControls.dampingFactor = 0.05;
  modalControls.target.set(0, 0, 0);
  modalControls.minDistance = 30;
  modalControls.maxDistance = 300;

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

  // Création de la géométrie du cylindre
  const cutGeometry = createCylinderGeometryForHole({
    radius: cutRadius,
    depth: cutDepth,
    segments: 32
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

  // Mise à jour des axes selon les dimensions du cylindre
  const cylinderConfig = {
    length: cutDiameter,
    width: cutDiameter,
    thickness: cutDepth
  };
  updateAxesAndLabels(cylinderConfig, modalScene);

  modalControls.target.set(0, 0, 0);
  modalControls.update();
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
        cutDepthInput.value = 18;
      }
      
      // Mise à jour de l'aperçu si le modal est actif
      if (modalScene) {
        updateModalPreview();
      }
    });
  }

  // Écouteurs pour les changements de paramètres (diamètre et profondeur)
  ['cut-diameter', 'cut-depth'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        if (modalScene) {
          updateModalPreview();
        }
      });
    }
  });

  applyButton.addEventListener('click', () => {
    // TODO: appliquer la découpe au panneau principal
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