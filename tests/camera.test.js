import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/config/site.js";
import { createCameraRig } from "../src/three/camera.js";

test("camera moves consistently across refresh rates and settles at its destination", () => {
  const positions = [30, 60, 120].map((fps) => {
    const rig = createCameraRig(CONFIG);
    rig.resize(1440, 900);
    for (let i = 0; i < fps; i++) rig.update(1 / fps, 3, false);
    return rig.camera.position.clone();
  });
  assert.ok(positions[0].distanceTo(positions[1]) < 1e-9);
  assert.ok(positions[1].distanceTo(positions[2]) < 1e-9);
  const rig = createCameraRig(CONFIG);
  rig.resize(1440, 900);
  for (let i = 0; i < 600; i++) rig.update(1 / 60, 3, false);
  assert.equal(rig.progress, 3);
  assert.equal(rig.update(1 / 60, 3, false), false);
});

test("responsive camera remains finite at every scene and disables parallax for reduced motion", () => {
  const rig = createCameraRig(CONFIG);
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
  ]) {
    rig.resize(width, height);
    rig.setPointer(0.8, -0.5);
    for (let progress = 0; progress <= 4; progress += 0.1) {
      assert.equal(rig.update(1 / 60, Math.min(4, progress), true), false);
      assert.ok(rig.camera.position.toArray().every(Number.isFinite));
      assert.ok(rig.camera.matrixWorldInverse.elements.every(Number.isFinite));
    }
  }
});
