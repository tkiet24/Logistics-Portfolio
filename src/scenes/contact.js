import * as T from "three";

const PACK = "kits/watercraft-pack/Models/GLB format/";

export function createScene(ctx) {
  const { contact: settings, layout, palette } = ctx.config;
  const group = new T.Group();
  group.name = "Contact · working harbour";
  group.position.set(layout.sceneSpacing * 4, layout.floorY + 0.12, 0);
  group.rotation.y = settings.rotationY;
  group.scale.setScalar(settings.scale);
  const lowDetail = ctx.quality.mobile;
  const floating = [];
  const cranes = [];
  const clock = { value: 0 };
  let elapsed = 0;

  const material = (color, roughness = 0.75) =>
    new T.MeshStandardMaterial({ color, roughness });
  const concrete = material(0xabb4b5);
  const edge = material(0x253c46);
  const steel = material(0xb84230, 0.55);
  steel.metalness = 0.3;
  const darkSteel = material(0x314550);
  const marking = material(0xf2d18a);
  const rubber = material(0x182b32);
  const lamp = new T.MeshBasicMaterial({ color: 0xffdf9e });
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  function box(parent, name, size, position, mat) {
    const mesh = new T.Mesh(boxGeometry, mat);
    mesh.name = name;
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  function brace(parent, a, b, mat, width = 0.055) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    const mesh = box(parent, "Crane structural brace", [width, start.distanceTo(end), width], start.clone().add(end).multiplyScalar(0.5).toArray(), mat);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
    return mesh;
  }

  // One low-poly basin and one shaded surface: no reflection render targets.
  const basin = new T.Mesh(
    new T.CylinderGeometry(1, 1, 0.22, lowDetail ? 48 : 80),
    edge,
  );
  basin.name = "Harbour basin";
  basin.scale.set(settings.waterWidth / 2, 1, settings.waterDepth / 2);
  basin.position.y = -0.12;
  group.add(basin);
  const waterMaterial = material(settings.waterColour, 0.32);
  waterMaterial.metalness = 0.18;
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.harbourTime = clock;
    shader.vertexShader = "varying vec2 harbourUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nharbourUv = uv;",
    );
    shader.fragmentShader =
      "uniform float harbourTime;\nvarying vec2 harbourUv;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       float swell = sin(harbourUv.y * 42.0 + harbourUv.x * 12.0 + harbourTime * 0.6);
       float wave = sin(harbourUv.x * 84.0 + harbourUv.y * 31.0 + swell * 1.8 - harbourTime);
       float glint = smoothstep(0.96, 1.0, wave) * (0.5 + 0.5 * swell);
       float shore = smoothstep(0.28, 0.5, length(harbourUv - 0.5));
       diffuseColor.rgb *= 0.92 + 0.06 * wave + 0.04 * swell;
       diffuseColor.rgb += vec3(0.16, 0.25, 0.24) * (glint * 0.22 + shore * 0.16);`,
    );
  };
  waterMaterial.customProgramCacheKey = () => "contact-harbour-water-v2";
  const water = new T.Mesh(
    new T.CircleGeometry(1, lowDetail ? 48 : 80),
    waterMaterial,
  );
  water.name = "Animated harbour water";
  water.rotation.x = -Math.PI / 2;
  water.scale.set(settings.waterWidth / 2, settings.waterDepth / 2, 1);
  group.add(water);

  // Commercial quay, service pier and fenders at the berth.
  box(group, "Main quay", [9.4, 0.42, 2.2], [0, 0.08, -2.8], concrete);
  box(group, "Service pier", [0.8, 0.42, 2.8], [-4.3, 0.08, -0.4], concrete);
  box(group, "Berth safety stripe", [9.3, 0.018, 0.1], [0, 0.3, -1.8], marking);
  for (let x = -4.3; x <= 4.4; x += 0.8) {
    box(group, "Quay fender", [0.18, 0.3, 0.12], [x, 0.08, -1.7], rubber);
    box(group, "Lane marking", [0.35, 0.012, 0.045], [x, 0.3, -2.65], marking);
    box(group, "Mooring bollard", [0.09, 0.16, 0.09], [x, 0.38, -1.95], darkSteel);
    box(group, "Bollard cap", [0.22, 0.06, 0.1], [x, 0.48, -1.95], darkSteel);
  }
  for (const z of [-2.2, -2.9])
    box(group, "Quay crane rail", [9.2, 0.025, 0.045], [0, 0.31, z], darkSteel);
  for (const x of [-3.7, 0, 3.7]) {
    box(group, "Quay lamp post", [0.045, 1.65, 0.045], [x, 1.1, -3], darkSteel);
    box(
      group,
      "Quay lamp arm",
      [0.34, 0.045, 0.045],
      [x + 0.14, 1.91, -3],
      darkSteel,
    );
    box(
      group,
      "Warm quay light",
      [0.19, 0.04, 0.09],
      [x + 0.22, 1.88, -3],
      lamp,
    );
  }
  for (const x of [-2.1, 2.1]) {
    const crane = new T.Group();
    crane.name = "Quayside gantry crane";
    crane.position.set(x, 0.29, -2.4);
    group.add(crane);
    for (const side of [-0.48, 0.48]) {
      box(crane, "Crane leg", [0.18, 3.1, 0.22], [side, 1.55, 0], steel);
      box(crane, "Crane foot", [0.34, 0.14, 0.85], [side, 0.07, 0], darkSteel);
      brace(crane, [side, 2.1, 0], [0, 3.1, 0], steel, 0.09);
      brace(crane, [side, 0.15, -0.4], [side, 1.5, 0], darkSteel, 0.07);
    }
    box(crane, "Crane crossbeam", [1.2, 0.23, 0.3], [0, 3.1, 0], steel);
    for (const side of [-0.2, 0.2]) {
      box(crane, "Crane boom", [0.12, 0.22, 3.4], [side, 3.35, 0.5], steel);
      brace(crane, [side, 4.05, -0.5], [side, 3.4, 2.15], darkSteel, 0.035);
      brace(crane, [side, 4.05, -0.5], [side, 3.4, -1.15], darkSteel, 0.035);
    }
    box(crane, "Crane mast", [0.15, 0.8, 0.18], [0, 3.7, -0.5], steel);
    box(crane, "Counterweight", [0.72, 0.4, 0.65], [0, 3.13, -1], darkSteel);
    box(crane, "Maintenance platform", [1.05, 0.08, 0.85], [0, 3.2, -0.35], darkSteel);
    box(crane, "Crane cabin", [0.48, 0.45, 0.5], [0.52, 2.9, 0.45], darkSteel);
    box(crane, "Cabin glass", [0.37, 0.28, 0.018], [0.52, 2.93, 0.71], material(0x518c9a, 0.2));
    box(crane, "Cabin roof", [0.6, 0.06, 0.62], [0.52, 3.15, 0.45], marking);
    const cable = box(
      crane,
      "Hoist cable",
      [0.018, 1, 0.018],
      [-0.24, 2.7, 1.2],
      darkSteel,
    );
    const spreader = box(
      crane,
      "Empty lifting spreader",
      [0.85, 0.1, 0.46],
      [0, 2.35, 1.2],
      marking,
    );
    const secondCable = cable.clone();
    secondCable.position.x = 0.24;
    crane.add(secondCable);
    cranes.push({ cables: [cable, secondCable], spreader, phase: x });
  }

  function load(name, length, position, yaw, floatingDepth = null) {
    const holder = new T.Group();
    holder.name = name;
    holder.position.set(...position);
    holder.rotation.y = yaw;
    group.add(holder);
    if (floatingDepth !== null)
      floating.push({ holder, y: position[1], phase: position[0] });
    const ready = ctx.load(`${PACK}${name}.glb`, (model) => {
      const bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3());
      const scale = length / Math.max(size.x, size.z);
      const center = bounds.getCenter(new T.Vector3());
      model.scale.setScalar(scale);
      model.position.set(
        -center.x * scale,
        -bounds.min.y * scale - (floatingDepth ?? 0),
        -center.z * scale,
      );
      holder.add(model);
      ctx.changed();
    });
    return { holder, ready };
  }
  const ship = load("ship-cargo-a", settings.shipLength, [0, 0, -0.35], Math.PI / 2, 0.17);
  const tug = load("boat-tug-a", settings.tugLength, [0, 0, 2], 0, 0.1);
  const serviceTug = load("boat-tug-b", 1.3, [-3.5, 0, 0.1], 0, 0.09);
  const loads = [ship.ready, tug.ready, serviceTug.ready];
  for (const [x, model] of [[-3.4, "cargo-container-a"], [-0.5, "cargo-container-b"], [2.5, "cargo-container-c"]]) {
    loads.push(load(model, 1.8, [x, 0.3, -3.3], Math.PI / 2).ready);
  }
  loads.push(load("cargo-pile-a", 1.4, [0.7, 0.3, -3.2], Math.PI / 2).ready);
  for (const [x, z] of [
    [-5.1, 0.9],
    [4.9, 0.8],
  ]) {
    loads.push(load("buoy", 0.34, [x, 0, z], 0, 0.05).ready);
  }

  const wakeMaterial = new T.MeshBasicMaterial({
    color: 0xbce5df,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const wake = new T.Group();
  wake.name = "Tug wake";
  group.add(wake);
  const wakeGeometry = new T.PlaneGeometry(0.025, 0.8);
  for (const side of [-1, 1]) {
    const foam = new T.Mesh(wakeGeometry, wakeMaterial);
    foam.rotation.set(-Math.PI / 2, 0, side * 0.32);
    foam.position.set(side * 0.25, 0, -0.75);
    wake.add(foam);
  }

  function update({ dt, reducedMotion }) {
    if (!reducedMotion) elapsed += Math.max(0, dt);
    const time = reducedMotion ? 0 : elapsed;
    clock.value = time * settings.waveSpeed;
    for (const { holder, y, phase } of floating) {
      holder.position.y =
        y +
        Math.sin(time * 1.25 + phase) *
          (reducedMotion ? 0 : settings.bobAmount);
      holder.rotation.z = reducedMotion
        ? 0
        : Math.sin(time * 0.9 + phase) * 0.012;
    }
    const angle = time * settings.tugSpeed;
    tug.holder.position.x = Math.sin(angle) * 2.9;
    tug.holder.position.z = 2.3 + Math.cos(angle) * 0.65;
    // Models face +Z. Follow the route tangent continuously through turns.
    tug.holder.rotation.y = Math.atan2(
      2.9 * Math.cos(angle),
      -0.65 * Math.sin(angle),
    );
    wake.position.set(tug.holder.position.x, 0.012, tug.holder.position.z);
    wake.rotation.y = tug.holder.rotation.y;
    wake.visible = !reducedMotion;
    for (const { cables, spreader, phase } of cranes) {
      const height = 2.35 + Math.sin(time * settings.craneSpeed + phase) * 0.15;
      spreader.position.y = height;
      for (const cable of cables) {
        cable.scale.y = 3.24 - height;
        cable.position.y = (3.24 + height) / 2;
      }
    }
  }
  update({ dt: 0, reducedMotion: ctx.reducedMotion() });
  return {
    group,
    animated: true,
    update,
    ready: Promise.allSettled(loads),
    theme(tokens) {
      const background = new T.Color(tokens.background);
      const dark = background.r + background.g + background.b < 1.5;
      waterMaterial.color.setHex(
        dark ? settings.darkWaterColour : settings.waterColour,
      );
      concrete.color.setHex(dark ? 0x657e83 : 0xabb4b5);
      ctx.changed();
    },
  };
}
