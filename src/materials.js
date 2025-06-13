export const materials = {
  pine: { color: 0xdeb887, name: 'Pin' },
  oak: { color: 0x8b4513, name: 'Chêne' },
  birch: { color: 0xf5deb3, name: 'Bouleau' },
  mdf: { color: 0xd2b48c, name: 'MDF' },
  plywood: { color: 0xdaa520, name: 'Contreplaqué' },
  melamine: { color: 0xffffff, name: 'Mélaminé' }
};

// Contraintes de validation
export const constraints = {
  panel: {
    length: { min: 10, max: 2500 },    // Longueur entre 10 et 2500mm
    width: { min: 10, max: 1250 },     // Largeur entre 10 et 1250mm
    thickness: {                       // Épaisseurs disponibles par matériau
      pine: [5, 10, 15, 18, 20],      // Épaisseurs disponibles pour le pin
      oak: [10, 15, 18, 20, 25],      // Épaisseurs pour le chêne
      birch: [5, 10, 15, 18, 20],     // Épaisseurs pour le bouleau
      mdf: [5, 10, 15, 18, 20, 25],   // Épaisseurs pour le MDF
      plywood: [5, 10, 15, 18, 20],   // Épaisseurs pour le contreplaqué
      melamine: [10, 15, 18, 20, 25]  // Épaisseurs pour le mélaminé
    }
  }
};