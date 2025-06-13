/**
 * Module pour la création de géométries de panneau
 * Génère des panneaux rectangulaires paramétrables pour les opérations CSG
 */

import * as THREE from 'three';

/**
 * Crée une géométrie de panneau rectangulaire
 * @param {Object} params - Paramètres du panneau
 * @param {number} params.length - Longueur du panneau (axe X)
 * @param {number} params.width - Largeur du panneau (axe y)  
 * @param {number} params.thickness - Épaisseur du panneau (axe z)
 * @returns {THREE.BoxGeometry} Géométrie du panneau
 */
export function createPanelGeometry(params) {
  const { length = 200, width = 100, thickness = 18 } = params;
  
  // Validation des paramètres
  if (length <= 0 || width <= 0 || thickness <= 0) {
    console.warn('Les dimensions du panneau doivent être positives');
    return new THREE.BoxGeometry(200, 18, 100);
  }
  
  // Création de la géométrie BoxGeometry
  // Paramètres: longueur (X), épaisseur (Z), largeur (Y)
  const geometry = new THREE.BoxGeometry(length, thickness, width);
  
  // Optimisation pour les opérations CSG
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  return geometry;
}