import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { WebGLRenderLists } from "three/src/renderers/webgl/WebGLRenderLists.js";
import { CONFIG } from "../src/config/site.js";
import { SCENERY_SITES } from "../src/config/scenery.js";
import { RailExitCurve } from "../src/three/rail-exit.js";
import {
  createRibbonGeometry,
  createRoad,
  extendRoad,
} from "../src/three/ribbon.js";
import { createFade } from "../src/three/fade.js";

test("Work road and shoulders leave a clear corridor around every logistics scenery item", () => {
  const route = new T.CatmullRomCurve3(
    CONFIG.work.route.map((p) => new T.Vector3(...p)),
  );
  const path = extendRoad(
    route,
    CONFIG.work.road.exitReach,
    CONFIG.work.road.exitDepth,
  );
  const points = Array.from({ length: 2001 }, (_, i) =>
    path.getPoint(i / 2000),
  );
  for (const site of SCENERY_SITES) {
    for (const [, model, x, z, width] of site.items) {
      // Circumscribed footprint also covers rotated square models and stacks.
      const margin = width / Math.SQRT2 + CONFIG.work.road.width / 2 + 0.22;
      const distance = Math.min(
        ...points.map((p) =>
          Math.hypot(
            p.x + CONFIG.layout.sceneSpacing * 3 - site.x - x,
            p.z - site.z - z,
          ),
        ),
      );
      assert.ok(
        distance > margin + 0.3,
        `${site.name}/${model} overlaps the Work road corridor`,
      );
    }
  }
});

test("fading vehicles render over the road at either camera depth during section transitions", () => {
  const scene = new T.Scene();
  const route = new T.CatmullRomCurve3(
    CONFIG.work.route.map((p) => new T.Vector3(...p)),
  );
  const road = createRoad(route, CONFIG.work.road, true);
  const car = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  scene.add(road, car);
  const fade = createFade(scene);
  fade.register();
  const lists = new WebGLRenderLists({ get: () => ({}) });
  const list = lists.get(scene, 0);
  for (const opacity of [1, 0.9, 0.5, 0.22]) {
    fade.update(opacity);
    for (const carDepth of [-0.8, 0.8]) {
      list.init();
      for (const mesh of [...road.children, car]) {
        list.push(
          mesh,
          mesh.geometry,
          mesh.material,
          0,
          mesh === car ? carDepth : 0,
          null,
        );
      }
      list.sort();
      const order = list.transparent.map((item) => item.object);
      assert.ok(
        order.indexOf(road.children[0]) < order.indexOf(road.children[1]),
      );
      if (car.material.transparent) {
        assert.ok(
          order.indexOf(road.children[1]) < order.indexOf(car),
          "Road must not be composited over a fading vehicle",
        );
      } else {
        assert.ok(car.material.depthWrite);
      }
      for (const mesh of road.children) assert.ok(mesh.material.depthTest);
    }
  }
  scene.traverse((part) => {
    part.geometry?.dispose();
    part.material?.dispose();
  });
  lists.dispose();
});

test("road extensions preserve the driving route and join its ends tangentially", () => {
  const route = new T.CatmullRomCurve3(
    CONFIG.work.route.map((point) => new T.Vector3(...point)),
  );
  const path = extendRoad(route);
  assert.equal(path.curves[1], route);
  assert.ok(path.curves[0].getPoint(1).distanceTo(route.getPoint(0)) < 1e-9);
  assert.ok(path.curves[2].getPoint(0).distanceTo(route.getPoint(1)) < 1e-9);
  assert.ok(path.curves[0].getTangent(1).dot(route.getTangent(0)) > 0.999);
  assert.ok(path.curves[2].getTangent(0).dot(route.getTangent(1)) > 0.999);
  assert.ok(path.getPoint(0).z < -20 && path.getPoint(1).z < -20);
  const ribbon = createRibbonGeometry(path, 2.15, 320, -0.08);
  assert.ok(
    Array.from(ribbon.attributes.position.array).every(Number.isFinite),
  );
  for (let i = 0; i < ribbon.attributes.normal.count; i++)
    assert.ok(ribbon.attributes.normal.getY(i) > 0.99);
});

test("railway exit starts at the last straight tile and bends smoothly away from the viewer", () => {
  const curve = new RailExitCurve(CONFIG.port);
  assert.deepEqual(curve.getPoint(0).toArray(), [
    CONFIG.port.trackHalfLength,
    0,
    CONFIG.port.railZ,
  ]);
  assert.ok(curve.getTangent(0).dot(new T.Vector3(1, 0, 0)) > 0.999);
  const join = curve.bendLength / curve.length;
  assert.ok(
    curve.getTangent(join - 0.0001).dot(curve.getTangent(join + 0.0001)) >
      0.999,
  );
  assert.ok(curve.getPoint(1).z < -25);
  assert.ok(curve.getTangent(1).dot(new T.Vector3(0, 0, -1)) > 0.999);
});
