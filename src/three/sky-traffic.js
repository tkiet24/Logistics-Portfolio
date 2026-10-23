import * as T from "three";

const TAU = Math.PI * 2;
const wrap = (value, length) => ((value % length) + length) % length;

function foil(points, thickness) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 1,
  }).translate(0, 0, -thickness / 2);
}

// Bake a gentle sunlight/underside gradient into native geometry. No lights,
// textures, shader patches, or extra material groups are needed in the sky scene.
function combine(parts, shaded = false) {
  const positions = [], colors = [];
  const normal = new T.Vector3(), sun = new T.Vector3(-0.3, 0.6, 1).normalize();
  for (const [geometry, tint = 0xffffff] of parts) {
    const position = geometry.attributes.position, normals = geometry.attributes.normal;
    const color = new T.Color(tint), count = geometry.index?.count ?? position.count;
    for (let i = 0; i < count; i++) {
      const index = geometry.index ? geometry.index.getX(i) : i;
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      if (shaded) {
        normal.fromBufferAttribute(normals, index);
        const light = 0.57 + 0.29 * Math.max(0, normal.dot(sun)) + 0.14 * Math.max(0, normal.z);
        colors.push(color.r * light, color.g * light, color.b * light);
      }
    }
    geometry.dispose();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  if (shaded) geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function airlinerGeometry(detail) {
  const parts = [], white = 0xfffcf3;
  const add = (geometry, color = white) => parts.push([geometry, color]);
  // Local +X is the nose, Y the wingspan, and +Z the dorsal surface.
  for (const side of [-1, 1]) {
    add(new T.SphereGeometry(1, detail, 8)
      .scale(0.095, 0.033, 0.033).translate(0.025, side * 0.18, -0.058), 0xe6edf0);
    add(new T.CircleGeometry(0.024, detail)
      .rotateY(Math.PI / 2).translate(0.115, side * 0.18, -0.058), 0x354450);
    add(foil([
      [0.14, side * 0.035], [-0.15, side * 0.5], [-0.235, side * 0.5],
      [-0.175, side * 0.17], [-0.23, side * 0.035],
    ], 0.014), 0xf1f2ee);
    add(foil([
      [-0.36, side * 0.025], [-0.515, side * 0.19],
      [-0.58, side * 0.18], [-0.52, side * 0.025],
    ], 0.01).translate(0, 0, 0.018));
  }
  const profile = [
    [0, -0.59], [0.016, -0.53], [0.038, -0.40], [0.052, -0.24],
    [0.054, 0.28], [0.048, 0.43], [0.033, 0.52], [0.013, 0.565], [0, 0.575],
  ].map(([radius, x]) => new T.Vector2(radius, x));
  add(new T.LatheGeometry(profile, detail).rotateZ(-Math.PI / 2));
  // The fin is an actual vertical extrusion, exposed by the slight cruise bank.
  add(foil([
    [-0.51, 0.025], [-0.565, 0.225], [-0.465, 0.21], [-0.29, 0.025],
  ], 0.016).rotateX(Math.PI / 2), 0xc74d43);
  add(new T.SphereGeometry(1, detail, 6)
    .scale(0.042, 0.034, 0.014).translate(0.46, 0, 0.043), 0x506777);
  return combine(parts, true);
}

function contrailGeometry() {
  const positions = [], colors = [], indices = [], steps = 40;
  const across = [-0.5, -0.22, 0, 0.22, 0.5], feather = [0, 0.7, 1, 0.7, 0];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const width = Math.pow(1 - u, 0.65);
    const fade = T.MathUtils.smoothstep(u, 0, 0.045) * Math.pow(1 - u, 1.4);
    const drift = 1.1 * u * u * Math.sin(u * 2.4);
    for (let j = 0; j < across.length; j++) {
      positions.push(-u, drift + across[j] * width, 0);
      // r128 supports RGBA vertex colors: soft edges and a continuous tail fade.
      colors.push(1, 1, 0.98, fade * feather[j]);
      if (i < steps && j < across.length - 1) {
        const a = i * across.length + j, b = a + across.length;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function birdGeometries() {
  const body = combine([
    [new T.SphereGeometry(1, 10, 6).scale(0.006, 0.0021, 0.0022)],
    [new T.SphereGeometry(0.0018, 8, 6).translate(0.0052, 0, 0.0005)],
    [foil([[0.0058, 0.001], [0.0094, 0], [0.0058, -0.001]], 0.001)],
    [foil([[-0.004, 0.0012], [-0.01, 0.003], [-0.0085, 0],
      [-0.01, -0.003], [-0.004, -0.0012]], 0.0006)],
  ], true);
  const inner = foil([
    [0.0028, 0], [0.002, 0.005], [-0.001, 0.013],
    [-0.0058, 0.013], [-0.0048, 0.007], [-0.004, 0],
  ], 0.0006);
  const outer = foil([
    [0, 0], [0.001, 0.004], [-0.0028, 0.0115], [-0.0041, 0.013],
    [-0.0042, 0.009], [-0.0057, 0.011], [-0.0055, 0.0074],
    [-0.0068, 0.0085], [-0.0061, 0.0045], [-0.0048, 0],
  ], 0.0004);
  return [body, combine([[inner]], true), combine([[outer]], true)];
}

/**
 * Small traffic for an orthographic sky: x [-aspect, aspect], y [-1, 1], +Z camera.
 * time is in seconds; progress is normalized. Add day/night to the background
 * scene and call update after resizing. All resources belong to this instance.
 */
export function createSkyTraffic({ mobile = false } = {}) {
  const day = new T.Group(), night = new T.Group();
  day.name = "Day air traffic";
  night.name = "Night bird flock";
  const materials = [], geometries = [], batches = [];
  function material(color, opacity, vertexColors = false) {
    const value = new T.MeshBasicMaterial({
      color, opacity, vertexColors, transparent: true, depthWrite: false,
      depthTest: false, fog: false, toneMapped: false,
    });
    value.userData.baseOpacity = opacity;
    materials.push(value);
    return value;
  }
  function batch(group, geometry, paint, count, name, order) {
    const mesh = new T.InstancedMesh(geometry, paint, count);
    mesh.name = name;
    mesh.renderOrder = order;
    // r128 has no instance-aware bounds; a few tiny batches are cheaper to keep.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    group.add(mesh);
    geometries.push(geometry);
    batches.push(mesh);
    return mesh;
  }
  const planePaint = material(0xffffff, 0.96, true);
  const trailPaint = material(0xffffff, 0.28, true);
  trailPaint.side = T.DoubleSide;
  // Moonlit plumage stays legible against both the dark sky and drifting clouds.
  const birdPaint = material(0xf4e5c7, 1, true);
  birdPaint.side = T.DoubleSide;
  const flights = [
    { span: 0.106, length: 0.53, period: 116, y: 0.745, start: -0.38, direction: 1, phase: 0.4 },
    ...(!mobile ? [{ span: 0.079, length: 0.39, period: 147, y: 0.445, start: 0.58, direction: -1, phase: 2.1 }] : []),
  ].map((flight) => {
    const root = new T.Object3D(), model = new T.Object3D();
    const wakes = [new T.Object3D(), new T.Object3D()];
    model.scale.setScalar(flight.span);
    root.add(model, ...wakes);
    wakes.forEach((wake) => wake.scale.set(flight.length, 0.003, 1));
    return { ...flight, root, model, wakes };
  });
  // Insert trails first at the same render order as aircraft; both sit under clouds.
  const trails = batch(day, contrailGeometry(), trailPaint, flights.length * 2, "Twin tapered contrails", 1);
  const planes = batch(day, airlinerGeometry(mobile ? 12 : 18), planePaint, flights.length, "Cruising airliners", 1);
  const formation = mobile ? [
    [0.16, 0, 1, 0.4], [0.01, 0.047, 0.92, 2.2],
    [-0.15, 0.08, 0.91, 4.5], [-0.09, -0.058, 0.97, 3.5],
  ] : [
    [0.19, 0, 1, 0.15], [0.08, 0.035, 0.92, 1.7],
    [-0.035, 0.067, 0.97, 3.3], [-0.15, 0.088, 0.86, 4.6],
    [0.065, -0.033, 0.93, 2.4], [-0.05, -0.064, 1.02, 4],
    [-0.18, -0.09, 0.90, 5.5],
  ];
  const birds = formation.map(([x, y, scale, phase]) => {
    const root = new T.Object3D();
    root.scale.setScalar(scale * (mobile ? 1.7 : 1.55));
    const wings = [-1, 1].map((side) => {
      const shoulder = new T.Object3D(), wrist = new T.Object3D();
      shoulder.position.set(0.001, side * 0.0014, 0);
      wrist.position.set(-0.001, 0.013, 0);
      shoulder.add(wrist);
      root.add(shoulder);
      return { side, shoulder, wrist };
    });
    return { x, y, phase, root, wings };
  });
  const [bodyGeometry, innerGeometry, outerGeometry] = birdGeometries();
  const bodies = batch(night, bodyGeometry, birdPaint, birds.length, "Bird bodies, beaks and forked tails", 5);
  const innerWings = batch(night, innerGeometry, birdPaint, birds.length * 2, "Bird shoulder wings", 5);
  const outerWings = batch(night, outerGeometry, birdPaint, birds.length * 2, "Bird articulated primaries", 5);
  const emitter = new T.Vector3();
  let elapsed = 0, lastTime = null, wasReduced = false, aspect = 1, disposed = false;

  function pose(seconds, progress) {
    flights.forEach((flight, i) => {
      const { root, model, wakes, direction, phase, span } = flight;
      // Both ends include the *whole* wake, so wrapping never cuts a visible trail.
      const limit = aspect + flight.length + 0.13, distance = limit * 2;
      const speed = distance / flight.period;
      const bob = seconds * 0.075 + phase;
      root.position.set(
        wrap(flight.start * aspect + limit + direction * seconds * speed, distance) - limit,
        flight.y + 0.009 * Math.sin(bob) - 0.006 * progress,
        1.15 + i * 0.12,
      );
      root.rotation.z = Math.atan2(0.000675 * Math.cos(bob), direction * speed);
      model.rotation.set(0.43 + 0.045 * Math.sin(seconds * 0.12 + phase), 0.075, 0);
      wakes.forEach((wake, j) => {
        emitter.set(-0.075, (j ? 1 : -1) * 0.18, -0.058)
          .applyEuler(model.rotation).multiplyScalar(span);
        wake.position.copy(emitter);
        wake.position.z -= 0.004;
      });
      root.updateMatrixWorld(true);
      planes.setMatrixAt(i, model.matrixWorld);
      wakes.forEach((wake, j) => trails.setMatrixAt(i * 2 + j, wake.matrixWorld));
    });

    const limit = aspect + 0.29, distance = limit * 2;
    const flockX = wrap(0.18 * aspect + limit + seconds * distance / 126, distance) - limit;
    birds.forEach((bird, i) => {
      const { root, phase, wings } = bird;
      const cycle = wrap(seconds + phase * 1.4, 10.6 + i * 0.23);
      const glide = T.MathUtils.smoothstep(cycle, 5.1, 6.1)
        * (1 - T.MathUtils.smoothstep(cycle, 8.5, 9.6));
      const beat = seconds * TAU * (1.65 + i * 0.045) + phase;
      const flap = 0.12 + (1 - glide) * (0.68 * Math.sin(beat) + 0.09 * Math.sin(2 * beat));
      root.position.set(
        flockX + bird.x + 0.005 * Math.sin(seconds * 0.31 + phase),
        0.665 + bird.y + 0.009 * Math.sin(seconds * 0.21 + phase)
          + 0.003 * (1 - glide) * Math.sin(beat - 0.5) - 0.004 * progress,
        1.55 + i * 0.012,
      );
      root.rotation.set(
        0.20 + 0.08 * Math.sin(seconds * 0.23 + phase),
        0.32 + 0.04 * Math.sin(seconds * 0.19 + phase),
        0.035 * Math.sin(seconds * 0.27 + phase),
      );
      wings.forEach(({ side, shoulder, wrist }) => {
        shoulder.rotation.set(side === 1 ? flap : Math.PI - flap, 0,
          side * (0.035 + 0.05 * (1 - glide) * Math.cos(beat)));
        wrist.rotation.set(0.10 + (1 - glide) * 0.38 * Math.sin(beat - 0.65), 0,
          0.14 + (1 - glide) * 0.08 * Math.cos(beat - 0.4));
      });
      root.updateMatrixWorld(true);
      bodies.setMatrixAt(i, root.matrixWorld);
      wings.forEach(({ shoulder, wrist }, j) => {
        innerWings.setMatrixAt(i * 2 + j, shoulder.matrixWorld);
        outerWings.setMatrixAt(i * 2 + j, wrist.matrixWorld);
      });
    });
    batches.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
  }

  function update({ time, aspect: nextAspect, progress = 0, reducedMotion = false } = {}) {
    if (disposed) return;
    if (Number.isFinite(nextAspect) && nextAspect > 0) aspect = nextAspect;
    if (Number.isFinite(time)) {
      if (lastTime !== null && !reducedMotion && !wasReduced) {
        elapsed += Math.max(0, time - lastTime);
      }
      // Sample even while paused; also discard the first resumed interval. This
      // works with either a frozen outer clock or a continuously ticking one.
      lastTime = time;
    }
    wasReduced = !!reducedMotion;
    pose(reducedMotion ? 0 : elapsed,
      reducedMotion || !Number.isFinite(progress) ? 0 : T.MathUtils.clamp(progress, 0, 1));
  }

  function setNightMix(value) {
    if (disposed || !Number.isFinite(value)) return;
    const mix = T.MathUtils.clamp(value, 0, 1);
    planePaint.opacity = planePaint.userData.baseOpacity * (1 - mix);
    trailPaint.opacity = trailPaint.userData.baseOpacity * (1 - mix);
    birdPaint.opacity = birdPaint.userData.baseOpacity * mix;
    day.visible = planePaint.opacity >= 0.001;
    night.visible = birdPaint.opacity >= 0.001;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    batches.forEach((mesh) => mesh.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((paint) => paint.dispose());
    for (const group of [day, night]) {
      if (group.parent) group.parent.remove(group);
      group.clear();
      group.visible = false;
    }
  }

  pose(0, 0);
  setNightMix(0);
  return { day, night, update, setNightMix, dispose };
}
