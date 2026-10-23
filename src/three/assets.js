import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import urls from "virtual:portfolio-assets";
import { AssetQueue } from "../core/asset-queue.js";

function cloneModel(template) {
  const model = template.clone(true),
    materials = new Map();
  // Geometry and textures are shared; materials belong to their scene fade.
  model.traverse((part) => {
    if (!part.isMesh) return;
    const own = (original) => {
      if (!materials.has(original)) materials.set(original, original.clone());
      return materials.get(original);
    };
    part.material = Array.isArray(part.material)
      ? part.material.map(own)
      : own(part.material);
  });
  return model;
}

export function createAssets(concurrency, onChange) {
  const loader = new GLTFLoader();
  return new AssetQueue({
    concurrency,
    clone: cloneModel,
    onChange,
    load: (source) =>
      new Promise((resolve, reject) => {
        const url = urls[source];
        if (!url) {
          reject(
            new Error(`Model is missing from src/config/assets.js: ${source}`),
          );
          return;
        }
        loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
      }),
  });
}
