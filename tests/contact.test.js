import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { CONFIG } from "../src/config/site.js";
import { ASSET_SOURCES } from "../src/config/assets.js";
import { createScene } from "../src/scenes/contact.js";

function harbour(fail = false) {
  return createScene({
    config: CONFIG,
    quality: { mobile: false },
    reducedMotion: () => false,
    changed() {},
    async load(source, onLoad) {
      assert.ok(ASSET_SOURCES.includes(source), `Unbundled model: ${source}`);
      if (fail) throw new Error("Model unavailable");
      const model = new T.Group();
      model.add(
        new T.Mesh(new T.BoxGeometry(2, 1, 5), new T.MeshStandardMaterial()),
      );
      onLoad(model);
      return model;
    },
  });
}

test("harbour motion is independent of refresh rate and stays within the basin", async () => {
  const positions = [];
  for (const fps of [30, 60, 120]) {
    const scene = harbour();
    await scene.ready;
    const tug = scene.group.getObjectByName("boat-tug-a");
    for (let i = 0; i < fps * 40; i++) {
      scene.update({ dt: 1 / fps, reducedMotion: false });
      const { x, z } = tug.position;
      assert.ok(
        (x / (CONFIG.contact.waterWidth / 2 - 0.8)) ** 2 +
          (z / (CONFIG.contact.waterDepth / 2 - 0.8)) ** 2 <
          1,
      );
      assert.ok(tug.rotation.toArray().slice(0, 3).every(Number.isFinite));
    }
    positions.push(tug.position.clone());
  }
  assert.ok(positions[0].distanceTo(positions[1]) < 1e-9);
  assert.ok(positions[1].distanceTo(positions[2]) < 1e-9);
});

test("reduced motion freezes vessels and hoists and hides the wake", async () => {
  const scene = harbour();
  await scene.ready;
  scene.update({ dt: 5, reducedMotion: false });
  scene.update({ dt: 0, reducedMotion: true });
  scene.group.updateMatrixWorld(true);
  const before = [];
  scene.group.traverse((part) => before.push(part.matrixWorld.clone()));
  for (let i = 0; i < 120; i++)
    scene.update({ dt: 1 / 30, reducedMotion: true });
  scene.group.updateMatrixWorld(true);
  let index = 0;
  scene.group.traverse((part) =>
    assert.ok(part.matrixWorld.equals(before[index++])),
  );
  assert.equal(scene.group.getObjectByName("Tug wake").visible, false);
});

test("a failed model load leaves the quay, water and animation usable", async () => {
  const scene = harbour(true);
  const loads = await scene.ready;
  assert.ok(loads.every((result) => result.status === "rejected"));
  assert.ok(scene.group.getObjectByName("Main quay"));
  assert.ok(scene.group.getObjectByName("Animated harbour water"));
  assert.doesNotThrow(() => scene.update({ dt: 1 / 60, reducedMotion: false }));
});
