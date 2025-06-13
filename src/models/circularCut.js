/**
 * Module pour la création de géométries cylindriques
 * Utilisé principalement pour créer des trous circulaires dans les panneaux
 */

import * as THREE from 'three';

/**
 * Crée une géométrie cylindrique pour découpe circulaire
 * @param {Object} params - Paramètres du cylindre
 * @param {number} params.radius - Rayon du cylindre
 * @param {number} params.depth - Profondeur/hauteur du cylindre (axe Y)
 * @param {number} params.segments - Nombre de segments radiaux (qualité)
 * @returns {THREE.CylinderGeometry} Géométrie cylindrique
 */
export function createCylinderGeometryForHole(params) {
  const { 
    radius = 10, 
    depth = 20, 
    segments = 32 
  } = params;
  
  // Validation des paramètres
  if (radius <= 0) {
    console.warn('Le rayon doit être positif');
    return new THREE.CylinderGeometry(10, 10, 20, 32);
  }
  
  if (depth <= 0) {
    console.warn('La profondeur doit être positive');
    return new THREE.CylinderGeometry(radius, radius, 20, segments);
  }
  
  if (segments < 3) {
    console.warn('Le nombre de segments doit être au minimum 3');
    return new THREE.CylinderGeometry(radius, radius, depth, 32);
  }
  
  // Création du cylindre avec rayon constant (trou droit)
  // Paramètres: rayonHaut, rayonBas, hauteur, segments radiaux
  const geometry = new THREE.CylinderGeometry(
    radius,    // Rayon du haut
    radius,    // Rayon du bas (identique pour un cylindre droit)
    depth,     // Hauteur/profondeur
    segments   // Qualité du cylindre
  );
  
  // Optimisation pour les opérations CSG
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  return geometry;
}