import * as T from "three";
import { createRandom, damp } from "../core/math.js";
import { createSkyClouds } from "./sky-clouds.js";
import { createSkyTraffic } from "./sky-traffic.js";
import { skyVertex, skyFragment, discFragment, starVertex, starFragment } from "./sky-shaders.js";

export function createEnvironment(config, quality) {
  // A dedicated pass keeps the sky behind transparent lettering, glass and shadows.
  const scene = new T.Scene();
  scene.name = "Day and night sky";
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 30);
  camera.position.z = 10;
  const uniforms = {
    nightMix: { value: 0 }, aspect: { value: 1 },
    lightPosition: { value: new T.Vector2(.63, .73) },
    time: { value: 0 }, progress: { value: 0 }, pixelRatio: { value: 1 },
  };
  const plane = new T.PlaneGeometry(2, 2);
  const backdrop = new T.Mesh(plane, new T.ShaderMaterial({
    uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
    transparent: true, depthTest: false, depthWrite: false,
  }));
  backdrop.name = "Atmospheric scattering";
  backdrop.renderOrder = -10;
  scene.add(backdrop);
  const random = createRandom(231019), count = quality.mobile ? 160 : 380;
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count);
  const phases = new Float32Array(count), tints = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions.set([random() * 2 - 1, .12 + random() * .88, 0], i * 3);
    sizes[i] = 1.2 + Math.pow(random(), 3) * 3.1;
    phases[i] = random() * Math.PI * 2;
    const warm = random();
    tints.set([.75 + warm * .25, .83 + warm * .12, 1 - warm * .18], i * 3);
  }
  const starGeometry = new T.BufferGeometry();
  starGeometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  starGeometry.setAttribute("size", new T.BufferAttribute(sizes, 1));
  starGeometry.setAttribute("phase", new T.BufferAttribute(phases, 1));
  starGeometry.setAttribute("tint", new T.BufferAttribute(tints, 3));
  const stars = new T.Points(starGeometry, new T.ShaderMaterial({
    uniforms, vertexShader: starVertex, fragmentShader: starFragment,
    transparent: true, depthWrite: false, depthTest: false,
  }));
  stars.name = "Distant stars";
  stars.frustumCulled = false;
  stars.renderOrder = -8;
  scene.add(stars);
  const disc = new T.Mesh(plane, new T.ShaderMaterial({
    uniforms, vertexShader: skyVertex, fragmentShader: discFragment,
    transparent: true, depthWrite: false, depthTest: false,
  }));
  disc.name = "Sun and lunar surface";
  disc.scale.setScalar(quality.mobile ? .061 : .074);
  disc.renderOrder = -6;
  scene.add(disc);
  const clouds = createSkyClouds(quality), traffic = createSkyTraffic(quality);
  scene.add(clouds.group, traffic.day, traffic.night);
  let aspect = 1, nightMix = 0, targetNight = 0, initialized = false, disposed = false;
  return {
    scene, camera,
    get nightMix() { return nightMix; },
    prepare(renderer) { clouds.prepare(renderer); },
    resize(width, height, pixelRatio = 1) {
      aspect = width / Math.max(1, height);
      camera.left = -aspect;
      camera.right = aspect;
      camera.updateProjectionMatrix();
      backdrop.scale.x = aspect;
      uniforms.aspect.value = aspect;
      uniforms.pixelRatio.value = pixelRatio;
    },
    theme(tokens) {
      const colour = new T.Color(tokens.background);
      targetNight = (colour.r + colour.g + colour.b) / 3 < .4 ? 1 : 0;
      if (!initialized) { nightMix = targetNight; initialized = true; }
    },
    update({ dt, time, progress, reducedMotion }) {
      nightMix = reducedMotion ? targetNight : damp(nightMix, targetNight, 3.2, dt);
      if (Math.abs(nightMix - targetNight) < .001) nightMix = targetNight;
      uniforms.nightMix.value = nightMix;
      disc.scale.setScalar((quality.mobile ? .061 : .074) * (1 + nightMix * .28));
      uniforms.time.value = time;
      uniforms.progress.value = progress;
      const lightX = aspect * .63 - Math.sin(progress * .5) * .07;
      const lightY = .73 + Math.sin(progress * .8) * .025;
      uniforms.lightPosition.value.set(lightX, lightY);
      disc.position.set(lightX, lightY, -3);
      stars.visible = nightMix > .001;
      clouds.update(time, aspect, progress, nightMix);
      traffic.setNightMix(nightMix);
      traffic.update({ time, aspect, progress, reducedMotion });
      return !reducedMotion || nightMix !== targetNight;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      plane.dispose();
      starGeometry.dispose();
      [backdrop, stars, disc].forEach((item) => item.material.dispose());
      clouds.dispose();
      traffic.dispose();
    },
  };
}
