import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { CONFIG } from "../src/config/site.js";
import { createFlightCurve, latLon } from "../src/three/flight.js";
import { createFade } from "../src/three/fade.js";
import { paintAircraft } from "../src/three/aircraft-material.js";

test("flight follows the configured endpoints above Earth with smooth climb and distance sampling", () => {
  const curve = createFlightCurve(CONFIG.home),
    radius = CONFIG.home.earthRadius + CONFIG.home.altitude;
  assert.ok(
    curve.getPoint(0).distanceTo(latLon(...CONFIG.home.departure, radius)) <
      1e-10,
  );
  assert.ok(
    curve.getPoint(1).distanceTo(latLon(...CONFIG.home.destination, radius)) <
      1e-10,
  );
  const distances = [];
  let previous = curve.getPointAt(0);
  for (let i = 1; i <= 100; i++) {
    const point = curve.getPointAt(i / 100);
    assert.ok(point.length() >= radius - 1e-10);
    assert.ok(point.length() <= radius + CONFIG.home.cruiseLift + 1e-10);
    distances.push(point.distanceTo(previous));
    previous = point;
  }
  assert.ok(Math.max(...distances) / Math.min(...distances) < 1.002);
  assert.throws(() =>
    createFlightCurve({ ...CONFIG.home, destination: CONFIG.home.departure }),
  );
});

test("scene fade preserves material opacity, late models and animated opacity without repeated traversal", () => {
  const group = new T.Group(),
    material = new T.MeshBasicMaterial({ opacity: 0.6, transparent: true });
  group.add(new T.Mesh(new T.BoxGeometry(), material));
  const fade = createFade(group);
  fade.register();
  fade.update(0.5);
  assert.equal(material.opacity, 0.3);
  fade.motion(material, 0);
  assert.equal(material.opacity, 0);
  fade.motion(material, 0.5);
  assert.equal(material.opacity, 0.15);
  fade.register();
  fade.update(1);
  assert.equal(material.opacity, 0.3);
  const late = new T.MeshBasicMaterial();
  group.add(new T.Mesh(new T.BoxGeometry(), late));
  fade.register();
  fade.update(0.5);
  assert.equal(late.opacity, 0.5);
  assert.equal(late.depthWrite, false);
  group.traverse = () => {
    throw new Error("Unexpected render-time traversal");
  };
  fade.update(1);
  assert.equal(late.opacity, 1);
  assert.equal(late.depthWrite, true);
  fade.update(0);
  assert.equal(group.visible, false);
  fade.update(1);
  assert.equal(group.visible, true);
});

test("aircraft paint replaces dark albedo while keeping the detail mask and normal map", () => {
  const normal = new T.Texture(),
    material = new T.MeshStandardMaterial({ normalMap: normal });
  paintAircraft(material, CONFIG.home);
  assert.equal(material.color.getHex(), CONFIG.home.aircraftColour);
  assert.equal(material.normalMap, normal);
  assert.equal(material.metalnessMap, null);
  assert.equal(material.roughnessMap, null);
  const shader = { fragmentShader: T.ShaderLib.standard.fragmentShader };
  assert.ok(shader.fragmentShader.includes("#include <map_fragment>"));
  material.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes("aircraftPaint"));
  assert.ok(shader.fragmentShader.includes("totalEmissiveRadiance"));
  assert.ok(!shader.fragmentShader.includes("#include <map_fragment>"));
});

test("aircraft parts share pixel coverage and retain occlusion throughout flight and scene fades", () => {
  const group = new T.Group();
  const materials = [
    new T.MeshStandardMaterial(),
    new T.MeshStandardMaterial({ transparent: true, opacity: 0.4 }),
  ];
  for (const material of materials) {
    paintAircraft(material, CONFIG.home);
    group.add(new T.Mesh(new T.BoxGeometry(), material));
  }
  const fade = createFade(group);
  fade.register();
  for (const opacity of [0, 0.2, 0.5, 1]) {
    fade.update(0.6);
    for (const material of materials) fade.motion(material, opacity);
    for (const material of materials) {
      assert.equal(material.userData.ditherOpacity.value, 0.6 * opacity);
      assert.equal(material.transparent, false);
      assert.equal(material.depthWrite, true);
      assert.equal(material.opacity, 1);
    }
  }
  const shaders = materials.map((material) => {
    const shader = { fragmentShader: T.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    assert.equal(
      shader.uniforms.aircraftOpacity,
      material.userData.ditherOpacity,
    );
    return shader.fragmentShader;
  });
  assert.equal(shaders[0], shaders[1]);
  assert.match(shaders[0], /gl_FragCoord/);
});
