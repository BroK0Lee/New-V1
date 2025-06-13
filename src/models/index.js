/**
 * Point d'entrée pour tous les modules de géométrie
 * Exporte toutes les fonctions de création de géométries 3D paramétrables
 */

export { createPanelGeometry } from './panel.js';
export { createCylinderGeometryForHole } from './circularCut.js';
export { createBoxGeometryForRectangularCut } from './rectangularCut.js';