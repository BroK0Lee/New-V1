/**
 * Module de gestion des axes et de leurs labels pour Three.js
 * Permet de créer, mettre à jour et gérer les axes 3D avec labels adaptatifs
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// Variables pour stocker les références aux axes et labels
let axesHelper = null;
let xLabelObj = null, yLabelObj = null, zLabelObj = null;

/**
 * Crée un label CSS2D pour un axe
 * @param {string} text - Texte du label
 * @returns {CSS2DObject} Label CSS2D
 */
export function createAxisLabel(text) {
  const div = document.createElement('div');
  div.className = 'axis-label';
  div.textContent = text;
  return new CSS2DObject(div);
}

/**
 * Met à jour les axes en fonction des dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function updateAxes(panelConfig, scene) {
  // Suppression des anciens axes
  if (axesHelper) {
    scene.remove(axesHelper);
    axesHelper = null;
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
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function updateAxisLabels(panelConfig, scene) {
  // Suppression des anciens labels
  disposeAxisLabels(scene);
  
  // Calcul des nouvelles positions basées sur les dimensions du panneau
  const xPosition = (panelConfig.length / 2) + 300; // Position X basée sur la longueur + décalage
  const yPosition = (panelConfig.thickness / 2) + 800; // Position Y basée sur l'épaisseur + décalage
  const zPosition = (panelConfig.width / 2) + 550; // Position Z basée sur la largeur + décalage
  
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
 * Supprime uniquement les labels des axes de la scène
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function disposeAxisLabels(scene) {
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
}

/**
 * Dispose des ressources des axes et labels
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function disposeAxes(scene) {
  // Suppression des axes
  if (axesHelper) {
    scene.remove(axesHelper);
    axesHelper = null;
  }
  
  // Suppression des labels
  disposeAxisLabels(scene);
}

/**
 * Met à jour les axes et leurs labels en une seule opération
 * @param {Object} panelConfig - Configuration du panneau
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function updateAxesAndLabels(panelConfig, scene) {
  updateAxes(panelConfig, scene);
  updateAxisLabels(panelConfig, scene);
}

/**
 * Retourne les références actuelles aux objets axes et labels
 * @returns {Object} Objet contenant les références aux axes et labels
 */
export function getAxesReferences() {
  return {
    axesHelper,
    xLabelObj,
    yLabelObj,
    zLabelObj
  };
}