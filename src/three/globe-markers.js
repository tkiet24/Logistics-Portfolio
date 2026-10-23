import * as T from "three";

/** Compact navigation terminals seated tangentially on the globe. */
export function createGlobeMarker(point, index) {
  const group = new T.Group();
  group.name = index ? "Arrival beacon" : "Departure beacon";
  group.position.copy(point).multiplyScalar(1.012);
  group.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), point.clone().normalize());
  const ink = new T.MeshBasicMaterial({ color: 0x173b3b });
  const ivory = new T.MeshBasicMaterial({ color: 0xfff6df });
  const accent = new T.MeshBasicMaterial({ color: index ? 0xe6b76c : 0x70dac9 });
  const backing = new T.Mesh(new T.CircleGeometry(0.115, 40), ink);
  const rim = new T.Mesh(new T.RingGeometry(0.086, 0.105, 40), ivory);
  rim.position.z = 0.002;
  const core = new T.Mesh(new T.CircleGeometry(index ? 0.035 : 0.048, 32), accent);
  core.position.z = 0.004;
  group.add(backing, rim, core);
  if (index) {
    const ring = new T.Mesh(new T.RingGeometry(0.05, 0.061, 32), accent);
    ring.position.z = 0.004;
    group.add(ring);
  }
  const anchor = new T.Vector3(), center = new T.Vector3(),
    view = new T.Vector3(), normal = new T.Vector3();
  return {
    group,
    update(camera) {
      if (!camera || !group.parent) return;
      group.getWorldPosition(anchor);
      group.parent.getWorldPosition(center);
      camera.getWorldPosition(view);
      normal.subVectors(anchor, center);
      group.visible = normal.dot(view.sub(anchor)) > 0;
    },
  };
}
