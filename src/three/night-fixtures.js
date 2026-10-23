import * as T from "three";

// Physical luminaires, restrained surface spill and lit glass. These stay in the
// object's hierarchy, so lifting a building or moving a crane moves its lamps too.
export function createNightFixtures(root) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const plane = new T.PlaneGeometry(1, 1);
  const steel = new T.MeshStandardMaterial({ color: 0x30434a, roughness: .65, metalness: .4 });
  const owned = [], lenses = [], pools = [], spots = [], hooks = [];
  const windowLevel = { value: 0 };
  let disposed = false;

  function block(parent, name, position, size, material = steel) {
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  }
  function mount(parent, position, name) {
    const group = new T.Group();
    group.name = name;
    group.position.set(...position);
    parent.add(group);
    owned.push(group);
    return group;
  }
  function lens(parent, position, size, color) {
    const material = new T.MeshBasicMaterial({ color, toneMapped: false });
    lenses.push({ material, color: new T.Color(color) });
    return block(parent, "Diffused LED lens", position, size, material);
  }
  function flood(parent, position, { color = 0xffd8a0, width = .3 } = {}) {
    const group = mount(parent, position, "Shielded industrial luminaire");
    block(group, "Luminaire housing", [0, .035, 0], [width, .075, .17]);
    lens(group, [0, -.006, 0], [width * .84, .014, .13], color);
    block(group, "Luminaire mounting bracket", [0, .13, -.055], [.045, .19, .045]);
    return group;
  }
  function pole(parent, position, { height = 2.2, color = 0xffe0b0, yaw = 0 } = {}) {
    const group = mount(parent, position, "Street light");
    group.rotation.y = yaw;
    block(group, "Lamp base", [0, .065, 0], [.2, .13, .2]);
    block(group, "Lamp pole", [0, height / 2, 0], [.055, height, .055]);
    block(group, "Lamp arm", [.19, height, 0], [.42, .055, .055]);
    block(group, "Lamp head", [.38, height - .035, 0], [.32, .085, .19]);
    lens(group, [.38, height - .083, 0], [.27, .015, .14], color);
    return { object: group, bulb: [.38, height - .09, 0] };
  }
  function beacon(parent, position, color = 0xf29c59) {
    const group = mount(parent, position, "Navigation beacon");
    block(group, "Beacon mounting foot", [0, -.04, 0], [.13, .08, .13]);
    lens(group, [0, .025, 0], [.065, .075, .065], color);
    return group;
  }
  function pool(parent, position, size, { color = 0xffd8a0, reflection = false } = {}) {
    const uniforms = { level: { value: 0 }, time: { value: 0 }, tint: { value: new T.Color(color) } };
    const material = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, depthTest: true,
      blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float level; uniform float time;
        void main() {
          vec2 p = (vUv - .5) * 2.0;
          float r = dot(p, p);
          float glow = exp(-r * 3.5) * (1.0 - smoothstep(.45, 1.0, r));
          ${reflection ? "glow *= .35 + .65 * pow(.5 + .5 * sin(vUv.y * 95.0 + time * .8 + sin(vUv.x * 12.0)), 3.0);" : ""}
          gl_FragColor = vec4(tint, glow * level * ${reflection ? ".17" : ".13"});
        }`,
    });
    const mesh = new T.Mesh(plane, material);
    mesh.name = reflection ? "Broken harbour light reflection" : "Soft downward light pool";
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(...position);
    mesh.scale.set(size[0], size[1], 1);
    mesh.renderOrder = 5;
    parent.add(mesh);
    owned.push(mesh);
    pools.push(mesh);
    return mesh;
  }
  function spot(parent, position, targetPosition, color = 0xffddad) {
    // One local work light per installation; no shadow-map or bloom render pass.
    const light = new T.SpotLight(color, 0, 8, Math.PI / 3.5, .75, 1.5);
    light.position.set(...position);
    light.target.position.set(...targetPosition);
    parent.add(light, light.target);
    spots.push(light);
    owned.push(light, light.target);
  }
  function building(object) {
    object.traverse((part) => {
      if (!part.isMesh || !/^(building-|low-detail-building-)/.test(part.name)) return;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        if (!material.isMeshStandardMaterial || hooks.some((entry) => entry.material === material)) continue;
        const compile = material.onBeforeCompile, cache = material.customProgramCacheKey;
        const key = cache.call(material);
        hooks.push({ material, compile, cache });
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          shader.uniforms.nightWindowLevel = windowLevel;
          shader.vertexShader = "varying vec3 nightLocalPosition;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
            "#include <begin_vertex>\nnightLocalPosition = position;");
          shader.fragmentShader = "varying vec3 nightLocalPosition;\nuniform float nightWindowLevel;\n" + shader.fragmentShader;
          // This kit's blue glass occupies the atlas column u=.719, v=.35–.48.
          // Illuminate the actual recessed glass geometry, never the walls/roof.
          shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `
            #include <emissivemap_fragment>
            #ifdef USE_MAP
              float glass = (1.0 - step(.018, abs(vUv.x - .71875)))
                          * step(.34, vUv.y) * (1.0 - step(.49, vUv.y));
              vec3 room = floor(nightLocalPosition * vec3(10.0, 7.0, 10.0));
              float occupied = fract(sin(dot(room, vec3(12.9898,78.233,37.719))) * 43758.5453);
              float frame = smoothstep(.05, .13, fract(nightLocalPosition.y * 7.0));
              vec3 interior = mix(vec3(.90,.55,.25), vec3(.66,.77,.81), step(.83, occupied));
              totalEmissiveRadiance += interior * glass * step(.34, occupied) * frame * nightWindowLevel * .42;
            #endif
          `);
        };
        material.customProgramCacheKey = () => `${key}:occupied-night-windows-v1`;
        material.needsUpdate = true;
      }
    });
  }
  return {
    flood, pole, beacon, pool, spot, building,
    update(night, opacity, time, reducedMotion) {
      if (disposed) return;
      windowLevel.value = night;
      for (const { material, color } of lenses) material.color.copy(color).multiplyScalar(.16 + night * .74);
      for (const mesh of pools) {
        mesh.visible = night * opacity > .002;
        mesh.material.uniforms.level.value = night * opacity;
        mesh.material.uniforms.time.value = reducedMotion ? 0 : time;
      }
      for (const light of spots) light.intensity = night * opacity * .75;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      owned.forEach((part) => part.parent?.remove(part));
      lenses.forEach(({ material }) => material.dispose());
      pools.forEach((mesh) => mesh.material.dispose());
      hooks.forEach(({ material, compile, cache }) => {
        material.onBeforeCompile = compile;
        material.customProgramCacheKey = cache;
        material.needsUpdate = true;
      });
      geometry.dispose(); plane.dispose(); steel.dispose();
    },
  };
}
