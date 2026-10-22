import * as T from "three";

/** Radial landing beacons: segmented radar, raised gem and a breathing halo. */
export function createGlobeMarker(point, colour, index) {
  const group = new T.Group();
  group.name = index ? "Arrival beacon" : "Departure beacon";
  group.position.copy(point);
  group.quaternion.setFromUnitVectors(
    new T.Vector3(0, 0, 1),
    point.clone().normalize(),
  );
  const solid = new T.MeshBasicMaterial({ color: colour });
  const haloMaterial = new T.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const base = new T.Mesh(new T.RingGeometry(0.045, 0.065, 6), solid);
  const gem = new T.Mesh(new T.OctahedronGeometry(0.038), solid);
  gem.position.z = 0.09;
  const stem = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.07, 6), solid);
  stem.rotation.x = Math.PI / 2;
  stem.position.z = 0.045;
  const radar = new T.Group();
  for (let i = 0; i < 3; i++) {
    const arc = new T.Mesh(
      new T.RingGeometry(
        0.108,
        0.12,
        20,
        1,
        (i * Math.PI * 2) / 3,
        Math.PI * 0.48,
      ),
      solid,
    );
    radar.add(arc);
  }
  for (let i = 0; i < 4; i++) {
    const tick = new T.Mesh(new T.PlaneGeometry(0.032, 0.008), solid);
    const angle = (i * Math.PI) / 2;
    tick.position.set(Math.cos(angle) * 0.155, Math.sin(angle) * 0.155, 0);
    tick.rotation.z = angle;
    group.add(tick);
  }
  const halo = new T.Mesh(new T.RingGeometry(0.07, 0.085, 40), haloMaterial);
  group.add(base, stem, gem, radar, halo);
  return {
    group,
    update(time, reducedMotion, fadeMaterial) {
      const phase = reducedMotion ? 0.3 : (time * 0.4 + index * 0.5) % 1;
      halo.scale.setScalar(1 + phase * 1.25);
      fadeMaterial(haloMaterial, 1 - phase);
      radar.rotation.z = reducedMotion ? 0 : time * (index ? -0.16 : 0.16);
      gem.rotation.z = reducedMotion ? 0 : time * 0.4;
    },
  };
}
