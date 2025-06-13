# 3D Panel Configurator

This project is a simple 3D panel configurator built with **Three.js** and **three-bvh-csg**. It allows users to define a wooden panel, apply various cuts (circular or rectangular) and preview the result directly in WebGL.

## Setup

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal to view the configurator.

## Major dependencies

- [Three.js](https://threejs.org/) – rendering engine
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) – accelerated CSG operations
- [Vite](https://vitejs.dev/) – development server and bundler

The codebase also targets TypeScript, and future versions will integrate React and Zustand for state management.
