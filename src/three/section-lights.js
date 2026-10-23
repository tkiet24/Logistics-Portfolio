import * as T from "three";
import { latLon } from "./flight.js";

const WARM = 0xffc779, COOL = 0x81d9d1, AMBER = 0xf29c59;

// One small, depth-tested glow batch per section. No bloom pass or extra lights
// washing out the models; the glow centres follow their actual scene objects.
export function createSectionLights(scene, section, config, { mobile = false } = {}) {
  const root = scene.group, anchors = [];
  const add = (object, position, color = WARM, size = .25, strength = .65) => {
    if (object) anchors.push({ object, position: new T.Vector3(...position), color, size, strength });
  };
  if (section === 0) {
    const globe = root.children[0];
    const cities = [[10.8,106.7],[21,105.8],[13.8,100.5],[1.3,103.8],
      [22.3,114.2],[31.2,121.5],[35.7,139.7],[37.6,127],[19.1,72.9],
      [28.6,77.2],[25.2,55.3],[30,31.2],[41,29],[44.4,8.9],
      [48.9,2.3],[51.5,-.1],[52.5,13.4],[40.4,-3.7],[40.7,-74],
      [34.1,-118.2],[-23.6,-46.6],[-33.9,151.2]];
    cities.forEach(([lat, lon], i) => {
      add(globe, latLon(lat, lon, config.home.earthRadius + .025).toArray(), WARM, .14, .55);
      if (!mobile) add(globe, latLon(lat + .7, lon + 1, config.home.earthRadius + .025).toArray(), i % 3 ? WARM : COOL, .09, .4);
    });
  } else if (section === 1) {
    const gantry = root.getObjectByName("Container yard gantry");
    for (let x = -7.4; x <= 3.5; x += 1.8)
      add(gantry, [x, 5.28, config.port.railZ + .87], WARM, .32);
    for (const x of [-7.4, 3.4])
      add(gantry, [x, 5.82, config.port.railZ], AMBER, .3, .55);
    add(root.getObjectByName("Gantry trolley and cabin"), [0, -.43, 1.37], COOL, .25, .5);
  } else if (section === 2) {
    for (const [i, container] of scene.pickable.entries()) {
      for (const x of [-1.02, 1.02])
        add(container, [x, .37, .5], i % 2 ? COOL : WARM, .2, .6);
    }
  } else if (section === 3) {
    for (const building of root.children.filter((child) => child.userData.size)) {
      const { x, y, z } = building.userData.size;
      // Sparse windows on the front and camera-facing side of each building.
      for (let row = 1; row <= (mobile ? 2 : 3); row++) {
        for (const column of [-.27, .27]) {
          add(building, [x * column, y * row / 4, z / 2 + .025], WARM, .2, .45);
        }
        if (!mobile) add(building, [x / 2 + .025, y * row / 4, z * .12], COOL, .17, .35);
      }
    }
  } else if (section === 4) {
    root.traverse((part) => {
      if (part.name === "Warm quay light") add(part, [0, -.6, 0], WARM, .45, .7);
      if (part.name === "Crane mast") add(part, [0, .6, 0], AMBER, .26, .5);
      if (part.name === "Cabin glass") add(part, [0, 0, .65], COOL, .25, .45);
      if (part.name === "buoy") add(part, [0, .28, 0], COOL, .22, .55);
    });
    for (let x = -4.2; x <= 4.3; x += 1.4)
      add(root, [x, .32, -1.73], WARM, .22, .4);
  } else if (section === "factory") {
    root.traverse((part) => {
      if (part.name === "Machine ready indicator") add(part, [0, .6, .6], COOL, .23, .6);
    });
    const f = config.factory;
    for (const x of [1.5, 3.5, 5.5, 7.5, 9.5])
      add(root, [f.originX + x * f.unit, config.layout.floorY + .18 + (f.wallHeight + .1) * f.unit,
        f.originZ + .32 * f.unit], WARM, .3, .5);
  }

  const geometry = new T.BufferGeometry();
  const positions = new T.Float32BufferAttribute(new Float32Array(anchors.length * 3), 3);
  positions.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setAttribute("tint", new T.Float32BufferAttribute(anchors.flatMap((a) => new T.Color(a.color).toArray()), 3));
  geometry.setAttribute("size", new T.Float32BufferAttribute(anchors.map((a) => a.size), 1));
  geometry.setAttribute("strength", new T.Float32BufferAttribute(anchors.map((a) => a.strength), 1));
  geometry.setAttribute("phase", new T.Float32BufferAttribute(anchors.map((_, i) => i * 2.39996), 1));
  const uniforms = {
    time: { value: 0 }, intensity: { value: 0 },
    focal: { value: 1 }, pixelRatio: { value: 1 },
  };
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false,
    blending: T.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute vec3 tint;
      attribute float size;
      attribute float strength;
      attribute float phase;
      uniform float time;
      uniform float intensity;
      uniform float focal;
      uniform float pixelRatio;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(size * focal / max(.1, -view.z), 2.0 * pixelRatio, 28.0 * pixelRatio);
        float shimmer = .80 + .12 * sin(time * .85 + phase)
                             + .08 * sin(time * 1.31 + phase * 1.7);
        vAlpha = intensity * strength * shimmer;
        vTint = tint;
      }
    `,
    fragmentShader: `
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float core = exp(-r * r * 85.0);
        float halo = .22 * exp(-r * r * 5.5);
        float rays = .045 * exp(-abs(p.x * p.y) * 180.0) * pow(1.0 - r, 3.0);
        float alpha = (core + halo + rays) * (1.0 - smoothstep(.7, 1.0, r));
        gl_FragColor = vec4(vTint, alpha * vAlpha);
      }
    `,
  });
  const points = new T.Points(geometry, material);
  points.name = "Subtle night lights";
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.visible = false;
  root.add(points);
  const inverse = new T.Matrix4(), local = new T.Vector3();
  let disposed = false;
  return {
    points,
    update({ time, reducedMotion, camera, nightMix, opacity = 1, height, pixelRatio }) {
      if (disposed) return;
      uniforms.intensity.value = T.MathUtils.clamp(nightMix, 0, 1) * T.MathUtils.clamp(opacity, 0, 1);
      points.visible = uniforms.intensity.value > .002;
      if (!points.visible) return;
      uniforms.time.value = reducedMotion ? 0 : time;
      uniforms.pixelRatio.value = pixelRatio;
      uniforms.focal.value = height * pixelRatio * camera.projectionMatrix.elements[5] * .5;
      inverse.copy(root.matrixWorld).invert();
      anchors.forEach((anchor, i) => {
        local.copy(anchor.position).applyMatrix4(anchor.object.matrixWorld).applyMatrix4(inverse);
        positions.setXYZ(i, local.x, local.y, local.z);
      });
      positions.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
