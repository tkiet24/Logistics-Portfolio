import * as T from "three";
import { createRibbonGeometry } from "./ribbon.js";

export class RailExitCurve extends T.Curve {
  constructor(settings, direction = 1) {
    super();
    this.settings = settings;
    this.direction = direction;
    this.bendLength = (settings.trackBendRadius * Math.PI) / 2;
    this.length = this.bendLength + settings.trackExitLength;
  }
  getPoint(t, target = new T.Vector3()) {
    const {
      trackHalfLength: x,
      railZ: z,
      trackBendRadius: radius,
    } = this.settings;
    const distance = t * this.length;
    if (distance < this.bendLength) {
      const angle = distance / radius;
      return target.set(
        this.direction * (x + radius * Math.sin(angle)),
        0,
        z - radius * (1 - Math.cos(angle)),
      );
    }
    return target.set(
      this.direction * (x + radius),
      0,
      z - radius - (distance - this.bendLength),
    );
  }
}

/** Bend copies of the real track mesh so rails and sleepers join the straight run. */
export function createRailExit(
  track,
  settings,
  gravelMaterial,
  lowDetail,
  direction = 1,
) {
  const group = new T.Group();
  group.name =
    direction === 1
      ? "Railway bend into the horizon"
      : "Railway entrance from the horizon";
  const curve = new RailExitCurve(settings, direction);
  const length = curve.length;
  track.updateWorldMatrix(true, true);
  const bounds = new T.Box3().setFromObject(track);
  const sourceLength = bounds.max.x - bounds.min.x;
  const count = Math.ceil(length / sourceLength);
  const step = length / count;
  const materials = new Map();
  function fadeIntoDistance(source) {
    if (materials.has(source)) return materials.get(source);
    const material = source.clone();
    material.transparent = true;
    material.depthWrite = false;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying float railDepth;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nrailDepth = -position.z;",
      );
      shader.fragmentShader =
        "varying float railDepth;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.a *= 1.0 - smoothstep(${(settings.trackBendRadius + settings.trackExitLength - settings.railZ - 9).toFixed(4)}, ${(settings.trackBendRadius + settings.trackExitLength - settings.railZ).toFixed(4)}, railDepth);`,
      );
    };
    material.customProgramCacheKey = () => `rail-depth-${length}`;
    materials.set(source, material);
    return material;
  }
  const bed = new T.Mesh(
    createRibbonGeometry(curve, 1.6, lowDetail ? 64 : 100, 0.01),
    fadeIntoDistance(gravelMaterial),
  );
  bed.name = "Curved ballast bed";
  group.add(bed);
  const point = new T.Vector3();
  const tangent = new T.Vector3();
  track.traverse((part) => {
    if (!part.isMesh) return;
    const baked = part.geometry.clone().applyMatrix4(part.matrixWorld);
    for (let i = 0; i < count; i++) {
      const geometry = baked.clone();
      const positions = geometry.attributes.position;
      for (let v = 0; v < positions.count; v++) {
        const distance =
          (i + (positions.getX(v) - bounds.min.x) / sourceLength) * step;
        const t = Math.max(0, Math.min(1, distance / length));
        curve.getPoint(t, point);
        curve.getTangent(t, tangent);
        const lateral = positions.getZ(v);
        positions.setXYZ(
          v,
          point.x - tangent.z * lateral,
          positions.getY(v),
          point.z + tangent.x * lateral,
        );
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(
        geometry,
        Array.isArray(part.material)
          ? part.material.map(fadeIntoDistance)
          : fadeIntoDistance(part.material),
      );
      mesh.name = "Curved track piece";
      group.add(mesh);
    }
    baked.dispose();
  });
  return group;
}
