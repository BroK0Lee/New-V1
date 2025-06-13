import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPanelGeometry, createCylinderGeometryForHole } from '../models/index.js';
import { materials } from '../materials.js';
import { updateAxesAndLabels, disposeAxes } from '../Tools/axesHelper.js';

let modalScene = null;
let modalCamera = null;
let modalRenderer = null;
let modalControls = null;
let modalPanelMesh = null;
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
  modalCamera.position.set(150, 150, 150);

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
  modalControls.target.set(0, 10, 0);
  modalControls.minDistance = 50;
  modalControls.maxDistance = 500;

  setupModalLighting();
  
  // Ajout des axes avec labels dans le modal
  const previewPanelConfig = {
    length: Math.min(cfg.panel.length * 0.3, 200),
    width: Math.min(cfg.panel.width * 0.3, 100),
    thickness: cfg.panel.thickness
  };
  updateAxesAndLabels(previewPanelConfig, modalScene);
  
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
  if (modalPanelMesh) {
    modalScene.remove(modalPanelMesh);
    modalPanelMesh.geometry.dispose();
    modalPanelMesh.material.dispose();
    modalPanelMesh = null;
  }
  if (modalCutMesh) {
    modalScene.remove(modalCutMesh);
    modalCutMesh.geometry.dispose();
    modalCutMesh.material.dispose();
    modalCutMesh = null;
  }

  const previewPanelConfig = {
    length: Math.min(cfg.panel.length * 0.3, 200),
    width: Math.min(cfg.panel.width * 0.3, 100),
    thickness: cfg.panel.thickness
  };

  const panelGeometry = createPanelGeometry(previewPanelConfig);
  const selectedMaterial = materials[cfg.panel.material] || materials.pine;
  const panelMaterial = new THREE.MeshLambertMaterial({
    color: selectedMaterial.color,
    transparent: true,
    opacity: 0.8
  });

  modalPanelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
  modalPanelMesh.castShadow = true;
  modalPanelMesh.receiveShadow = true;
  modalScene.add(modalPanelMesh);

  const cutRadius = parseFloat(document.getElementById('cut-radius').value) || 25;
  const cutDepth = parseFloat(document.getElementById('cut-depth').value) || 18;
  const cutPositionX = parseFloat(document.getElementById('cut-position-x').value) || 0;
  const cutPositionZ = parseFloat(document.getElementById('cut-position-z').value) || 0;

  const cutGeometry = createCylinderGeometryForHole({
    radius: cutRadius * 0.3,
    depth: cutDepth,
    segments: 32
  });

  const cutMaterial = new THREE.MeshLambertMaterial({
    color: 0xff4444,
    transparent: true,
    opacity: 0.6
  });

  modalCutMesh = new THREE.Mesh(cutGeometry, cutMaterial);
  modalCutMesh.position.set(
    cutPositionX * 0.3,
    previewPanelConfig.thickness / 2,
    cutPositionZ * 0.3
  );
  modalCutMesh.castShadow = true;
  modalScene.add(modalCutMesh);

  modalControls.target.set(0, previewPanelConfig.thickness / 2, 0);
  modalControls.update();
  
  // Mise à jour des axes après changement du modèle
  updateAxesAndLabels(previewPanelConfig, modalScene);
}

function animateModal() {
  if (modalRenderer && modalScene && modalCamera && modalControls) {
    modalControls.update();
    modalRenderer.render(modalScene, modalCamera);
  }
}

function cleanupModalScene() {
  if (modalPanelMesh) {
    modalScene.remove(modalPanelMesh);
    modalPanelMesh.geometry.dispose();
    modalPanelMesh.material.dispose();
    modalPanelMesh = null;
  }

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
  const previewButton = document.getElementById('preview-cut');
  const applyButton = document.getElementById('apply-cut');

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

  ['cut-radius','cut-depth','cut-position-x','cut-position-z'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        if (modalScene) {
          updateModalPreview();
        }
      });
    }
  });

  previewButton.addEventListener('click', () => {
    if (modalScene) {
      updateModalPreview();
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