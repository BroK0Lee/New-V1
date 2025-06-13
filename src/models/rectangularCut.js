/**
 * Module pour la création de géométries de découpe rectangulaire
 * Génère des boîtes paramétrables pour les opérations de soustraction CSG
 */

import * as THREE from 'three';

/**
 * Crée une géométrie rectangulaire pour découpe
 * @param {Object} params - Paramètres de la découpe rectangulaire
 * @param {number} params.length - Longueur de la découpe (axe X)
 * @param {number} params.width - Largeur de la découpe (axe Z)
 * @param {number} params.depth - Profondeur de la découpe (axe Y)
 * @returns {THREE.BoxGeometry} Géométrie de la découpe rectangulaire
 */
export function createBoxGeometryForRectangularCut(params) {
  const { 
    length = 50, 
    width = 30, 
    depth = 20 
  } = params;
  
  // Validation des paramètres
  if (length <= 0 || width <= 0 || depth <= 0) {
    console.warn('Les dimensions de la découpe doivent être positives');
    return new THREE.BoxGeometry(50, 20, 30);
  }
  
  // Création de la géométrie BoxGeometry pour la découpe
  // Paramètres: longueur (X), profondeur/hauteur (Y), largeur (Z)
  const geometry = new THREE.BoxGeometry(length, depth, width);
  
  // Optimisation pour les opérations CSG
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  return geometry;
}