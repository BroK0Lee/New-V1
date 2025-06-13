/**
 * Module de gestion de la caméra et de ses contrôles
 * Encapsule toute la logique de positionnement et de configuration de la caméra
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Variables privées du module
let camera = null;
let controls = null;
let container = null;

/**
 * Calcule la position optimale de la caméra en fonction des dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 * @returns {Object} Position et paramètres de caméra optimaux
 */
export function calculateOptimalCameraSettings(panelConfig) {
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
 * Initialise la caméra et ses contrôles
 * @param {HTMLElement} containerElement - Conteneur pour les contrôles
 * @param {Object} panelConfig - Configuration initiale du panneau
 * @returns {Object} Objet contenant la caméra et les contrôles
 */
export function initCamera(containerElement, panelConfig) {
  container = containerElement;
  
  // Configuration de la caméra perspective avec paramètres adaptatifs
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000); // Augmentation du far plane
  
  // Position initiale de la caméra basée sur la configuration du panneau
  updateCameraForPanel(panelConfig);
  
  // Configuration des contrôles orbit avec paramètres adaptatifs
  const renderer = container.querySelector('canvas');
  if (renderer) {
    controls = new OrbitControls(camera, renderer);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI;
    
    // Les limites de distance seront définies par updateCameraForPanel
    updateCameraForPanel(panelConfig);
  } else {
    console.warn('Renderer canvas non trouvé pour les contrôles de caméra');
  }
  
  console.log('Caméra et contrôles initialisés');
  
  return { camera, controls };
}

/**
 * Met à jour la position et les limites de la caméra selon la configuration du panneau
 * @param {Object} panelConfig - Configuration du panneau
 */
export function updateCameraForPanel(panelConfig) {
  if (!camera) {
    console.warn('Caméra non initialisée');
    return;
  }
  
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
 * Met à jour les contrôles de la caméra (à appeler dans la boucle d'animation)
 */
export function updateCameraControls() {
  if (controls) {
    controls.update();
  }
}

/**
 * Gère le redimensionnement de la caméra
 * @param {number} width - Nouvelle largeur
 * @param {number} height - Nouvelle hauteur
 */
export function resizeCamera(width, height) {
  if (!camera) return;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  console.log(`Caméra redimensionnée: ${width}x${height}`);
}

/**
 * Définit un nouveau canvas pour les contrôles
 * @param {HTMLCanvasElement} canvas - Nouveau canvas
 */
export function setControlsCanvas(canvas) {
  if (controls) {
    controls.dispose();
  }
  
  if (canvas && camera) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI;
    
    console.log('Canvas des contrôles mis à jour');
  }
}

/**
 * Retourne les références actuelles de la caméra et des contrôles
 * @returns {Object} Objet contenant les références
 */
export function getCameraReferences() {
  return {
    camera,
    controls,
    container
  };
}

/**
 * Retourne les paramètres actuels de la caméra
 * @returns {Object} Paramètres de la caméra
 */
export function getCameraSettings() {
  if (!camera || !controls) {
    return null;
  }
  
  return {
    position: camera.position.clone(),
    target: controls.target.clone(),
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
    aspect: camera.aspect,
    fov: camera.fov,
    near: camera.near,
    far: camera.far
  };
}

/**
 * Applique des paramètres de caméra spécifiques
 * @param {Object} settings - Paramètres à appliquer
 */
export function applyCameraSettings(settings) {
  if (!camera || !controls) return;
  
  if (settings.position) {
    camera.position.copy(settings.position);
  }
  
  if (settings.target) {
    controls.target.copy(settings.target);
  }
  
  if (settings.minDistance !== undefined) {
    controls.minDistance = settings.minDistance;
  }
  
  if (settings.maxDistance !== undefined) {
    controls.maxDistance = settings.maxDistance;
  }
  
  if (settings.fov !== undefined) {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
  }
  
  controls.update();
  console.log('Paramètres de caméra appliqués');
}

/**
 * Recentre la caméra sur un point spécifique
 * @param {THREE.Vector3} target - Point cible
 * @param {number} distance - Distance du point (optionnel)
 */
export function focusCamera(target, distance = null) {
  if (!camera || !controls) return;
  
  controls.target.copy(target);
  
  if (distance) {
    const direction = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).add(direction.multiplyScalar(distance));
  }
  
  controls.update();
  console.log(`Caméra recentrée sur: ${target.x.toFixed(1)}, ${target.y.toFixed(1)}, ${target.z.toFixed(1)}`);
}

/**
 * Anime la caméra vers une nouvelle position
 * @param {THREE.Vector3} newPosition - Nouvelle position
 * @param {THREE.Vector3} newTarget - Nouvelle cible
 * @param {number} duration - Durée de l'animation en millisecondes
 */
export function animateCameraTo(newPosition, newTarget, duration = 1000) {
  if (!camera || !controls) return;
  
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Interpolation avec easing
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    
    camera.position.lerpVectors(startPosition, newPosition, eased);
    controls.target.lerpVectors(startTarget, newTarget, eased);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      console.log('Animation de caméra terminée');
    }
  }
  
  animate();
}

/**
 * Nettoie les ressources de la caméra et des contrôles
 */
export function disposeCamera() {
  if (controls) {
    controls.dispose();
    controls = null;
    console.log('Contrôles de caméra nettoyés');
  }
  
  camera = null;
  container = null;
  
  console.log('Caméra nettoyée');
}

/**
 * Retourne la caméra (pour compatibilité avec l'ancien code)
 * @returns {THREE.Camera} Caméra actuelle
 */
export function getCamera() {
  return camera;
}

/**
 * Retourne les contrôles (pour compatibilité avec l'ancien code)
 * @returns {OrbitControls} Contrôles actuels
 */
export function getControls() {
  return controls;
}