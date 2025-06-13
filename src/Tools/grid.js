/**
 * Module de gestion de la grille de référence 3D
 * Permet d'afficher une grille adaptative selon les dimensions du panneau
 */

import * as THREE from 'three';

// Variable pour stocker la référence à la grille actuelle
let gridHelper = null;

/**
 * Calcule la taille optimale de la grille selon les dimensions du panneau
 * @param {Object} panelConfig - Configuration du panneau
 * @returns {Object} Configuration de grille optimale
 */
export function calculateOptimalGridSize(panelConfig) {
  const { length, width } = panelConfig;
  const maxDimension = Math.max(length, width);
  
  let sizeX, sizeZ;
  
  // Règles de taille automatique
  if (maxDimension <= 250) {
    // Petits modèles : grille 10x10mm
    sizeX = sizeZ = 10;
  } else if (maxDimension <= 1000) {
    // Modèles moyens : grille 50x50mm
    sizeX = sizeZ = 50;
  } else {
    // Grands modèles : grille 100x100mm
    sizeX = sizeZ = 100;
  }
  
  return { sizeX, sizeZ };
}

/**
 * Met à jour la grille en fonction des dimensions du panneau et de la configuration
 * @param {Object} panelConfig - Configuration du panneau
 * @param {Object} gridConfig - Configuration de la grille
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function updateGrid(panelConfig, gridConfig, scene) {
  // Suppression de l'ancienne grille
  if (gridHelper) {
    scene.remove(gridHelper);
    // Dispose properly of all child geometries and materials
    gridHelper.children.forEach(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        child.material.dispose();
      }
    });
    gridHelper = null;
  }
  
  // Ne créer la grille que si elle doit être affichée
  if (!gridConfig.show) {
    return;
  }
  
  // Calcul de la taille de grille
  let gridSizeX, gridSizeZ;
  
  if (gridConfig.autoSize) {
    const optimalSize = calculateOptimalGridSize(panelConfig);
    gridSizeX = optimalSize.sizeX;
    gridSizeZ = optimalSize.sizeZ;
    
    // Mise à jour de la configuration pour l'interface
    gridConfig.sizeX = gridSizeX;
    gridConfig.sizeZ = gridSizeZ;
  } else {
    gridSizeX = gridConfig.sizeX;
    gridSizeZ = gridConfig.sizeZ;
  }
  
  // Calcul des dimensions totales de la grille
  const totalSizeX = Math.max(panelConfig.length * 1.5, 300);
  const totalSizeZ = Math.max(panelConfig.width * 1.5, 300);
  
  // Calcul du nombre de divisions
  const divisionsX = Math.ceil(totalSizeX / gridSizeX);
  const divisionsZ = Math.ceil(totalSizeZ / gridSizeZ);
  
  // Création de la grille personnalisée
  gridHelper = createCustomGrid(totalSizeX, totalSizeZ, divisionsX, divisionsZ);
  gridHelper.position.set(0, 0, 0); // Grille au niveau du sol
  scene.add(gridHelper);
  
  console.log(`Grille mise à jour - Taille des cases: ${gridSizeX}x${gridSizeZ}mm, Divisions: ${divisionsX}x${divisionsZ}`);
}

/**
 * Crée une grille personnalisée avec des tailles de cases différentes en X et Z
 * @param {number} sizeX - Taille totale en X
 * @param {number} sizeZ - Taille totale en Z
 * @param {number} divisionsX - Nombre de divisions en X
 * @param {number} divisionsZ - Nombre de divisions en Z
 * @returns {THREE.Group} Groupe contenant la grille
 */
export function createCustomGrid(sizeX, sizeZ, divisionsX, divisionsZ) {
  const group = new THREE.Group();
  
  const material = new THREE.LineBasicMaterial({ 
    color: 0xcccccc, 
    transparent: true, 
    opacity: 0.5 
  });
  
  // Lignes parallèles à l'axe X (direction Z)
  for (let i = 0; i <= divisionsZ; i++) {
    const geometry = new THREE.BufferGeometry();
    const z = (i / divisionsZ - 0.5) * sizeZ;
    const points = [
      new THREE.Vector3(-sizeX / 2, 0, z),
      new THREE.Vector3(sizeX / 2, 0, z)
    ];
    geometry.setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }
  
  // Lignes parallèles à l'axe Z (direction X)
  for (let i = 0; i <= divisionsX; i++) {
    const geometry = new THREE.BufferGeometry();
    const x = (i / divisionsX - 0.5) * sizeX;
    const points = [
      new THREE.Vector3(x, 0, -sizeZ / 2),
      new THREE.Vector3(x, 0, sizeZ / 2)
    ];
    geometry.setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }
  
  return group;
}

/**
 * Affiche ou masque la grille
 * @param {boolean} show - État d'affichage de la grille
 * @param {Object} gridConfig - Configuration de la grille
 * @param {Object} panelConfig - Configuration du panneau
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function toggleGrid(show, gridConfig, panelConfig, scene) {
  gridConfig.show = show;
  updateGrid(panelConfig, gridConfig, scene);
  
  // Mise à jour de l'interface
  const gridButton = document.getElementById('toggle-grid');
  const gridControls = document.getElementById('grid-controls');
  
  if (gridButton) {
    gridButton.textContent = show ? 'Masquer la grille' : 'Afficher la grille';
    gridButton.classList.toggle('active', show);
  }
  
  if (gridControls) {
    gridControls.style.display = show ? 'block' : 'none';
  }
  
  console.log(`Grille ${show ? 'affichée' : 'masquée'}`);
}

/**
 * Met à jour les paramètres de la grille
 * @param {number} sizeX - Taille des cases en X
 * @param {number} sizeZ - Taille des cases en Z
 * @param {boolean} autoSize - Mode automatique
 * @param {Object} gridConfig - Configuration de la grille
 * @param {Object} panelConfig - Configuration du panneau
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function updateGridSettings(sizeX, sizeZ, autoSize, gridConfig, panelConfig, scene) {
  gridConfig.sizeX = Math.max(1, sizeX);
  gridConfig.sizeZ = Math.max(1, sizeZ);
  gridConfig.autoSize = autoSize;
  
  // Mise à jour de la grille si elle est affichée
  if (gridConfig.show) {
    updateGrid(panelConfig, gridConfig, scene);
  }
  
  console.log(`Paramètres de grille mis à jour - X: ${gridConfig.sizeX}mm, Z: ${gridConfig.sizeZ}mm, Auto: ${gridConfig.autoSize}`);
}

/**
 * Dispose des ressources de la grille
 * @param {THREE.Scene} scene - Scène Three.js
 */
export function disposeGrid(scene) {
  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.children.forEach(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        child.material.dispose();
      }
    });
    gridHelper = null;
  }
}