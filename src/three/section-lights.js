import * as T from "three";
import { latLon } from "./flight.js";
import { createNightFixtures } from "./night-fixtures.js";

const WARM = 0xffc779, COOL = 0x81d9d1, AMBER = 0xf29c59;

// Depth-tested halos complement physical fixtures and illuminated glass.
export function createSectionLights(scene, section, config, { mobile = false } = {}) {
  const root = scene.group, anchors = [];
  const fixtures = createNightFixtures(root);
  const add = (object, position, color = WARM, size = .25, strength = .65, pulse = 0) => {
    if (object) anchors.push({ object, position: new T.Vector3(...position), color, size, strength, pulse });
  };
  const streetLamp = (position, options) => {
    const { object, bulb } = fixtures.pole(root, position, options);
    add(object, bulb, options?.color ?? 0xffe0b0, .38, .65);
    const yaw = options?.yaw ?? 0;
    fixtures.pool(root, [position[0] + .38 * Math.cos(yaw), position[1] + .024,
      position[2] - .38 * Math.sin(yaw)], [2.8, 2.6], { color: options?.color ?? 0xffe0b0 });
  };
  if (section === 0) {
    const globe = root.children[0];
    const cities = [[10.8,106.7],[21,105.8],[13.8,100.5],[1.3,103.8],
      [22.3,114.2],[31.2,121.5],[35.7,139.7],[37.6,127],[19.1,72.9],
      [28.6,77.2],[25.2,55.3],[30,31.2],[41,29],[44.4,8.9],
      [48.9,2.3],[51.5,-.1],[52.5,13.4],[40.4,-3.7],[40.7,-74],
      [34.1,-118.2],[-23.6,-46.6],[-33.9,151.2]];
    cities.forEach(([lat, lon], i) => {
      add(globe, latLon(lat, lon, config.home.earthRadius + .025).toArray(), WARM, .12, .6, .15);
      for (let j = 0; j < (mobile ? 3 : 7); j++) {
        const angle = j * 2.4 + i, radius = .3 + (j % 3) * .28;
        add(globe, latLon(lat + Math.sin(angle) * radius,
          lon + Math.cos(angle) * radius / Math.max(.4, Math.cos(lat * Math.PI / 180)),
          config.home.earthRadius + .027).toArray(), 0xffdca2, .055 + (j % 2) * .02, .38, .1);
      }
    });
  } else if (section === 1) {
    const gantry = root.getObjectByName("Container yard gantry");
    for (let x = -7.4; x <= 3.5; x += 2.7) {
      if (gantry) fixtures.flood(gantry, [x, 5.22, config.port.railZ + .79], { color: 0xe3ebdc });
      add(gantry, [x, 5.19, config.port.railZ + .79], 0xe3ebdc, .4, .62);
      fixtures.pool(root, [x, config.layout.floorY - root.position.y + .025, config.port.railZ + .8], [2.5, 2]);
    }
    for (const x of [-7.4, 3.4]) {
      if (gantry) fixtures.beacon(gantry, [x, 5.82, config.port.railZ]);
      add(gantry, [x, 5.82, config.port.railZ], AMBER, .3, .5, 1);
    }
    add(root.getObjectByName("Gantry trolley and cabin"), [0, -.43, 1.37], COOL, .25, .5);
    fixtures.spot(root, [-2, 5.15, config.port.railZ + .75], [-2, 0, config.port.railZ], 0xe3ebdc);
  } else if (section === 2) {
    for (const [i, container] of scene.pickable.entries()) {
      for (const x of [-1.02, 1.02])
        add(container, [x, .37, .5], i % 2 ? COOL : WARM, .2, .6);
    }
  } else if (section === 3) {
    for (const building of root.children.filter((child) => child.userData.size)) {
      fixtures.building(building);
      const { y } = building.userData.size;
      if (y * building.scale.y > 3) {
        fixtures.beacon(building, [0, y + .04, 0]);
        add(building, [0, y + .07, 0], AMBER, .19, .4, 1);
      }
    }
    const route = new T.CatmullRomCurve3(config.work.route.map((p) => new T.Vector3(...p)));
    for (const t of [.12, .38, .64, .88]) {
      const point = route.getPoint(t), tangent = route.getTangent(t);
      const normal = new T.Vector3(-tangent.z, 0, tangent.x).normalize();
      point.addScaledVector(normal, -config.work.road.width / 2 - .6);
      streetLamp([point.x, config.layout.floorY + .02, point.z], {
        height: 2, yaw: Math.atan2(-normal.z, normal.x),
      });
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
    for (const x of [-3.7, 0, 3.7]) {
      fixtures.pool(root, [x + .22, .303, -2.8], [1.9, 1.6]);
      fixtures.pool(root, [x + .22, .025, -.5], [.45, 2.4], { reflection: true });
    }
    for (const x of [-2.1, 2.1]) {
      fixtures.flood(root, [x, 3.6, -1.6], { color: 0xe3ebdc });
      add(root, [x, 3.57, -1.6], 0xe3ebdc, .4, .55);
    }
    fixtures.spot(root, [.22, 1.83, -3], [.22, .3, -2.2]);
  } else if (section === "factory") {
    root.traverse((part) => {
      if (part.name === "Machine ready indicator") add(part, [0, .6, .6], COOL, .23, .6);
    });
    const f = config.factory;
    for (const x of [1.5, 3.5, 5.5, 7.5, 9.5]) {
      const position = [f.originX + x * f.unit, config.layout.floorY + .18 + (f.wallHeight - .15) * f.unit,
        f.originZ + .32 * f.unit];
      fixtures.flood(root, position, { color: 0xe3ebdc, width: .4 });
      add(root, [position[0], position[1] - .04, position[2]], 0xe3ebdc, .34, .55);
      fixtures.pool(root, [position[0], config.layout.floorY + .19, position[2] + .65], [1.6, 2.1]);
    }
    fixtures.spot(root, [f.originX + 5 * f.unit, config.layout.floorY + .18 + f.wallHeight * f.unit, f.originZ + .4],
      [f.originX + 5 * f.unit, config.layout.floorY + .2, f.originZ + 3 * f.unit], 0xe3ebdc);
  } else if (section === "parking" || section === "city") {
    const { layout } = scene;
    const [width, depth] = layout.size;
    if (section === "parking") {
      // The poles sit in the end curb strips, outside the parking bays and aisle.
      for (const x of [-width / 2 + .22, width / 2 - .22])
        for (const z of [-depth / 2 + .35, depth / 2 - .35])
          streetLamp([x, .045, z], { height: 2.6, color: 0xe3ebdc, yaw: x > 0 ? Math.PI : 0 });
      fixtures.spot(root, [-width / 2 + .6, 2.55, -depth / 2 + .35],
        [-width / 2 + 1.4, 0, -depth / 2 + 1.3], 0xe3ebdc);
    } else {
      for (const x of [-width / 2 + .5, width / 2 - .5])
        for (const z of [-1.65, 1.65]) streetLamp([x, .06, z], { height: 2.15 });
      fixtures.building(root);
    }
  }

  const geometry = new T.BufferGeometry();
  const positions = new T.Float32BufferAttribute(new Float32Array(anchors.length * 3), 3);
  positions.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setAttribute("tint", new T.Float32BufferAttribute(anchors.flatMap((a) => new T.Color(a.color).toArray()), 3));
  geometry.setAttribute("size", new T.Float32BufferAttribute(anchors.map((a) => a.size), 1));
  geometry.setAttribute("strength", new T.Float32BufferAttribute(anchors.map((a) => a.strength), 1));
  geometry.setAttribute("phase", new T.Float32BufferAttribute(anchors.map((_, i) => i * 2.39996), 1));
  geometry.setAttribute("pulse", new T.Float32BufferAttribute(anchors.map((a) => a.pulse), 1));
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
      attribute float pulse;
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
        float shimmer = 1.0 - pulse * (.15 - .15 * sin(time * 1.1 + phase));
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
    fixtures,
    update({ time, reducedMotion, camera, nightMix, opacity = 1, height, pixelRatio }) {
      if (disposed) return;
      uniforms.intensity.value = T.MathUtils.clamp(nightMix, 0, 1) * T.MathUtils.clamp(opacity, 0, 1);
      fixtures.update(T.MathUtils.clamp(nightMix, 0, 1), T.MathUtils.clamp(opacity, 0, 1), time, reducedMotion);
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
      fixtures.dispose();
    },
  };
}
