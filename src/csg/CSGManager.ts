import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import {
  createPanelGeometry,
  createCylinderGeometryForHole,
  createBoxGeometryForRectangularCut,
} from '../models/index.js';
import { materials } from '../materials.js';

export interface CutConfig {
  type: 'circular' | 'rectangular';
  params: any;
  position?: { x?: number; y?: number; z?: number };
  rotation?: { x?: number; y?: number; z?: number };
}

export interface PanelCSGConfig {
  panel: {
    length: number;
    width: number;
    thickness: number;
    material: string;
  };
  cuts: CutConfig[];
}

export class CSGManager {
  static applyCuts(config: PanelCSGConfig): THREE.Mesh {
    const panelGeometry = createPanelGeometry(config.panel);
    const selectedMaterial = materials[config.panel.material] || materials.pine;
    const panelMaterial = new THREE.MeshLambertMaterial({
      color: selectedMaterial.color,
      transparent: true,
      opacity: 0.9,
    });

    let mainBrush = new Brush(panelGeometry, panelMaterial);
    mainBrush.updateMatrixWorld();

    const evaluator = new Evaluator();

    for (const cut of config.cuts) {
      let cutGeometry: THREE.BufferGeometry | undefined;
      switch (cut.type) {
        case 'circular':
          cutGeometry = createCylinderGeometryForHole(cut.params);
          break;
        case 'rectangular':
          cutGeometry = createBoxGeometryForRectangularCut(cut.params);
          break;
        default:
          console.warn(`Type de découpe non reconnu: ${cut.type}`);
          continue;
      }

      const cutBrush = new Brush(cutGeometry);
      if (cut.position) {
        cutBrush.position.set(
          cut.position.x || 0,
          cut.position.y || 0,
          cut.position.z || 0,
        );
      }
      if (cut.rotation) {
        cutBrush.rotation.set(
          cut.rotation.x || 0,
          cut.rotation.y || 0,
          cut.rotation.z || 0,
        );
      }
      cutBrush.updateMatrixWorld();

      mainBrush = evaluator.evaluate(mainBrush, cutBrush, SUBTRACTION);
    }

    if (mainBrush.geometry) {
      mainBrush.geometry.computeVertexNormals();
    }

    mainBrush.castShadow = true;
    mainBrush.receiveShadow = true;
    return mainBrush as unknown as THREE.Mesh;
  }
}
