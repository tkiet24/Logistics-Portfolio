import * as T from "three";
export function createScene(ctx) {
  const { config } = ctx,
    FY = config.layout.floorY,
    RAIL_Z = config.port.railZ;
  const S = new T.Group();
  S.name = "Coffee processing factory";
  const loadGLB = ctx.load;
  const FKP = "kits/factory-kit/Models/GLB format/",
    fkBoxes = [];
  const U = config.factory.unit,
    X0 = config.factory.originX,
    Z0 = config.factory.originZ,
    FL = FY + 0.02,
    PI = Math.PI;
  const fkTick = (dt) => {
    if (ctx.reducedMotion()) return;
    fkBoxes.forEach((b) => {
      b.position.x += dt * config.factory.conveyorSpeed;
      if (b.position.x > X0 + 8.8 * U) b.position.x = X0 + 3.2 * U;
    });
  };
  function fkLoad(name, cb) {
    return loadGLB(FKP + name + ".glb", cb).catch(ctx.error);
  }
  /* raw kit pieces: 1 kit unit = U world units, origin kept so pieces snap on the grid */
  function fkW(name, x, y, z, ry, s, cb) {
    fkLoad(name, (m) => {
      const h = new T.Group();
      h.add(m);
      h.scale.setScalar(s);
      h.rotation.y = ry || 0;
      h.position.set(x, y, z);
      S.add(h);
      if (cb) cb(h);
    });
  }
  const fkG = (name, gx, gz, o = {}) =>
    fkW(
      name,
      X0 + gx * U,
      FL + (o.y || 0) * U,
      Z0 + gz * U,
      o.ry,
      (o.s || 1) * U,
      o.cb,
    );
  const FW = 10; /* hall width in kit units */
  /* floor: large tiles with checkerboard accents */
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      fkG(
        (i + j) % 2 ? "top-large-checkerboard" : "floor-large",
        2 + i * 2,
        2.2 + j * 2,
      );
  /* U-shaped hall: back wall, two wings, corners */
  fkG("structure-corner-outer", 0, 0, { ry: PI });
  fkG("structure-corner-outer", FW, 0, { ry: PI / 2 });
  [
    "structure-wall",
    "structure-window",
    "structure-doorway",
    "structure-window",
    "structure-wall",
    "structure-doorway",
    "structure-window",
    "structure-wall",
  ].forEach((n, i) => fkG(n, 1 + i, 0, { ry: PI }));
  [1.5, 2.5, 3.5].forEach((z, i) => {
    fkG(i === 1 ? "structure-window" : "structure-wall", 0, z + 0.0, {
      ry: -PI / 2,
    });
    fkG(i === 1 ? "structure-window" : "structure-wall", FW, z, {
      ry: PI / 2,
    });
  });
  /* stairs and catwalk against the back wall */
  fkG("catwalk-stairs", 2.2, 1.6, { ry: PI });
  fkG("catwalk-straight", 4.2, 1.2, { y: 1.4 });
  fkG("catwalk-straight", 5.2, 1.2, { y: 1.4 });
  /* production line: hopper -> machine -> conveyor -> machine -> robot arm */
  fkG("hopper-high-round", 2, 3.4);
  fkG("machine-window", 3.2, 3.6, { ry: PI / 2 });
  [4.6, 6.6, 8.6].forEach((x, i) =>
    fkG("conveyor-long", x, 3.6, {
      cb:
        i === 0
          ? () =>
              [3.4, 5.4, 7.2].forEach((bx2, n) =>
                fkG(["box-small", "box-large", "box-small"][n], bx2, 3.6, {
                  y: 0.4,
                  cb: (b) => fkBoxes.push(b),
                }),
              )
          : null,
    }),
  );
  fkG("machine", 5.4, 2.3, { ry: PI });
  fkG("machine-fortified", 7, 2.3, { ry: PI });
  fkG("hopper-square", 8.6, 2.3);
  fkG("robot-arm-a", 3.6, 2.4);
  fkG("robot-arm-b", 9.4, 4.4, { ry: -PI / 2 });
  fkG("pipe-large-long", 6, 0.9, { y: 1.9 });
  fkG("pipe-large-long", 8, 0.9, { y: 1.9 });
  fkG("pipe-large-bend", 9.4, 1.7, { y: 1.9, ry: PI / 2 });
  /* front yard: hazard markings, cones, boxes, control props */
  fkG("indicator-special-cross", 3, 6.4);
  fkG("indicator-special-lines", 7, 6.6);
  fkG("indicator-special-arrow", 5, 6.4);
  fkG("box-large", 8.8, 5.6);
  fkG("box-large", 9.6, 6.1, { y: 0 });
  fkG("box-small", 8.9, 5.6, { y: 0.55 });
  fkG("scanner-low", 1.6, 5.2, { ry: PI / 2 });
  fkG("screen-wide", 1.4, 4.2, { ry: PI / 2 });
  fkG("lever-single", 2.4, 5.6);
  [
    [1.4, 6.8],
    [4.1, 5.6],
    [6.2, 6.3],
    [9.3, 6.9],
    [0.8, 3.1],
  ].forEach(([x, z]) => fkG("cone", x, z));
  fkG("warning-traffic", 6.8, 5.5);
  fkG("warning-orange", 4.8, 5.7);
  /* gate where the rails begin */
  fkW("structure-doorway-wide", 19.3, FY, RAIL_Z, -PI / 2, U);
  [1.5, 2.5, -1.5, -2.5].forEach((o) =>
    fkW("structure-wall", 19.3, FY, RAIL_Z + o * U, -PI / 2, U),
  );
  ctx.shadow(S, X0 + 5 * U, Z0 + 3 * U, 11 * U, 8 * U, FY + 0.01);
  return {
    group: S,
    animated: true,
    update({ dt }) {
      fkTick(dt);
    },
  };
}
