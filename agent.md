# Agent Codex – Guide de développement du **configurateur 3D de panneau bois**

> Dernière mise à jour : 13 juin 2025\
> Auteur : ChatGPT (rôle : architecte logiciel / expert Three.js & CSG)

---

## 1. Contexte

Ce projet est un configurateur 3D temps‑réel développé avec **React + Vite + TypeScript + Three.js + three‑bvh‑csg**.\
L’utilisateur peut :

1. définir les **dimensions** de son panneau (L × l × épaisseur) ;
2. ajouter et paramétrer diverses **découpes** (circulaires, rectangulaires, formes libres) ;
3. visualiser le résultat en WebGL puis exporter la configuration (JSON) et un devis PDF.

L’interface doit rester **simple, intuitive et user‑friendly**, compatible desktop et tablette.

### Dépendances principales

| Package            | Rôle                                         | Version cible |
| ------------------ | -------------------------------------------- | ------------- |
| react / react‑dom  | UI déclarative                               | 18.x          |
| vite               | Bundler + HMR                                | 5.x           |
| three              | Moteur 3D                                    | r 168         |
| three‑bvh‑csg      | Opérations CSG accélérées BVH                | ^0.5          |
| zustand            | State global léger                           | ^4.4          |
| @react‑three/fiber | Liaison React/Three (optionnel – à discuter) | ^9.0          |

> **Décision d’architecture** : on conserve une implémentation Three.js « vanilla » (pas de R3F) pour garder un contrôle total sur les meshes et la persistance des BVH. Toutefois, le code est organisé pour qu’un futur portage vers R3F reste possible.

---

## 2. Architecture existante (snapshot New‑V1)

```
src/
  csg/
    circularCut.js     // exemple : différence booléenne pour un trou cylindrique
    rectangularCut.js  // idem pour forme rectangulaire
  models/
    Panel.js           // géométrie du panneau brut (BoxGeometry)
  state/
    useConfigStore.ts  // Zustand store global
  ui/
    Sidebar.tsx        // panneau latéral réactif
    Toolbar.tsx        // barre d’outils (Undo, Redo, Export…)
  three/
    SceneManager.js    // instancie renderer, camera, orbitcontrols
    GridHelper.js      // quadrillage « atelier »
    Selection.js       // raycasting & highlight
  utils/
    validators.js      // règles dimensionnelles / matériaux
  main.js              // (legacy) point d’entrée historique
index.html
```

> **À faire** : terminer la migration de la logique CSG dans `src/csg/` et supprimer les reliquats CSG de `main.js`.

---

## 3. Vision technique

### 3.1 Modèle de données principal

```ts
// src/types.ts
export interface PanelDimensions {
  length: number; // mm
  width: number;  // mm
  thickness: number; // mm
}

export type CutKind = 'circular' | 'rectangular' | 'freeform';

export interface CutParameters {
  // clé dynamique selon kind (radius, width, height, svgPath, …)
  [key: string]: number | string;
}

export interface Cut {
  id: string;
  kind: CutKind;
  params: CutParameters;
  position: THREE.Vector3; // locale au panneau
  rotation: THREE.Euler;
}

export interface Config {
  panel: PanelDimensions;
  materialId: MaterialId;
  cuts: Cut[];
}
```

### 3.2 Modules clés

| Module             | Dossier      | Responsabilité principale                                                                                                       |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **SceneManager**   | `src/three/` | Crée scène, renderer, caméra, lumières, boucle RAF                                                                              |
| **GridHelper**     | `src/three/` | Quadrillage XY (10 × 10 mm) + axes                                                                                              |
| **Selection**      | `src/three/` | Raycaster unique, highlight faces/edges                                                                                         |
| **CSGManager**     | `src/csg/`   | Encapsule trois‑bvh‑csg : • convertit Mesh → MeshBVH• applique opérations booléennes• met à jour la géométrie finale du panneau |
| **CutManager**     | `src/csg/`   | CRUD des découpes, délègue à CSGManager, gère l’historique (Undo/Redo)                                                          |
| **useConfigStore** | `src/state/` | Zustand store contenant `Config` + actions                                                                                      |

---

## 4. three‑bvh‑csg : bonnes pratiques & workflow

three‑bvh‑csg apporte des opérations booléennes **rapides** grâce aux BVH (Bounding Volume Hierarchy). Pour éviter les dégradations de performance :

1. **MeshBVHBuilder** : après chaque changement géométrique majeur, appeler `computeBoundsTree()` puis `disposeBoundsTree()` quand on détruit la géométrie.
2. **Panneau = Mesh unique** : le panneau est stocké dans un **seul** `THREE.Mesh` (BoxGeometry). Toutes les découpes appliquent des **différences** successives pour maintenir une topologie propre.
3. **Batching** : si l’utilisateur ajoute N découpes rapidement, grouper les opérations en un seul lot (→ debounce 200 ms) pour éviter N reconstructions successives.
4. **Workers** (P2) : déplacer les calculs CSG dans un **Web Worker** (voir `three-mesh-bvh` examples) pour ne pas bloquer le thread UI.
5. **Unités** : rester en **millimètres** dans toutes les géométries pour une conversion directe vers CAM/CNC.

### 4.1 Exemple : découpe circulaire (extrait de `src/csg/circularCut.js`)

