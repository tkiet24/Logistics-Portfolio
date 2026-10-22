import * as T from "three";
import { extractTrainWheels } from "../three/wheels.js";
import { createRailExit } from "../three/rail-exit.js";

export function createScene(ctx) {
  const { config, quality } = ctx;
  const { port, palette, layout } = config;
  const P = new T.Group();
  P.position.set(layout.sceneSpacing, port.positionY, 0);
  const groundY = layout.floorY - P.position.y;
  const railZ = port.railZ;
  const halfLength = port.trackHalfLength;
  const colours = palette.containers;
  const lowDetail = quality.mobile || quality.detail === "low";

  for (let column = -2; column <= 2; column++) {
    for (let row = -1; row <= 1; row++) {
      const height = 1 + Math.floor(Math.random() * 3);
      const x = column * 2.6 - 2;
      const z = row * 1.25 - 1.5;
      for (let level = 0; level < height; level++) {
        const container = ctx.cont(
          colours[Math.floor(Math.random() * colours.length)],
        );
        container.scale.setScalar(port.containerScale);
        container.position.set(
          x,
          groundY + (level * 1.02 + 0.5) * port.containerScale,
          z,
        );
        P.add(container);
      }
      ctx.shadow(
        P,
        x,
        z,
        3.2 * port.containerScale,
        1.6 * port.containerScale,
        groundY + 0.012,
      );
    }
  }

  const craneMaterial = new T.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.5,
  });
  for (const x of [-7.4, 3.4]) {
    for (const dz of [-1.4, 1.4]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.25, 5.9, 0.25), craneMaterial);
      leg.position.set(x, 2.45, railZ + dz);
      P.add(leg);
      ctx.shadow(P, x, railZ + dz, 1.1, 0.8, groundY + 0.012);
    }
    const crossBeam = new T.Mesh(
      new T.BoxGeometry(0.25, 0.3, 3.05),
      craneMaterial,
    );
    crossBeam.position.set(x, 5.5, railZ);
    P.add(crossBeam);
  }
  const beam = new T.Mesh(new T.BoxGeometry(11, 0.3, 0.4), craneMaterial);
  beam.position.set(-2, 5.5, railZ);
  P.add(beam);
  const hangingContainer = ctx.cont(colours[2 % colours.length]);
  hangingContainer.scale.setScalar(port.containerScale);
  P.add(hangingContainer);
  const trolley = new T.Mesh(new T.BoxGeometry(0.5, 0.25, 0.5), craneMaterial);
  trolley.position.set(-2, 5.2, railZ);
  P.add(trolley);
  const rope = new T.Mesh(
    new T.BoxGeometry(0.03, 1, 0.03),
    new T.MeshStandardMaterial({ color: 0x2b2625 }),
  );
  P.add(rope);
  const hangingShadow = new T.Group();
  P.add(hangingShadow);
  ctx.shadow(hangingShadow, 0, railZ, 3, 1.6, groundY + 0.012);

  const trainGroup = new T.Group();
  trainGroup.position.y = port.railY;
  P.add(trainGroup);
  const gravelMaterial = new T.MeshStandardMaterial({
    color: 0x444444,
    roughness: 1,
  });
  const gravel = new T.Mesh(
    new T.PlaneGeometry(halfLength * 2, 1.6),
    gravelMaterial,
  );
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.set(0, 0.01, railZ);
  trainGroup.add(gravel);
  let startX = -halfLength - 10;
  const trainRig = new T.Group();
  trainRig.position.x = startX;
  trainGroup.add(trainRig);
  let trainWheels = [];
  let railExit;
  let trainLoaded = false;
  let trainState = "waiting";
  let trainTime = 0;
  let activeTime = 0;
  let locoFrontX = 2.4;
  let locoTopY = 2;

  const smokeGeometry = new T.SphereGeometry(
    0.12,
    lowDetail ? 6 : 8,
    lowDetail ? 6 : 8,
  );
  const puffCount = lowDetail ? 4 : 8;
  const smokePuffs = Array.from({ length: puffCount }, (_, index) => {
    const mesh = new T.Mesh(
      smokeGeometry,
      new T.MeshBasicMaterial({
        color: 0xd9d6d4,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    mesh.visible = false;
    trainRig.add(mesh);
    return { mesh, life: index / puffCount };
  });

  const signal = new T.Group();
  signal.position.set(3, 0, railZ - 0.9);
  trainGroup.add(signal);
  signal.name = "Railway traffic signal";
  const signalLamps = [];
  const signalReady = ctx.load("kits/traffic_light.glb", (model) => {
    const bounds = new T.Box3().setFromObject(model);
    const size = bounds.getSize(new T.Vector3());
    const center = bounds.getCenter(new T.Vector3());
    const scale = port.signalHeight / size.y;
    model.scale.setScalar(scale);
    model.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    );
    model.traverse((part) => {
      if (!part.isMesh || part.userData.signalOverlay) return;
      if (part.name.startsWith("lichtanimation")) {
        const state = part.name.includes("rot")
          ? "red"
          : part.name.includes("gelb")
            ? "amber"
            : "green";
        const colour =
          state === "red" ? 0xff3021 : state === "amber" ? 0xffbe45 : 0x57e3a0;
        part.material = new T.MeshStandardMaterial({
          color: colour,
          emissive: colour,
          emissiveIntensity: 0.05,
          roughness: 0.35,
        });
        part.geometry.computeBoundingBox();
        const lensBounds = part.geometry.boundingBox;
        const radius = (lensBounds.max.y - lensBounds.min.y) * 0.42;
        const bulb = new T.Mesh(
          new T.SphereGeometry(radius, 12, 8),
          new T.MeshBasicMaterial({ color: colour }),
        );
        bulb.name = `Signal ${state} illuminated lens`;
        bulb.userData.signalOverlay = true;
        bulb.position.copy(lensBounds.getCenter(new T.Vector3()));
        bulb.position.z = lensBounds.max.z + radius * 0.15;
        const halo = new T.Mesh(
          new T.RingGeometry(radius, radius * 1.45, 24),
          new T.MeshBasicMaterial({
            color: colour,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: T.DoubleSide,
          }),
        );
        halo.name = `Signal ${state} halo`;
        halo.userData.signalOverlay = true;
        halo.position.copy(bulb.position);
        halo.position.z += radius * 0.8;
        part.add(bulb, halo);
        signalLamps.push({
          material: part.material,
          state,
          colour,
          bulb,
          halo,
        });
      } else {
        for (const mat of Array.isArray(part.material)
          ? part.material
          : [part.material]) {
          mat.transparent = false;
          mat.alphaTest = 0.5;
          mat.depthWrite = true;
          mat.emissiveIntensity = 0.12;
        }
      }
    });
    signal.add(model);
    setSignal(
      trainState === "arriving" &&
        !ctx.reducedMotion() &&
        trainTime < greenUntil(),
    );
  });
  function greenUntil() {
    return Math.max(0, port.arrivalSeconds - port.redLeadSeconds);
  }
  function setSignal(green) {
    for (const lamp of signalLamps) {
      const on = lamp.state === (green ? "green" : "red");
      lamp.material.emissiveIntensity = on ? 1.5 : 0.025;
      lamp.material.color.setHex(lamp.colour).multiplyScalar(on ? 1 : 0.12);
      lamp.bulb.material.color.setHex(on ? lamp.colour : 0x142326);
      lamp.halo.visible = on;
    }
  }

  function normalizeModel(model, scale) {
    const holder = new T.Group();
    holder.scale.setScalar(scale);
    const bounds = new T.Box3().setFromObject(model);
    const center = bounds.getCenter(new T.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    holder.add(model);
    const size = new T.Box3().setFromObject(holder).getSize(new T.Vector3());
    if (size.z > size.x) holder.rotation.y = Math.PI / 2;
    return holder;
  }

  function assembleTrain([trackModel, locoModel, wagonModel]) {
    const trackHolder = normalizeModel(trackModel, port.trackScale);
    const trackBounds = new T.Box3().setFromObject(trackHolder);
    trainRig.position.y = trackBounds.max.y;
    const trackLength = trackBounds.getSize(new T.Vector3()).x || 2.4;
    const span = halfLength * 2;
    const trackCount = Math.max(1, Math.round(span / trackLength));
    const stretch = span / (trackCount * trackLength);
    for (let index = 0; index < trackCount; index++) {
      // Stretch along the scene's X axis after normalizing the model's orientation.
      const piece = new T.Group();
      piece.scale.x = stretch;
      piece.add(trackHolder.clone());
      piece.position.set(
        -halfLength + (index + 0.5) * trackLength * stretch,
        0,
        railZ,
      );
      trainGroup.add(piece);
    }
    railExit = createRailExit(trackHolder, port, gravelMaterial, lowDetail);
    trainGroup.add(railExit);

    const modelsToExtract = [locoModel];
    const locoHolder = normalizeModel(locoModel, port.trainScale);
    const locoBounds = new T.Box3().setFromObject(locoHolder);
    const locoLength = locoBounds.getSize(new T.Vector3()).x;
    const targetFrontX = 2.4;
    const locoX = targetFrontX - locoLength / 2 + 0.2;
    locoHolder.position.set(locoX, 0, railZ);
    trainRig.add(locoHolder);
    locoFrontX = targetFrontX;
    locoTopY = locoBounds.max.y;
    let trainBackX = locoX - locoLength / 2;
    const raycaster = new T.Raycaster();
    const down = new T.Vector3(0, -1, 0);
    for (let index = 0; index < port.wagonCount; index++) {
      const wagon = wagonModel.clone();
      const holder = normalizeModel(wagon, port.trainScale);
      const size = new T.Box3().setFromObject(holder).getSize(new T.Vector3());
      const wagonX = trainBackX - 0.06 - size.x / 2;
      holder.position.set(wagonX, 0, railZ);
      trainRig.add(holder);
      modelsToExtract.push(wagon);
      trainBackX = wagonX - size.x / 2;
      P.updateWorldMatrix(true, true);
      raycaster.set(
        trainRig.localToWorld(new T.Vector3(wagonX, 2, railZ)),
        down,
      );
      const hits = raycaster.intersectObject(holder, true);
      const deckY = hits.length ? trainRig.worldToLocal(hits[0].point).y : 0.5;
      const cargo = ctx.cont(colours[(index + 2) % colours.length]);
      cargo.scale.set((size.x * 0.9) / 2.4, 1, Math.min(size.z * 0.85, 1));
      cargo.scale.multiplyScalar(port.containerScale);
      cargo.position.set(wagonX, deckY + 0.5 * cargo.scale.y, railZ);
      trainRig.add(cargo);
    }
    trainWheels = extractTrainWheels(modelsToExtract, trainRig);
    P.updateWorldMatrix(true, true);
    const bounds = new T.Box3()
      .setFromObject(trainRig)
      .applyMatrix4(trainRig.matrixWorld.clone().invert());
    const previousStart = startX;
    startX = -halfLength - bounds.min.x;
    if (trainRig.position.x === previousStart) trainRig.position.x = startX;
    ctx.shadow(
      trainRig,
      (bounds.min.x + bounds.max.x) / 2,
      railZ,
      bounds.max.x - bounds.min.x + 1,
      1.5,
      groundY - trainGroup.position.y - trainRig.position.y + 0.012,
    );
    trainLoaded = true;
    ctx.changed();
  }

  const loadModel = (path) => {
    let model;
    return ctx
      .load(path, (loaded) => {
        model = loaded;
      })
      .then((loaded) => model ?? loaded);
  };
  const trainReady = Promise.allSettled([
    loadModel("kits/train-kit/Models/GLB format/railroad-straight.glb"),
    loadModel("kits/train-kit/Models/GLB format/train-locomotive-a.glb"),
    loadModel("kits/train-kit/Models/GLB format/train-carriage-flatbed.glb"),
  ])
    .then((results) => {
      // The shared loader reports asset errors; a failed train leaves the port usable.
      if (results.every((result) => result.status === "fulfilled")) {
        assembleTrain(results.map((result) => result.value));
      }
    })
    .catch((error) => {
      console.error("Port train assembly failed:", error);
      ctx.changed();
    });

  function positionCrane(time) {
    const x = -2 + Math.sin(time * 0.6) * 4.5;
    const y = 3.2 + Math.sin(time * 1.2) * 0.3;
    const top = y + 0.5 * port.containerScale;
    const bottom = 5.075;
    hangingContainer.position.set(x, y, railZ);
    trolley.position.x = x;
    rope.scale.y = Math.max(0, bottom - top);
    rope.position.set(x, (bottom + top) / 2, railZ);
    hangingShadow.position.x = x;
  }

  function update(frame) {
    if (!P.visible) return;
    const distance = Math.abs(frame.progress - 1);
    trainGroup.visible = distance < 1.4;
    trainRig.visible = distance < 1.2;
    if (distance >= 1.2) {
      trainState = "waiting";
      setSignal(false);
      trainTime = 0;
      trainRig.position.x = startX;
      smokePuffs.forEach(({ mesh }) => {
        mesh.visible = false;
      });
    }
    if (distance >= 1.4) return;
    const dt = Math.max(0, frame.dt);
    if (!frame.reducedMotion) activeTime += dt;
    positionCrane(frame.reducedMotion ? 0 : activeTime);
    if (!trainRig.visible) return;
    if (frame.reducedMotion) {
      trainRig.position.x = 0;
      trainState = "parked";
      trainTime = 0;
      setSignal(false);
      smokePuffs.forEach(({ mesh }) => {
        mesh.visible = false;
      });
      return;
    }
    if (!trainLoaded) return;
    if (distance < 0.45 && trainState === "waiting") trainState = "arriving";
    let moving = false;
    if (trainState === "arriving") {
      trainTime += dt;
      const progress = Math.min(
        trainTime / Math.max(port.arrivalSeconds, 0.001),
        1,
      );
      const ease = 1 - (1 - progress) ** 3;
      const oldX = trainRig.position.x;
      trainRig.position.x = startX * (1 - ease);
      const deltaX = trainRig.position.x - oldX;
      for (const { pivot, radius } of trainWheels)
        pivot.rotation.z -= deltaX / radius;
      moving = progress < 1;
      if (!moving) trainState = "parked";
    }
    setSignal(moving && trainTime < greenUntil());
    for (const puff of smokePuffs) {
      puff.life = (puff.life + dt * (moving ? 2 : 0.5)) % 1;
      const life = puff.life;
      puff.mesh.visible = true;
      puff.mesh.position.set(
        locoFrontX - life * (moving ? 1.5 : 0.5),
        locoTopY + life * 2,
        railZ,
      );
      puff.mesh.scale.setScalar(1 + life * 2);
      const material = puff.mesh.material;
      ctx.fadeMaterial(material, 1 - life);
    }
  }

  function theme(tokens) {
    gravelMaterial.color.set(tokens.ground).multiplyScalar(0.8);
    railExit
      ?.getObjectByName("Curved ballast bed")
      .material.color.copy(gravelMaterial.color);
    ctx.changed();
  }

  positionCrane(0);
  ctx.changed();
  const ready = Promise.allSettled([trainReady, signalReady]);
  return { group: P, update, theme, ready, animated: true };
}
