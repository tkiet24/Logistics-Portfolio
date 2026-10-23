import * as T from "three";
import { createRandom } from "../core/math.js";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Bake a lit cloud volume once. Moving clouds then cost just one textured quad
// each, with no ray marching in the animation loop and no image downloads.
const fragmentShader = `
  varying vec2 vUv;
  uniform float seed;
  float hash(vec3 p) {
    p = fract(p * .3183099 + vec3(.11, .23, .37));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    return .57 * noise(p) + .28 * noise(p * 2.07) + .15 * noise(p * 4.13);
  }
  float density(vec3 p) {
    float shape = 1.0 - length((p - vec3(-.83,-.08,0)) / vec3(1.0,.58,.67));
    shape = max(shape, 1.0 - length((p - vec3(-.12,.2,.06)) / vec3(.86,.89,.74)));
    shape = max(shape, 1.0 - length((p - vec3(.68,.02,-.04)) / vec3(.89,.65,.69)));
    shape = max(shape, 1.0 - length((p - vec3(1.2,-.22,0)) / vec3(.7,.34,.5)));
    float erosion = fbm(p * 3.1 + vec3(seed * 19.7)) - .5;
    return max(0.0, shape + erosion * .6 - .08) * 3.2 * smoothstep(-.7,-.3,p.y);
  }
  void main() {
    vec2 p = (vUv - .5) * vec2(4.8, 2.4);
    vec3 light = normalize(vec3(.65, .85, 1.0));
    float transmit = 1.0;
    vec3 colour = vec3(0.0);
    for (int i = 0; i < 28; i++) {
      vec3 samplePoint = vec3(p, 1.15 - float(i) * .085);
      float d = density(samplePoint);
      if (d > .001) {
        float shadow = density(samplePoint + light * .23) * .8
                     + density(samplePoint + light * .55) * .55;
        float sunlight = exp(-shadow * 1.65);
        vec3 ink = mix(vec3(.52,.64,.70), vec3(1.0,.985,.94), sunlight);
        ink += vec3(.09,.07,.035) * pow(sunlight, 4.0);
        float alpha = 1.0 - exp(-d * .21);
        colour += transmit * ink * alpha;
        transmit *= 1.0 - alpha;
      }
      if (transmit < .015) break;
    }
    float alpha = 1.0 - transmit;
    gl_FragColor = vec4(colour / max(alpha, .001), alpha);
  }
`;

export function createSkyClouds({ mobile }) {
  const group = new T.Group();
  group.name = "Drifting cloud layers";
  const geometry = new T.PlaneGeometry(1, 1);
  const random = createRandom(8103);
  const targets = Array.from({ length: 3 }, () => new T.WebGLRenderTarget(
    mobile ? 256 : 512, mobile ? 128 : 256,
    { depthBuffer: false, stencilBuffer: false },
  ));
  const clouds = Array.from({ length: mobile ? 5 : 9 }, (_, i) => {
    const far = i % 3 === 0;
    const width = far ? .8 + random() * .6 : 1.0 + random() * .9;
    const material = new T.MeshBasicMaterial({
      map: targets[i % targets.length].texture,
      transparent: true, opacity: 1, depthWrite: false, depthTest: false,
      toneMapped: false,
    });
    const mesh = new T.Mesh(geometry, material);
    mesh.name = far ? "High cloud bank" : "Sunlit cumulus";
    mesh.renderOrder = 2 + (far ? 0 : 1);
    mesh.position.z = far ? -2 : -1;
    mesh.scale.set(width, width * (far ? .23 : .40), 1);
    group.add(mesh);
    return {
      mesh, width, far,
      start: (i + .35) / (mobile ? 5 : 9),
      y: far ? .19 + random() * .22 : .48 + random() * .48,
      speed: far ? .003 : .006 + random() * .003,
      opacity: far ? .5 : .88,
    };
  });
  let prepared = false;
  return {
    group,
    prepare(renderer) {
      if (prepared) return;
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10);
      camera.position.z = 1;
      const material = new T.ShaderMaterial({
        uniforms: { seed: { value: 0 } }, vertexShader, fragmentShader,
        depthTest: false, depthWrite: false,
      });
      const plane = new T.Mesh(new T.PlaneGeometry(2, 2), material);
      scene.add(plane);
      const previous = renderer.getRenderTarget();
      try {
        targets.forEach((target, index) => {
          material.uniforms.seed.value = index + 1;
          renderer.setRenderTarget(target);
          renderer.clear();
          renderer.render(scene, camera);
        });
        prepared = true;
      } finally {
        renderer.setRenderTarget(previous);
        plane.geometry.dispose();
        material.dispose();
      }
    },
    update(time, aspect, progress, nightMix) {
      clouds.forEach(({ mesh, width, start, y, speed, opacity, far }) => {
        const span = aspect * 2 + width * 2;
        const travel = start * span + time * speed - progress * (far ? .08 : .18);
        mesh.position.x = ((travel % span) + span) % span - span / 2;
        mesh.position.y = y + Math.sin(time * .018 + start * 9) * .012;
        mesh.material.opacity = opacity * (1 - nightMix * .93);
        mesh.material.color.setRGB(1 - nightMix * .64, 1 - nightMix * .56, 1 - nightMix * .43);
      });
    },
    dispose() {
      geometry.dispose();
      clouds.forEach(({ mesh }) => mesh.material.dispose());
      targets.forEach((target) => target.dispose());
    },
  };
}