```js
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { subtract } from 'three-bvh-csg';

THREE.Mesh.prototype.raycast = acceleratedRaycast; // accélération raycast global

export function applyCircularCut(panelMesh, { radius, depth, position }) {
  // 1) Créer la géométrie du cylindre
  const cutterGeom = new THREE.CylinderGeometry(radius, radius, depth, 32);
  cutterGeom.translate(position.x, position.y, position.z);

  // 2) Construire les BVH
  computeBoundsTree(panelMesh.geometry);
  computeBoundsTree(cutterGeom);

  // 3) CSG : panneau – cylindre
  const result = subtract(panelMesh, cutterGeom);

  // 4) Nettoyage
  disposeBoundsTree(panelMesh.geometry);
  disposeBoundsTree(cutterGeom);
  cutterGeom.dispose();

  return result; // Mesh prêt à être affiché
}
```

> **Règle d’or** : **toujours** disposer les géométries/BVH temporaires pour éviter les fuites GPU (memory leak) dans Chrome.

---

## 5. Roadmap technique (révisée)

| Étape    | Description                                                    | Livrables                                                | Priorité |
| -------- | -------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| **P0‑1** | **Extraction **``** & **``                                     | Modules TypeScript + tests unitaires Vitest (mock Three) | 🔥       |
| **P0‑2** | Refactor `main.js` → `SceneManager`, `Selection`, `GridHelper` | `main.js` < 200 lignes                                   | 🔥       |
| **P0‑3** | Mise en place Zustand store + hooks React                      | `useConfigStore.ts` + Provider dans `App.tsx`            | 🔥       |
| **P1**   | Undo/Redo (Zustand middleware)                                 | `historyMiddleware.ts` + raccourcis clavier              | ⚡        |
| **P1**   | Export/Import JSON                                             | `exportConfig`, `importConfig`                           | ⚡        |
| **P2**   | Web Worker CSG                                                 | `csgWorker.ts` + communication postMessage               | 🚀       |
| **P2**   | Mode mobile (responsive + gestures)                            | Media queries + Hammer.js ou pointer events Three.js     | 🚀       |
| **P3**   | Génération DXF/STEP pour atelier                               | `exportDXF.ts` (via @dxf‑writer)                         | 🎯       |

---

## 6. Guidelines de contribution

1. **TypeScript strict** (`noImplicitAny`, `strictNullChecks`).
2. **Formatage** : Prettier, ligne max 100 caractères.
3. **ESLint** Airbnb avec plugin `@typescript-eslint`.
4. **Tests** :
   - Unitaires → Vitest + jsdom pour React + Three.
   - Régression visuelle → `jest-image-snapshot` (capture canvas).
5. **Commits Conventional** : ex `feat(csg): add batch boolean operation`, `fix(ui): grid snapping rounding error`.
6. **PR template** : description, vidéo 10 sec (LICEcap), cases à cocher (lint, tests, perfs).

---

## 7. Principes UX essentiels

- **Feedback temps‑réel** : prévisualisation immédiate lors du drag d’une découpe.
- **Affordance** : curseur différent pour move vs. resize.
- **Accessibilité** :
  - contrastes AA,
  - navigation clavier (tabindex),
  - annonces ARIA pour les actions clés (ex : ajout d’une découpe, erreur de contrainte).
- **Sécurité utilisateur** : validation agressive des dimensions pour éviter un état géométrique impossible (ex : trou hors panneau).

---

## 8. Contraintes & validations

| Paramètre                | Min                | Max                       | Unités | Validation              |
| ------------------------ | ------------------ | ------------------------- | ------ | ----------------------- |
| Longueur (`L`)           | 10                 | 2500                      | mm     | `validateLength()`      |
| Largeur (`W`)            | 10                 | 1250                      | mm     | `validateWidth()`       |
| Épaisseur                | dépend du matériau | —                         | mm     | `validateThickness()`   |
| Profondeur de découpe    | 1                  | Épaisseur                 | mm     | `validateCutDepth()`    |
| Rayon découpe circulaire | 2                  | (min(L,W) / 2) – marge 10 | mm     | `validateCircularCut()` |

Toutes les règles sont centralisées dans `src/utils/validators.ts` et testées (Vitest).

---

## 9. Checklist avant merge (CI)

-

> La CI GitHub Actions exécute Chrome Headless pour mesurer le frame‑time et rejette si > 16 ms sur moyenne 60 ips.

---

## 10. Ressources & lectures

- *three‑mesh‑bvh* : [https://github.com/gkjohnson/three‑mesh‑bvh](https://github.com/gkjohnson/three‑mesh‑bvh)
- *three‑bvh‑csg* : [https://github.com/gkjohnson/three‑bvh‑csg](https://github.com/gkjohnson/three‑bvh‑csg) (doc + exemples)
- *Optimizing Three.js apps* – Bruno Simon, 2024
- *Understanding CSG in WebGL* – MeetVR, 2023
- *React Zustand Patterns* – LogRocket Blog, 2025

---

## 11. Glossaire rapide

| Terme       | Définition                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| **CSG**     | *Constructive Solid Geometry* : opérations booléennes (union, différence, intersection) sur solides 3D |
| **BVH**     | *Bounding Volume Hierarchy* : structure d’accélération pour ray‑tracing/CSG rapides                    |
| **MeshBVH** | Extension `three‑mesh‑bvh` ajoutant le BVH aux `BufferGeometry`                                        |
| **Mesh**    | Un objet 3D composé d’une géométrie et d’un matériau                                                   |

---

> **Prochaine étape (P0‑1)** : implémenter `CSGManager.ts`, migrer la logique issue de `circularCut.js`, écrire les tests Vitest correspondants et soumettre une PR.

