import * as T from "three";
import { clamp } from "../core/math.js";
export function createScene(ctx) {
  const { config, quality } = ctx,
    ACC = config.palette.accent;
  const C = new T.Group();
  C.position.set(config.layout.sceneSpacing * 4, -0.35, 0);
  C.rotation.y = config.contact.rotationY;
  C.scale.setScalar(config.contact.scale);

  const wm = new T.MeshStandardMaterial({
    color: ACC,
    roughness: 0.5,
    metalness: 0.2,
  });
  const wall = (w, h, d, x, y, z) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), wm);
    m.position.set(x, y, z);
    C.add(m);
  };
  wall(0.05, 1, 2.4, -0.5, 0.5, 0);
  wall(0.05, 1, 2.4, 0.5, 0.5, 0);
  wall(1, 0.05, 2.4, 0, 0, 0);
  wall(1, 0.05, 2.4, 0, 1, 0);
  wall(1, 1, 0.05, 0, 0.5, -1.2);
  const glow = new T.Mesh(
    new T.PlaneGeometry(0.9, 0.9),
    new T.MeshBasicMaterial({ color: 0xffb79d }),
  );
  glow.position.set(0, 0.5, -1.15);
  C.add(glow);
  const pl = new T.PointLight(0xffb79d, 0, 9);
  pl.position.set(0, 0.5, 0);
  C.add(pl);
  const doors = [-1, 1].map((sg) => {
    const p = new T.Group();
    p.position.set(sg * 0.5, 0.5, 1.2);
    const d = new T.Mesh(new T.BoxGeometry(0.5, 1, 0.04), wm);
    d.position.x = -sg * 0.25;
    p.add(d);
    C.add(p);
    return p;
  });
  const BN = quality.mobile
      ? config.contact.mobileBeanCount
      : config.contact.beanCount,
    bp = new Float32Array(BN * 3),
    bs = Array.from({ length: BN }, Math.random),
    bg = new T.BufferGeometry();
  bg.setAttribute("position", new T.BufferAttribute(bp, 3));
  const beans = new T.Points(
    bg,
    new T.PointsMaterial({
      color: 0x9a6330,
      size: 0.13,
      transparent: true,
      opacity: 1,
    }),
  );
  beans.frustumCulled = false;
  C.add(beans);
  ctx.shadow(
    C,
    0,
    0,
    4,
    2.6,
    (config.layout.floorY - C.position.y) / config.contact.scale + 0.006,
  );
  return {
    group: C,
    animated: true,
    update({ progress, time: t }) {
      const f = clamp((progress - 3.45) / 0.55),
        o = f * f * (3 - 2 * f);
      doors.forEach((door, i) => {
        door.rotation.y = (i ? 1 : -1) * o * 1.75;
      });
      pl.intensity = o * 1.8;
      ctx.fadeMaterial(beans.material, o);
      for (let n = 0; n < BN; n++) {
        const u = (bs[n] + t * 0.12) % 1;
        bp.set(
          [
            Math.sin(n * 12.9) * 0.35,
            0.3 + u * 3,
            1 + u * 1.8 + Math.cos(n * 7.3) * 0.2,
          ],
          n * 3,
        );
      }
      bg.attributes.position.needsUpdate = true;
    },
  };
}
