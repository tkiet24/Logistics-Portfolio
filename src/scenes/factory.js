import * as T from "three";
import { finishFactoryModel } from "../three/factory-finish.js";

const PACK = "kits/factory-kit/Models/GLB format/";

export function createScene(ctx) {
  const { config } = ctx;
  const settings = config.factory;
  const colours = settings.colours;
  const U = settings.unit;
  const X0 = settings.originX,
    Z0 = settings.originZ;
  const groundY = config.layout.floorY;
  const floorY = groundY + 0.18;
  const group = new T.Group();
  group.name = "Open logistics processing factory";
  const parcels = [],
    robots = [],
    loads = [];
  let elapsed = 0;

  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const material = (color, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness: 0.8, metalness });
  const concrete = material(colours.floor);
  const steel = material(colours.steel, 0.3);
  const safety = material(colours.safety);
  const accent = material(colours.accent);
  function box(name, position, size, finish) {
    const mesh = new T.Mesh(boxGeometry, finish);
    mesh.name = name;
    mesh.position.set(
      X0 + position[0] * U,
      floorY + position[1] * U,
      Z0 + position[2] * U,
    );
    mesh.scale.set(size[0] * U, size[1] * U, size[2] * U);
    group.add(mesh);
    return mesh;
  }

  // A continuous foundation and low-contrast slab joints ground the entire scene.
  box("Factory foundation", [4.7, -0.12, 3], [12.4, 0.2, 9], concrete);
  const tiles = new T.InstancedMesh(
    new T.PlaneGeometry(1.87 * U, 1.87 * U),
    concrete,
    24,
  );
  tiles.name = "Factory floor panels";
  const transform = new T.Object3D();
  const floorTint = new T.Color();
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      const index = i * 4 + j;
      transform.position.set(
        X0 + (0.25 + i * 1.9) * U,
        floorY - 0.01,
        Z0 + (0.6 + j * 1.9) * U,
      );
      transform.rotation.x = -Math.PI / 2;
      transform.updateMatrix();
      tiles.setMatrixAt(index, transform.matrix);
      tiles.setColorAt(index, floorTint.setScalar((i + j) % 2 ? 1.035 : 0.97));
    }
  }
  group.add(tiles);

  function place(name, x, z, options = {}) {
    const promise = ctx
      .load(PACK + name + ".glb", (model) => {
        const structure = name.startsWith("structure-");
        const trim = name.startsWith("box-")
          ? colours.carton
          : structure || name.startsWith("robot-")
            ? colours.accent
            : colours.safety;
        const body = structure
          ? colours.wall
          : name.startsWith("pipe-") || name.startsWith("conveyor-")
            ? colours.steel
            : colours.machinery;
        finishFactoryModel(model, body, trim);
        const holder = new T.Group();
        holder.name = `Factory ${name}`;
        holder.add(model);
        holder.scale.setScalar(U * (options.scale ?? 1));
        if (structure) holder.scale.y *= settings.wallHeight / 3;
        holder.rotation.y = options.yaw ?? 0;
        holder.position.set(
          X0 + x * U,
          floorY + (options.y ?? 0) * U,
          Z0 + z * U,
        );
        group.add(holder);
        options.ready?.(holder, model);
      })
      .catch(ctx.error);
    loads.push(promise);
  }

  // Two rear walls frame the process; the camera-facing side and loading apron stay open.
  for (let i = 0; i < 10; i++)
    place(i % 3 === 1 ? "structure-window" : "structure-wall", i + 0.5, 0, {
      yaw: Math.PI,
    });
  for (const z of [1.2, 2.2, 3.2])
    place("structure-wall", 0, z, { yaw: -Math.PI / 2 });
  box(
    "Rear end column",
    [10.2, settings.wallHeight / 2, 0],
    [0.18, settings.wallHeight, 0.25],
    steel,
  );
  box(
    "Rear coping",
    [5, settings.wallHeight + 0.04, 0],
    [10.7, 0.09, 0.6],
    steel,
  );

  place("catwalk-stairs", 1.7, 1.3, { yaw: Math.PI });
  place("catwalk-straight", 3.7, 1, { y: 1.4 });
  place("catwalk-straight", 4.7, 1, { y: 1.4 });
  place("pipe-large-long", 6.6, 0.8, { y: 1.7 });
  place("pipe-large-long", 8.6, 0.8, { y: 1.7 });

  // Receiving, processing and outbound packing read left to right.
  place("hopper-high-round", 1.8, 3.5);
  place("machine-window", 3.2, 3.6, { yaw: Math.PI / 2 });
  for (const x of [4.6, 6.6, 8.6]) place("conveyor-long", x, 3.6);
  place("machine", 5.5, 2.1, { yaw: Math.PI });
  place("machine-fortified", 7.2, 2.1, { yaw: Math.PI });
  place("hopper-square", 9.1, 2.1);
  [4.1, 5.9, 7.8].forEach((x, index) => {
    place(index === 1 ? "box-large" : "box-small", x, 3.6, {
      y: 0.4,
      scale: 0.65,
      ready(holder) {
        holder.userData.conveyorParcel = true;
        parcels.push(holder);
      },
    });
  });
  for (const [name, x, z, yaw] of [
    ["robot-arm-a", 3.8, 2, 0],
    ["robot-arm-b", 9.2, 4.8, -Math.PI / 2],
  ]) {
    place(name, x, z, {
      yaw,
      ready(holder, model) {
        const shoulder = model.getObjectByName("element-c");
        if (shoulder) shoulder.rotation.z = -0.35;
        robots.push({ holder, yaw, phase: x });
      },
    });
  }

  // A clear service aisle, a loading bay and compact safety details replace the tall gate.
  for (const z of [4.65, 5.75])
    box("Service aisle boundary", [5.1, 0.008, z], [7.3, 0.012, 0.035], safety);
  for (const x of [2.5, 4.4, 6.3]) {
    place("indicator-special-arrow", x, 5.2, { scale: 0.6, yaw: Math.PI / 2 });
  }
  box("Outbound pallet", [9.1, 0.07, 6.3], [1.9, 0.14, 1.2], steel);
  place("box-large", 8.7, 6.3, { y: 0.14, scale: 0.75 });
  place("box-large", 9.5, 6.3, { y: 0.14, scale: 0.75 });
  place("box-small", 8.7, 6.3, { y: 0.59, scale: 0.75 });
  place("screen-wide", 1.3, 4.5, { yaw: Math.PI / 2 });
  place("scanner-low", 1.6, 5.8, { yaw: Math.PI / 2 });
  place("warning-traffic", 6.8, 6.8);
  for (const [x, z] of [
    [0.8, 6.5],
    [7.8, 6.8],
    [10.2, 6.8],
  ])
    place("cone", x, z, { scale: 0.8 });
  for (const x of [8, 10.4]) {
    box("Loading bay bollard", [x, 0.25, 7.1], [0.1, 0.5, 0.1], steel);
    box("Bollard reflector", [x, 0.4, 7.1], [0.105, 0.08, 0.105], safety);
  }
  box("Dispatch edge", [9.2, -0.04, 7.45], [2.7, 0.1, 0.08], accent);
  const status = new T.MeshStandardMaterial({
    color: 0x83c9b7,
    emissive: 0x4f9c8b,
    emissiveIntensity: 0.4,
  });
  for (const x of [3.2, 7.2]) {
    box("Machine status mast", [x, 1.3, 2.65], [0.035, 0.5, 0.035], steel);
    box("Machine ready indicator", [x, 1.58, 2.65], [0.09, 0.12, 0.09], status);
  }
  ctx.shadow(group, X0 + 4.7 * U, Z0 + 3 * U, 13 * U, 9.6 * U, groundY + 0.01);

  return {
    group,
    ready: Promise.allSettled(loads),
    animated: true,
    update({ dt, reducedMotion = ctx.reducedMotion() }) {
      if (reducedMotion || ctx.reducedMotion()) return;
      const delta = Math.max(0, dt);
      elapsed += delta;
      const start = X0 + 3.8 * U,
        end = X0 + 9.3 * U;
      for (const parcel of parcels)
        parcel.position.x =
          start +
          ((parcel.position.x - start + delta * settings.conveyorSpeed) %
            (end - start));
      for (const { holder, yaw, phase } of robots)
        holder.rotation.y = yaw + Math.sin(elapsed * 0.45 + phase) * 0.12;
    },
  };
}
