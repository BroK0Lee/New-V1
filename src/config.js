/**
 * Configuration par défaut du panneau et des paramètres de l'application
 */

export const defaultConfig = {
  panel: {
    length: 1000,   // Longueur en mm (valeur par défaut)
    width: 500,     // Largeur en mm (valeur par défaut)
    thickness: 20,  // Épaisseur en mm (valeur par défaut)
    material: 'pine' // Matériau par défaut
  },
  cuts: [], // Tableau pour les futures découpes (trous, entailles, etc.)
  grid: {
    show: false,           // Grille masquée par défaut
    sizeX: 10,            // Taille des cases en X (mm)
    sizeZ: 10,            // Taille des cases en Z (mm)
    autoSize: true        // Taille automatique selon les dimensions du modèle
  }
};