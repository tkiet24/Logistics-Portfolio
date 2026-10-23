import * as T from "three";

export function createCheckpoint(ctx, index) {
  const group = new T.Group();
  group.name = `Journey checkpoint ${index + 1}`;
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.07, 0.12, -0.29, 0.39, -0.29, 0.59);
  shape.bezierCurveTo(-0.29, 0.97, 0.29, 0.97, 0.29, 0.59);
  shape.bezierCurveTo(0.29, 0.39, 0.07, 0.12, 0, 0);
  const hole = new T.Path();
  hole.absarc(0, 0.61, 0.135, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const red = new T.MeshStandardMaterial({
    color: 0xd90b13,
    roughness: 0.3,
    metalness: 0.12,
  });
  const rim = new T.MeshStandardMaterial({
    color: 0x8e0710,
    roughness: 0.4,
    metalness: 0.18,
  });
  const pin = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.075,
      steps: 1,
      curveSegments: ctx.quality.mobile ? 16 : 28,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 3,
    }),
    [red, rim],
  );
  pin.name = "Red location pin";
  pin.position.set(0, 0.04, -0.0375);
  const centre = new T.Mesh(
    new T.CircleGeometry(0.131, 32),
    new T.MeshBasicMaterial({ color: 0xfffaf2, side: T.DoubleSide }),
  );
  centre.name = "White inset";
  centre.position.set(0, 0.61, 0.038);
  pin.add(centre);
  const footprint = new T.Mesh(
    new T.CircleGeometry(0.16, 24),
    new T.MeshBasicMaterial({
      color: 0x182220,
      opacity: 0.22,
      transparent: true,
      depthWrite: false,
    }),
  );
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = 0.012;
  footprint.scale.y = 0.6;
  group.add(pin, footprint);
  group.userData.checkpointIndex = index;
  return {
    group,
    setState(activeIndex) {
      const active = index === activeIndex;
      group.userData.state = active
        ? "active"
        : index < activeIndex
          ? "complete"
          : "upcoming";
      red.color.setHex(
        active ? 0xf10d19 : index < activeIndex ? 0xc52229 : 0xb51b24,
      );
      pin.scale.setScalar(active ? 1.12 : 0.92);
    },
  };
}
