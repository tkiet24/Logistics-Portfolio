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
  const steel = material(palette.accent, 0.45);
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
       float wave = sin(harbourUv.x * 115.0 + harbourUv.y * 42.0 + harbourTime * 0.8)
                  * sin(harbourUv.y * 90.0 - harbourTime * 0.6);
       float glint = smoothstep(0.82, 1.0, wave);
       float shore = smoothstep(0.28, 0.5, length(harbourUv - 0.5));
       diffuseColor.rgb *= 0.88 + 0.12 * wave;
       diffuseColor.rgb += vec3(0.16, 0.25, 0.24) * (glint * 0.35 + shore * 0.28);`,
    );
  };
  waterMaterial.customProgramCacheKey = () => "contact-harbour-water-v1";
  const water = new T.Mesh(
    new T.CircleGeometry(1, lowDetail ? 48 : 80),
    waterMaterial,
  );
  water.name = "Animated harbour water";
  water.rotation.x = -Math.PI / 2;
  water.scale.set(settings.waterWidth / 2, settings.waterDepth / 2, 1);
  group.add(water);

  // Commercial quay, service pier and fenders at the berth.
  box(group, "Main quay", [8.2, 0.32, 1.5], [0, 0.13, -2.5], concrete);
  box(group, "Service pier", [0.8, 0.32, 2.4], [-3.65, 0.13, -0.7], concrete);
  box(group, "Berth safety stripe", [8.1, 0.018, 0.1], [0, 0.3, -1.8], marking);
  for (let x = -3.6; x <= 3.6; x += 0.8) {
    box(group, "Quay fender", [0.18, 0.3, 0.12], [x, 0.08, -1.7], rubber);
    box(group, "Lane marking", [0.35, 0.012, 0.045], [x, 0.3, -2.65], marking);
  }
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
    for (const side of [-0.42, 0.42]) {
      box(crane, "Crane leg", [0.12, 2.5, 0.16], [side, 1.25, 0], steel);
      box(crane, "Crane foot", [0.27, 0.12, 0.75], [side, 0.06, 0], darkSteel);
    }
    box(crane, "Crane crossbeam", [1.05, 0.15, 0.22], [0, 2.5, 0], steel);
    box(crane, "Crane boom", [0.18, 0.16, 2.8], [0, 2.7, 0.5], steel);
    box(crane, "Crane cabin", [0.43, 0.34, 0.4], [0.35, 2.35, 0.1], darkSteel);
    const cable = box(
      crane,
      "Hoist cable",
      [0.018, 1, 0.018],
      [0, 2, 1.2],
      darkSteel,
    );
    const spreader = box(
      crane,
      "Empty lifting spreader",
      [0.65, 0.07, 0.3],
      [0, 1.5, 1.2],
      marking,
    );
    cranes.push({ cable, spreader, phase: x });
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
  const ship = load("ship-cargo-a", 4.8, [0, 0, -0.7], Math.PI / 2, 0.13);
  const tug = load("boat-tug-a", 1.1, [0, 0, 2], 0, 0.08);
  const loads = [ship.ready, tug.ready];
  for (const [x, z] of [
    [-4.6, 0.7],
    [4.4, 0.5],
  ]) {
    loads.push(load("buoy", 0.23, [x, 0, z], 0, 0.05).ready);
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
    tug.holder.position.z = 1.85 + Math.cos(angle) * 0.8;
    // Models face +Z. Follow the route tangent continuously through turns.
    tug.holder.rotation.y = Math.atan2(
      2.9 * Math.cos(angle),
      -0.8 * Math.sin(angle),
    );
    wake.position.set(tug.holder.position.x, 0.012, tug.holder.position.z);
    wake.rotation.y = tug.holder.rotation.y;
    wake.visible = !reducedMotion;
    for (const { cable, spreader, phase } of cranes) {
      const height = 1.45 + Math.sin(time * settings.craneSpeed + phase) * 0.22;
      spreader.position.y = height;
      cable.scale.y = 2.62 - height;
      cable.position.y = (2.62 + height) / 2;
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
