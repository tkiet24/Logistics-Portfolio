import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CONFIG } from "../src/config/site.js";
import { ASSET_SOURCES } from "../src/config/assets.js";
import { SCENERY_SITES } from "../src/config/scenery.js";
import { AssetQueue } from "../src/core/asset-queue.js";
import { distanceStops, nearestStop, shortestAngle } from "../src/core/math.js";
import { createScene as home } from "../src/scenes/home.js";
import { createScene as port } from "../src/scenes/port.js";
import { createScene as skills } from "../src/scenes/skills.js";
import { createScene as work } from "../src/scenes/work.js";
import { createScene as contact } from "../src/scenes/contact.js";
import { createScene as factory } from "../src/scenes/factory.js";
import { createScenery } from "../src/scenes/scenery.js";

const templates = new Map();
const flush = () => new Promise((resolve) => setImmediate(resolve));
const frame = {
  dt: 1 / 60,
  time: 0,
  progress: 3,
  workProgress: 0,
  reducedMotion: false,
};
const close = (actual, expected, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`,
  );

// Parse real geometry, accessors, hierarchy and transforms with GLTFLoader. Replace
// texture-bearing materials only in an in-memory copy: no image decoder, DOM or
// renderer is exercised, so these tests do not validate textures or appearance.
function textureFreeGlb(source) {
  const original = readFileSync(new URL("../" + source, import.meta.url));
  const jsonLength = original.readUInt32LE(12);
  const json = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  json.materials = json.materials?.map(({ name, doubleSided }) => ({
    name,
    doubleSided,
  }));
  for (const key of ["images", "textures", "samplers"]) delete json[key];
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    if (json[key])
      json[key] = json[key].filter(
        (name) =>
          !name.startsWith("KHR_materials_") &&
          name !== "KHR_texture_transform",
      );
  }
  const text = Buffer.from(JSON.stringify(json));
  const paddedLength = Math.ceil(text.length / 4) * 4;
  const remainingChunks = original.subarray(20 + jsonLength);
  const output = Buffer.alloc(20 + paddedLength + remainingChunks.length, 0x20);
  original.copy(output, 0, 0, 12);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  text.copy(output, 20);
  remainingChunks.copy(output, 20 + paddedLength);
  return output.buffer.slice(
    output.byteOffset,
    output.byteOffset + output.byteLength,
  );
}

function template(source) {
  if (!templates.has(source))
    templates.set(
      source,
      new Promise((resolve, reject) => {
        new GLTFLoader().parse(
          textureFreeGlb(source),
          "",
          ({ scene }) => {
            scene.userData.fixtureSource = source;
            resolve(scene);
          },
          reject,
        );
      }),
    );
  return templates.get(source);
}

function fixture(
  createScene,
  { config = structuredClone(CONFIG), mobile = false, fail = [] } = {},
) {
  const gates = [],
    pending = new Set(),
    requests = [],
    models = [],
    errors = [],
    writes = [],
    shadows = [];
  let changes = 0,
    reducedMotion = false;
  const queue = new AssetQueue({
    concurrency: 128,
    load: (source) =>
      new Promise((resolve, reject) =>
        gates.push({
          source,
          release() {
            if (fail.some((name) => source.endsWith("/" + name)))
              reject(new Error("Fixture failure: " + source));
            else resolve(template(source));
          },
        }),
      ),
    clone(original) {
      const model = original.clone(true),
        materials = new Map();
      const own = (material) => {
        if (!materials.has(material)) materials.set(material, material.clone());
        return materials.get(material);
      };
      model.traverse((part) => {
        if (part.isMesh)
          part.material = Array.isArray(part.material)
            ? part.material.map(own)
            : own(part.material);
      });
      models.push(model);
      return model;
    },
  });
  function load(source, options = {}) {
    assert.ok(
      ASSET_SOURCES.includes(source),
      "Scene requested a model outside the allowlist: " + source,
    );
    requests.push({ source, ...options });
    const promise = queue.load(source, options);
    pending.add(promise);
    promise.then(
      () => pending.delete(promise),
      () => pending.delete(promise),
    );
    return promise;
  }
  const shadowGeometry = new T.PlaneGeometry(1, 1);
  const ctx = {
    config,
    quality: { mobile, detail: mobile ? 0.6 : 1 },
    ui: { activeSkill: 0, setWork: (index) => writes.push(index) },
    assets: { load },
    load(source, callback) {
      return load(source)
        .then((model) => {
          callback?.(model);
          ctx.changed();
          return model;
        })
        .catch((error) => {
          ctx.error(error);
          throw error;
        });
    },
    changed() {
      changes++;
    },
    invalidate() {},
    error: (error) => errors.push(error),
    reducedMotion: () => reducedMotion,
    fadeMaterial(material, opacity) {
      material.userData.motionOpacity = opacity;
    },
    cont(colour, text) {
      const material = new T.MeshStandardMaterial({ color: colour });
      const mesh = new T.Mesh(
        new T.BoxGeometry(2.4, 1, 1),
        Array(6).fill(material),
      );
      mesh.userData.fixtureContainer = true;
      mesh.name = text ?? "";
      return mesh;
    },
    shadow(parent, x, z, width, depth, y) {
      const mesh = new T.Mesh(
        shadowGeometry,
        new T.MeshBasicMaterial({ transparent: true }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(width, depth, 1);
      mesh.position.set(x, y, z);
      mesh.userData.sh = true;
      parent.add(mesh);
      shadows.push(mesh);
      return mesh;
    },
    canvasTexture(size, paint) {
      paint(
        { createLinearGradient: () => ({ addColorStop() {} }), fillRect() {} },
        size,
      );
      return new T.Texture();
    },
  };
  const scene = createScene(ctx);
  return {
    scene,
    ctx,
    config,
    requests,
    models,
    errors,
    writes,
    shadows,
    get changes() {
      return changes;
    },
    setReducedMotion(value) {
      reducedMotion = value;
    },
    async releaseCar() {
      await flush();
      const index = gates.findIndex((gate) =>
        gate.source.endsWith("/sedan-sports.glb"),
      );
      assert.ok(index >= 0);
      gates.splice(index, 1)[0].release();
      await flush();
    },
    async settle(reverse = false) {
      for (
        let round = 0;
        pending.size || queue.stats().active || queue.stats().queued;
        round++
      ) {
        assert.ok(round < 500, "Scene loads did not settle");
        await flush();
        const batch = gates.splice(0);
        if (reverse) batch.reverse();
        for (const gate of batch) gate.release();
      }
      await scene.ready;
      await flush();
    },
  };
}

function settleMotion(scene, state = frame) {
  let count = 0;
  while (scene.update(state))
    assert.ok(++count < 2000, "Scene never became idle");
  return count;
}

function modelFor(f, name) {
  return f.models.find((model) =>
    model.userData.fixtureSource.endsWith("/" + name + ".glb"),
  );
}

test(
  "all six scene factories run before and after real assets load on desktop and mobile",
  { timeout: 15000 },
  async (t) => {
    for (const mobile of [false, true])
      for (const [index, name, create] of [
        [0, "Home", home],
        [1, "Port", port],
        [2, "Skills", skills],
        [3, "Work", work],
        [4, "Contact", contact],
        [null, "Factory", factory],
      ])
        await t.test(name + (mobile ? " mobile" : " desktop"), async () => {
          const config = structuredClone(CONFIG);
          config.layout.sceneSpacing = 47;
          const f = fixture(create, { config, mobile });
          assert.ok(f.scene.group.isGroup);
          assert.equal(typeof f.scene.update, "function");
          f.scene.update({ ...frame, progress: index ?? 0 });
          await f.settle();
          assert.deepEqual(f.errors, []);
          f.scene.update({ ...frame, progress: index ?? 0, time: 1 });
          if (index !== null) close(f.scene.group.position.x, index * 47);
          f.scene.group.updateWorldMatrix(true, true);
          f.scene.group.traverse((part) =>
            assert.ok(part.matrixWorld.elements.every(Number.isFinite)),
          );
          if (index === 4) {
            close(f.scene.group.scale.x, config.contact.scale);
            const beans = f.scene.group.children.find((part) => part.isPoints);
            assert.equal(
              beans.geometry.attributes.position.count,
              mobile
                ? config.contact.mobileBeanCount
                : config.contact.beanCount,
            );
          }
        });
  },
);

test("Home normalizes actual Earth and aircraft models using configured dimensions", async () => {
  const config = structuredClone(CONFIG);
  config.home.earthRadius = 2.4;
  config.home.aircraftSize = 1.1;
  config.home.positionY = 2.2;
  const f = fixture(home, { config });
  await f.settle();
  assert.deepEqual(f.errors, []);
  for (const [name, width] of [
    ["earth", config.home.earthRadius * 2],
    ["cargo_plane", config.home.aircraftSize],
  ]) {
    const model = modelFor(f, name),
      source = await template(model.userData.fixtureSource);
    const size = new T.Box3().setFromObject(source).getSize(new T.Vector3());
    close(model.parent.scale.x * Math.max(size.x, size.y, size.z), width);
    const centered = new T.Box3()
      .setFromObject(model.clone(true))
      .getCenter(new T.Vector3());
    assert.ok(centered.length() < 1e-5);
  }
  close(modelFor(f, "earth").parent.parent.position.y, config.home.positionY);
  close(modelFor(f, "cargo_plane").parent.rotation.y, Math.PI);
  f.scene.update({ ...frame, reducedMotion: true });
  const aircraft = modelFor(f, "cargo_plane").parent.parent;
  assert.ok(aircraft.position.length() > config.home.earthRadius);
});

test("Port fits its tracks, seats wagon cargo, preserves source geometry and centers reusable wheel pivots", async () => {
  const source = await template(
    "kits/train-kit/Models/GLB format/train-carriage-flatbed.glb",
  );
  const topology = [];
  source.traverse((part) => {
    if (part.isMesh)
      topology.push([part.geometry, Array.from(part.geometry.index.array)]);
  });
  const f = fixture(port);
  await f.settle();
  assert.deepEqual(f.errors, []);
  assert.ok(
    f.changes > f.models.length,
    "Assembly must register its newly added materials",
  );
  const rig = modelFor(f, "train-locomotive-a").parent.parent;
  const wagons = rig.children.filter((part) =>
    part.getObjectByName("train-carriage-flatbed"),
  );
  assert.equal(wagons.length, f.config.port.wagonCount);
  const pivots = rig.children.filter(
    (part) =>
      part.isGroup &&
      part.children.some(
        (child) => child.isMesh && child.name.includes("wheel"),
      ),
  );
  assert.ok(pivots.length > f.config.port.wagonCount * 4);
  const discs = pivots
    .flatMap((pivot) => pivot.children)
    .filter((disc) => disc.name.endsWith("_disc"));
  assert.ok(
    new Set(discs.map((disc) => disc.geometry)).size < discs.length,
    "Reuse wagon split geometry",
  );
  f.scene.group.updateWorldMatrix(true, true);
  for (const pivot of pivots) {
    const disc = pivot.children[0];
    const center = disc.geometry.boundingBox
      .getCenter(new T.Vector3())
      .applyMatrix4(disc.matrixWorld);
    assert.ok(
      center.distanceTo(pivot.getWorldPosition(new T.Vector3())) < 1e-6,
      "Wheel rotates about its center",
    );
  }
  const tracks = rig.parent.children.filter(
    (part) => part !== rig && part.getObjectByName("railroad-straight"),
  );
  const bounds = tracks.map((part) => new T.Box3().setFromObject(part));
  close(
    Math.min(...bounds.map((box) => box.min.x)),
    f.config.layout.sceneSpacing - f.config.port.trackHalfLength,
  );
  close(
    Math.max(...bounds.map((box) => box.max.x)),
    f.config.layout.sceneSpacing + f.config.port.trackHalfLength,
  );
  for (let i = 1; i < bounds.length; i++)
    close(bounds[i - 1].max.x, bounds[i].min.x);
  const cargo = rig.children.filter((part) => part.userData.fixtureContainer);
  assert.equal(cargo.length, wagons.length);
  for (const container of cargo) {
    const wagon = wagons.find(
      (part) => part.position.x === container.position.x,
    );
    const origin = rig.localToWorld(
      new T.Vector3(container.position.x, 10, f.config.port.railZ),
    );
    const hits = new T.Raycaster(
      origin,
      new T.Vector3(0, -1, 0),
    ).intersectObject(wagon, true);
    assert.ok(hits.length);
    close(
      container.position.y - container.scale.y * 0.5,
      rig.worldToLocal(hits[0].point).y,
    );
  }
  const previousX = rig.position.x;
  f.scene.update({ ...frame, progress: 1 });
  assert.ok(rig.position.x > previousX);
  assert.ok(pivots.some((pivot) => pivot.rotation.z !== 0));
  const puffs = rig.children.filter(
    (part) => part.geometry?.type === "SphereGeometry",
  );
  assert.equal(new Set(puffs.map((puff) => puff.material)).size, puffs.length);
  assert.ok(
    new Set(puffs.map((puff) => puff.material.userData.motionOpacity)).size > 1,
  );
  const pausedX = rig.position.x;
  f.scene.group.visible = false;
  f.scene.update({ ...frame, progress: 1, dt: 1 });
  close(rig.position.x, pausedX);
  f.scene.group.visible = true;
  f.scene.update({ ...frame, progress: 1, reducedMotion: true });
  close(rig.position.x, 0);
  assert.ok(puffs.every((puff) => !puff.visible));
  for (const [geometry, index] of topology)
    assert.deepEqual(Array.from(geometry.index.array), index);
});

test("Work waits for city loads, settles heroes while stationary, and writes selection only when it changes", async () => {
  const f = fixture(work);
  let ready = false;
  f.scene.ready.then(() => {
    ready = true;
  });
  assert.deepEqual(f.writes, []);
  assert.equal(f.scene.animated, undefined);
  f.scene.update(frame);
  assert.deepEqual(f.writes, [0]);
  await f.releaseCar();
  assert.equal(ready, false, "Readiness includes city loads");
  await f.settle(true);
  assert.deepEqual(f.errors, []);
  assert.equal(
    f.requests.filter((request) => request.priority === 0).length,
    f.config.work.milestones.length,
  );
  assert.equal(f.changes, f.models.length);
  assert.equal(
    f.scene.update(frame),
    true,
    "Hero animation must keep a stationary scene awake",
  );
  assert.ok(settleMotion(f.scene) > 1);
  for (let i = 0; i < 20; i++) assert.equal(f.scene.update(frame), false);
  assert.deepEqual(f.writes, [0]);
  const car = modelFor(f, "sedan-sports").parent,
    wheel = modelFor(f, "sedan-sports").getObjectByName("wheel-front-left");
  const angle = wheel.rotation.x;
  settleMotion(f.scene, { ...frame, workProgress: 1 });
  assert.equal(f.writes.at(-1), 4);
  assert.notEqual(wheel.rotation.x, angle);
  const curve = new T.CatmullRomCurve3(
    f.config.work.route.map((point) => new T.Vector3(...point)),
  );
  curve.arcLengthDivisions = 400;
  const stops = distanceStops(curve, f.config.work.milestones),
    goal = curve.getPointAt(stops.at(-1));
  close(car.position.x, goal.x);
  close(car.position.y, goal.y + 0.3);
  close(car.position.z, goal.z);
  const tangent = curve.getTangentAt(stops.at(-1));
  close(shortestAngle(car.rotation.y, -Math.atan2(tangent.z, tangent.x)), 0);
  settleMotion(f.scene, frame);
  assert.equal(f.writes.at(-1), 0);
  for (let i = 1; i < f.writes.length; i++)
    assert.notEqual(f.writes[i], f.writes[i - 1]);
  const reduced = { ...frame, workProgress: 0.6, reducedMotion: true };
  const oldWheel = wheel.rotation.x;
  assert.equal(f.scene.update(reduced), false);
  close(wheel.rotation.x, oldWheel);
  assert.equal(
    f.writes.at(-1),
    nearestStop(stops[0] + (stops.at(-1) - stops[0]) * 0.6, stops),
  );
});

test("Work keeps updating for a remaining turn and supplies reusable route vectors", async (t) => {
  const config = structuredClone(CONFIG);
  config.work.followDamping = 1000;
  config.work.steeringDamping = 0.5;
  const f = fixture(work, { config });
  await f.settle();
  f.scene.update({ ...frame, reducedMotion: true });
  const car = modelFor(f, "sedan-sports").parent;
  for (let i = 0; i < 120; i++)
    assert.equal(f.scene.update({ ...frame, workProgress: 1 }), true);
  const hero = modelFor(f, "building-skyscraper-a").parent;
  close(hero.position.y, config.layout.floorY + 0.02 + 0.15);
  const fixedPosition = car.position.clone(),
    previousHeading = car.rotation.y;
  assert.equal(f.scene.update({ ...frame, workProgress: 1 }), true);
  close(car.position.distanceTo(fixedPosition), 0);
  assert.notEqual(car.rotation.y, previousHeading);
  settleMotion(f.scene, { ...frame, workProgress: 1 });
  const original = T.CatmullRomCurve3.prototype.getPoint;
  t.mock.method(
    T.CatmullRomCurve3.prototype,
    "getPoint",
    function (parameter, target) {
      assert.ok(target, "Route sampling must reuse a vector");
      return original.call(this, parameter, target);
    },
  );
  t.mock.method(T.CatmullRomCurve3.prototype, "getTangentAt", () =>
    assert.fail("Allocating tangent sampling during update"),
  );
  f.scene.update({ ...frame, workProgress: 0.4 });
});

test("Work placement is independent of asset completion order and respects mobile counts and configured widths", async () => {
  const a = fixture(work),
    b = fixture(work);
  await a.settle();
  await b.settle(true);
  const placements = (f) =>
    f.models
      .filter((model) => !model.userData.fixtureSource.includes("car-kit"))
      .map((model) => ({
        source: model.userData.fixtureSource,
        x: model.parent.position.x,
        z: model.parent.position.z,
        scale: model.parent.scale.toArray(),
        yaw: model.parent.rotation.y,
      }))
      .sort(
        (left, right) =>
          left.source.localeCompare(right.source) || left.x - right.x,
      );
  assert.deepEqual(placements(a), placements(b));
  const config = structuredClone(CONFIG);
  config.layout.floorY = -2;
  config.work.carScale = 0.7;
  config.work.mobileFarCount = 2;
  config.work.buildingWidths = {
    heroTower: 3,
    hero: 2.1,
    middle: 2.3,
    farTower: 3.2,
    far: 1.2,
    parasol: 0.6,
    awning: 0.9,
  };
  const f = fixture(work, { config, mobile: true });
  await f.settle();
  assert.deepEqual(f.errors, []);
  close(modelFor(f, "sedan-sports").scale.x, config.work.carScale);
  assert.equal(
    f.requests.filter((request) => request.priority === 2).length,
    0,
  );
  assert.equal(
    f.requests.filter((request) =>
      request.source.includes("low-detail-building-"),
    ).length,
    config.work.mobileFarCount,
  );
  for (const model of f.models) {
    const source = model.userData.fixtureSource;
    if (source.includes("car-kit")) continue;
    const holder = model.parent,
      size = holder.userData.size,
      widths = config.work.buildingWidths;
    const width = source.includes("parasol")
      ? widths.parasol
      : /awning|overhang/.test(source)
        ? widths.awning
        : source.includes("low-detail")
          ? widths.far
          : source.includes("skyscraper")
            ? widths.heroTower
            : widths.hero;
    close(Math.max(size.x, size.z) * holder.scale.x, width);
    close(holder.position.y, config.layout.floorY + 0.02);
  }
  const road = f.scene.group.children.find(
    (part) => part.geometry?.type === "BufferGeometry" && part.material?.map,
  );
  assert.ok(road.material.transparent);
  assert.equal(road.material.depthWrite, false);
});

test("Skills selection, Contact doors, and Factory conveyor respond to their controls", async () => {
  const s = fixture(skills);
  s.scene.select(2);
  s.scene.hover(1);
  s.scene.update({ ...frame, reducedMotion: true });
  close(s.scene.pickable[2].position.z, 1.1);
  close(s.scene.pickable[1].position.z, 0.5);
  s.scene.hover(-1);
  s.scene.update({ ...frame, reducedMotion: true });
  close(s.scene.pickable[1].position.z, 0);
  const c = fixture(contact);
  const doors = c.scene.group.children.filter((part) => part.isGroup);
  c.scene.update({ ...frame, progress: 4 });
  assert.equal(doors.length, 2);
  for (const door of doors) close(Math.abs(door.rotation.y), 1.75);
  c.scene.update({ ...frame, progress: 3 });
  for (const door of doors) close(door.rotation.y, 0);
  const f = fixture(factory);
  await f.settle();
  const { unit, originX, originZ, conveyorSpeed } = f.config.factory;
  const boxes = f.models
    .map((model) => model.parent)
    .filter(
      (holder) =>
        Math.abs(
          holder.position.y - (f.config.layout.floorY + 0.02 + 0.4 * unit),
        ) < 1e-7 && Math.abs(holder.position.z - (originZ + 3.6 * unit)) < 1e-7,
    );
  assert.ok(boxes.length > 0);
  const before = boxes[0].position.x;
  f.scene.update({ ...frame, dt: 0.1 });
  close(boxes[0].position.x, before + 0.1 * conveyorSpeed);
  f.setReducedMotion(true);
  const paused = boxes[0].position.x;
  f.scene.update({ ...frame, dt: 0.1 });
  close(boxes[0].position.x, paused);
  assert.ok(boxes.every((box) => box.position.x >= originX));
});

test("background scenery loads allowlisted models near sites and uses configured floor height", async () => {
  const f = fixture(createScenery),
    camera = new T.PerspectiveCamera();
  camera.position.x = -1000;
  f.scene.update(camera, 0, false);
  assert.equal(f.requests.length, 0);
  for (const site of SCENERY_SITES) {
    camera.position.x = site.x;
    f.scene.update(camera, 0, false);
    await f.settle();
    f.scene.update(camera, 1, true);
  }
  assert.deepEqual(f.errors, []);
  assert.ok(f.models.length > 0);
  assert.ok(f.requests.every((request) => request.priority === 4));
  for (const group of f.scene.group.children)
    close(group.position.y, f.config.layout.floorY);
});

test("Skills centers configurable rows and columns and cycles the palette", () => {
  for (const columns of [1, 3]) {
    const config = structuredClone(CONFIG);
    config.skills = { columns, gap: 2.8, rowGap: 1.6, containerScale: 1.3 };
    config.palette.containers = [0x123456, 0xabcdef];
    const f = fixture(skills, { config });
    const meshes = f.scene.pickable;
    const xs = [...new Set(meshes.map((mesh) => mesh.position.x))].sort(
      (a, b) => a - b,
    );
    const ys = [...new Set(meshes.map((mesh) => mesh.position.y))].sort(
      (a, b) => a - b,
    );
    assert.equal(xs.length, columns);
    assert.equal(ys.length, Math.ceil(meshes.length / columns));
    close(xs[0] + xs.at(-1), 0);
    close(ys[0] + ys.at(-1), 0);
    for (let i = 1; i < xs.length; i++)
      close(xs[i] - xs[i - 1], config.skills.gap);
    for (let i = 1; i < ys.length; i++)
      close(ys[i] - ys[i - 1], config.skills.rowGap);
    meshes.forEach((mesh, index) => {
      close(mesh.scale.x, config.skills.containerScale);
      assert.equal(
        mesh.material[0].color.getHex(),
        config.palette.containers[index % 2],
      );
    });
  }
});

test(
  "Work and Port readiness settle after missing critical assets",
  { timeout: 5000 },
  async () => {
    for (const [create, fail] of [
      [work, ["sedan-sports.glb", "building-a.glb"]],
      [port, ["train-locomotive-a.glb"]],
    ]) {
      const f = fixture(create, { fail });
      await f.settle();
      assert.ok(f.errors.length > 0);
      assert.ok(f.scene.group.isGroup);
      assert.doesNotThrow(() =>
        f.scene.update({ ...frame, reducedMotion: true }),
      );
    }
  },
);
