/**
 * Module de gestion du cube de visualisation 3D
 * Permet de naviguer dans la scène en cliquant sur les faces du cube
 */

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// Variables privées du module
let cubeScene = null;
let cubeCamera = null;
let cubeRenderer = null;
let cubeObject = null;
let isDraggingCube = false;
let lastCubePointer = new THREE.Vector2();
let cubeOffsetQuat = new THREE.Quaternion();

// Références aux objets externes (passés lors de l'initialisation)
let mainCamera = null;
let mainControls = null;
let panelConfig = null;

/**
 * Calcule la distance optimale de la caméra pour une configuration de panneau donnée
 * @param {Object} config - Configuration du panneau
 * @returns {number} Distance optimale
 */
function calculateOptimalCameraDistance(config) {
  const { length, width, thickness } = config;
  const diagonal = Math.sqrt(length * length + width * width + thickness * thickness);
  return Math.max(diagonal * 1.5, 300);
}

/**
 * Crée le cube de visualisation avec des faces cliquables
 * @param {number} size - Taille du cube
 * @returns {THREE.Object3D} Objet 3D du cube
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
 * @param {MouseEvent} event - Événement de clic
 */
function onCubeFaceClick(event) {
  if (isDraggingCube || !mainCamera || !mainControls || !panelConfig) return;
  
  const axis = event.target.dataset.axis;
  const dir = event.target.dataset.dir ? parseFloat(event.target.dataset.dir) : NaN;
  if (!axis || isNaN(dir)) return;
  
  // Calcul de la distance adaptative basée sur les dimensions du panneau
  const distance = calculateOptimalCameraDistance(panelConfig);
  
  const pos = new THREE.Vector3();
  pos[axis] = dir * distance;
  mainCamera.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
  mainCamera.lookAt(0, panelConfig.thickness / 2, 0);
  mainControls.update();
  cubeOffsetQuat.identity();
}

/**
 * Gère le début du glissement du cube
 * @param {PointerEvent} event - Événement de pointeur
 */
function onCubePointerDown(event) {
  isDraggingCube = true;
  lastCubePointer.set(event.clientX, event.clientY);
  event.preventDefault();
}

/**
 * Gère le mouvement du cube pendant le glissement
 * @param {PointerEvent} event - Événement de pointeur
 */
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

/**
 * Gère la fin du glissement du cube
 */
function onCubePointerUp() {
  isDraggingCube = false;
}

/**
 * Initialise le cube de visualisation
 * @param {HTMLElement} container - Conteneur parent pour le cube
 * @param {THREE.Camera} camera - Caméra principale de la scène
 * @param {Object} controls - Contrôles de la caméra principale
 * @param {Object} config - Configuration du panneau
 * @returns {Object} Objet contenant les références aux éléments du cube
 */
export function initViewCube(container, camera, controls, config) {
  // Stockage des références externes
  mainCamera = camera;
  mainControls = controls;
  panelConfig = config;
  
  // Création de la scène et de la caméra du cube
  cubeScene = new THREE.Scene();
  cubeCamera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  
  // Création du renderer CSS3D
  cubeRenderer = new CSS3DRenderer();
  cubeRenderer.setSize(200, 200);
  cubeRenderer.domElement.id = 'view-cube';
  cubeRenderer.domElement.style.position = 'absolute';
  cubeRenderer.domElement.style.bottom = '10px';
  cubeRenderer.domElement.style.right = '10px';
  cubeRenderer.domElement.style.pointerEvents = 'auto';
  container.appendChild(cubeRenderer.domElement);
  
  // Création et ajout du cube à la scène
  cubeObject = createViewCube(60);
  cubeScene.add(cubeObject);
  
  // Ajout des écouteurs d'événements
  cubeRenderer.domElement.addEventListener('click', onCubeFaceClick);
  cubeRenderer.domElement.addEventListener('pointerdown', onCubePointerDown);
  cubeRenderer.domElement.addEventListener('pointermove', onCubePointerMove);
  window.addEventListener('pointerup', onCubePointerUp);
  
  console.log('Cube de visualisation initialisé');
  
  return {
    scene: cubeScene,
    camera: cubeCamera,
    renderer: cubeRenderer,
    object: cubeObject
  };
}

/**
 * Met à jour la configuration du panneau pour le cube
 * @param {Object} newConfig - Nouvelle configuration du panneau
 */
export function updatePanelConfig(newConfig) {
  panelConfig = newConfig;
}

/**
 * Animation du cube de visualisation (à appeler dans la boucle d'animation principale)
 */
export function animateViewCube() {
  if (!cubeObject || !cubeCamera || !cubeRenderer || !cubeScene || !mainCamera || !mainControls) {
    return;
  }
  
  // Synchronisation de la rotation du cube avec la caméra principale
  cubeObject.quaternion.copy(mainCamera.quaternion).multiply(cubeOffsetQuat);
  
  // Positionnement de la caméra du cube
  cubeCamera.position.copy(mainCamera.position);
  cubeCamera.position.sub(mainControls.target);
  cubeCamera.position.setLength(100);
  cubeCamera.lookAt(cubeScene.position);
  
  // Rendu du cube
  cubeRenderer.render(cubeScene, cubeCamera);
}

/**
 * Redimensionne le cube de visualisation
 */
export function resizeViewCube() {
  if (cubeRenderer) {
    cubeRenderer.setSize(200, 200);
  }
}

/**
 * Nettoie les ressources du cube de visualisation
 */
export function disposeViewCube() {
  // Suppression des écouteurs d'événements
  if (cubeRenderer && cubeRenderer.domElement) {
    cubeRenderer.domElement.removeEventListener('click', onCubeFaceClick);
    cubeRenderer.domElement.removeEventListener('pointerdown', onCubePointerDown);
    cubeRenderer.domElement.removeEventListener('pointermove', onCubePointerMove);
  }
  window.removeEventListener('pointerup', onCubePointerUp);
  
  // Suppression du DOM
  if (cubeRenderer && cubeRenderer.domElement && cubeRenderer.domElement.parentNode) {
    cubeRenderer.domElement.parentNode.removeChild(cubeRenderer.domElement);
  }
  
  // Nettoyage des objets Three.js
  if (cubeRenderer) {
    cubeRenderer.dispose();
    cubeRenderer = null;
  }
  
  // Réinitialisation des variables
  cubeScene = null;
  cubeCamera = null;
  cubeObject = null;
  isDraggingCube = false;
  lastCubePointer.set(0, 0);
  cubeOffsetQuat.identity();
  
  // Suppression des références externes
  mainCamera = null;
  mainControls = null;
  panelConfig = null;
  
  console.log('Cube de visualisation nettoyé');
}

/**
 * Retourne les références aux objets du cube (pour débogage ou accès externe)
 * @returns {Object} Objet contenant les références
 */
export function getViewCubeReferences() {
  return {
    scene: cubeScene,
    camera: cubeCamera,
    renderer: cubeRenderer,
    object: cubeObject,
    isDragging: isDraggingCube
  };
}