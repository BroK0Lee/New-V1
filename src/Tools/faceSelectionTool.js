import * as THREE from 'three';

/**
 * Class handling surface highlighting using vertex colors.
 */
class SurfaceHighlighter {
  constructor() {
    this.originalMaterials = new Map();
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8
    });
  }

  highlightSurface(mesh, faceIndex) {
    this.clearHighlight();

    this.originalMaterials.set(mesh, mesh.material.clone());

    const geometry = mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const colors = new Float32Array(positionAttribute.count * 3);

    const originalColor = mesh.material.color;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = originalColor.r;
      colors[i + 1] = originalColor.g;
      colors[i + 2] = originalColor.b;
    }

    const triangleIndex = Math.floor(faceIndex / 2);
    const faceGroupIndex = Math.floor(triangleIndex / 2);
    const verticesPerFace = 6;
    const startVertexIndex = faceGroupIndex * verticesPerFace;

    for (let i = 0; i < verticesPerFace && (startVertexIndex + i) < positionAttribute.count; i++) {
      const vertexIndex = startVertexIndex + i;
      const colorIndex = vertexIndex * 3;
      if (colorIndex < colors.length) {
        colors[colorIndex] = 1.0;
        colors[colorIndex + 1] = 0.4;
        colors[colorIndex + 2] = 0.0;
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    mesh.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
  }

  clearHighlight() {
    this.originalMaterials.forEach((material, mesh) => {
      mesh.material = material;
      if (mesh.geometry.attributes.color) {
        mesh.geometry.deleteAttribute('color');
      }
    });
    this.originalMaterials.clear();
  }

  dispose() {
    this.clearHighlight();
    this.highlightMaterial.dispose();
  }
}

/**
 * Identify the type of face based on its normal.
 * @param {THREE.Vector3} normal - Face normal
 * @returns {string} Face type name
 */
function identifyFaceType(normal) {
  const threshold = 0.9;
  const n = normal.clone().normalize();

  if (Math.abs(n.x) > threshold) {
    return n.x > 0 ? 'face-droite' : 'face-gauche';
  } else if (Math.abs(n.y) > threshold) {
    return n.y > 0 ? 'face-dessus' : 'face-dessous';
  } else if (Math.abs(n.z) > threshold) {
    return n.z > 0 ? 'face-avant' : 'face-arriere';
  }
  return 'face-inconnue';
}

/**
 * Tool enabling face selection and highlighting on a mesh.
 */
class FaceSelectionTool {
  constructor(container, camera, controls, onSelect = null, onDeselect = null) {
    this.container = container;
    this.camera = camera;
    this.controls = controls;
    this.onSelect = onSelect;
    this.onDeselect = onDeselect;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.highlighter = new SurfaceHighlighter();
    this.mesh = null;
    this.selectedFace = null;

    this._onClick = this._onClick.bind(this);
    this._onMove = this._onMove.bind(this);
  }

  setMesh(mesh) {
    this.mesh = mesh;
  }

  enable() {
    this.container.addEventListener('click', this._onClick, false);
    this.container.addEventListener('mousemove', this._onMove, false);
  }

  disable() {
    this.container.removeEventListener('click', this._onClick, false);
    this.container.removeEventListener('mousemove', this._onMove, false);
    this.deselect();
  }

  _updateMouse(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onClick(event) {
    if (this.controls && this.controls.enabled === false) return;
    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.mesh) {
      const intersects = this.raycaster.intersectObject(this.mesh, false);
      if (intersects.length > 0) {
        this._selectFace(intersects[0]);
      } else {
        this.deselect();
      }
    }
  }

  _onMove(event) {
    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.mesh) {
      const intersects = this.raycaster.intersectObject(this.mesh, false);
      this.container.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    }
  }

  _selectFace(intersection) {
    const faceIndex = intersection.faceIndex;
    const point = intersection.point;
    const normal = intersection.face.normal.clone();
    normal.transformDirection(this.mesh.matrixWorld);
    const faceType = identifyFaceType(normal);

    this.selectedFace = {
      faceIndex,
      point: point.clone(),
      normal: normal.clone(),
      type: faceType,
      mesh: this.mesh
    };

    this.highlighter.highlightSurface(this.mesh, faceIndex);
    if (this.onSelect) {
      this.onSelect(this.selectedFace);
    }
  }

  deselect() {
    this.selectedFace = null;
    this.highlighter.clearHighlight();
    if (this.onDeselect) {
      this.onDeselect();
    }
  }

  getSelectedFace() {
    return this.selectedFace;
  }

  dispose() {
    this.disable();
    this.highlighter.dispose();
  }
}

export { SurfaceHighlighter, FaceSelectionTool, identifyFaceType };
