import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createVisibility } from "../src/three/visibility.js";
import { createCameraRig } from "../src/three/camera.js";
import { CONFIG } from "../src/config/site.js";

test("cached scene bounds exclude offscreen neighbors and refresh after async additions", () => {
  const group = new T.Group(),
    world = new T.Scene();
  world.autoUpdate = false;
  group.add(new T.Mesh(new T.BoxGeometry(2, 2, 2)));
  world.add(group);
  const visibility = createVisibility(group),
    camera = new T.PerspectiveCamera(50, 1, 0.1, 300);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  assert.equal(visibility.intersects(frustum), true);
  group.position.x = 40;
  visibility.invalidate();
  assert.equal(visibility.intersects(frustum), false);
  // Without a structural change, no recursive matrix traversal is required.
  const update = group.updateWorldMatrix;
  group.updateWorldMatrix = () => {
    throw new Error("Repeated bounds traversal");
  };
  assert.equal(visibility.intersects(frustum), false);
  group.updateWorldMatrix = update;
  const late = new T.Mesh(new T.BoxGeometry(2, 2, 2));
  late.position.x = -40;
  group.add(late);
  visibility.invalidate();
  assert.equal(visibility.intersects(frustum), true);
});

test("stationary Work framing excludes the animated Contact scene", () => {
  const rig = createCameraRig(CONFIG, 3);
  rig.resize(1440, 900);
  rig.update(1 / 60, 3, true);
  const frustum = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      rig.camera.projectionMatrix,
      rig.camera.matrixWorldInverse,
    ),
  );
  const contact = new T.Group();
  contact.position.x = CONFIG.layout.sceneSpacing * 4;
  contact.add(new T.Mesh(new T.BoxGeometry(5, 5, 5)));
  assert.equal(createVisibility(contact).intersects(frustum), false);
});
