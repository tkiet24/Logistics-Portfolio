import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
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

test("desktop Skills containers stay clear of the content card and viewport edges", () => {
  for (const [width, height] of [
    [1920, 1080],
    [1917, 901],
    [1440, 900],
    [1024, 768],
    [861, 900],
  ]) {
    const rig = createCameraRig(CONFIG, 2);
    rig.resize(width, height);
    const cardRight =
      Math.min(88, Math.max(24, width * 0.05)) + Math.min(width * 0.38, 580);
    for (const pointer of [-1, 0, 1]) {
      rig.setPointer(pointer, 0);
      rig.update(10, 2, false);
      for (let active = 0; active < 4; active++) {
        for (let i = 0; i < 4; i++) {
          const container = new T.Mesh(new T.BoxGeometry(2.54, 1.14, 1.14));
          container.position.set(
            CONFIG.layout.sceneSpacing * 2 +
              ((i % 2) - 0.5) * CONFIG.skills.gap,
            (0.5 - Math.floor(i / 2)) * CONFIG.skills.rowGap,
            i === active ? 1.1 : 0,
          );
          container.rotation.y = i === active ? -0.4 : 0;
          container.updateMatrixWorld();
          const box = new T.Box3().setFromObject(container);
          for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z]) {
                const screen = new T.Vector3(x, y, z).project(rig.camera);
                const pixel = ((screen.x + 1) * width) / 2;
                assert.ok(
                  pixel > cardRight + 8,
                  `Card overlap at ${width}px: ${pixel} <= ${cardRight}`,
                );
                assert.ok(
                  pixel < width - 8,
                  `Container clipped at ${width}px: ${pixel}`,
                );
              }
          container.geometry.dispose();
          container.material.dispose();
        }
      }
    }
  }
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
