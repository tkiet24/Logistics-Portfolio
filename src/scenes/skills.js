import * as T from "three";
import { createSkillContainer } from "../three/skill-container.js";
import { SKILLS } from "../config/content.js";
export function createScene(ctx) {
  const { config } = ctx,
    PAL = config.palette.containers;
  let act = ctx.ui.activeSkill;
  const W = new T.Group();
  W.position.x = config.layout.sceneSpacing * 2;

  const sk = [];
  const columns = Math.max(
    1,
    Math.min(SKILLS.length, Math.floor(config.skills.columns)),
  );
  const rows = Math.ceil(SKILLS.length / columns);
  SKILLS.forEach((k, i) => {
    const m = createSkillContainer(ctx, PAL[i % PAL.length], k[2], i);
    m.position.set(
      ((i % columns) - (columns - 1) / 2) * config.skills.gap,
      ((rows - 1) / 2 - Math.floor(i / columns)) * config.skills.rowGap,
      0,
    );
    m.scale.setScalar(config.skills.containerScale);
    m.userData.i = i;
    W.add(m);
    sk.push(m);
  });
  const lit = () =>
    sk.forEach((m, i) => {
      m.userData.setStatus(i === act, i === hov);
      [...new Set(m.material)].forEach((x) => x.emissive.set(0));
    });
  let hov = -1;
  lit();
  ctx.shadow(W, 0, 0, 7.5, 2.4, config.layout.floorY + 0.012);
  return {
    group: W,
    pickable: sk,
    select(index) {
      act = index;
      lit();
      ctx.invalidate();
    },
    hover(index) {
      if (hov !== index) {
        hov = index;
        lit();
        ctx.invalidate();
      }
    },
    update({ dt, reducedMotion }) {
      let moving = false;
      for (let i = 0; i < sk.length; i++) {
        const mesh = sk[i],
          z = i === act ? 1.1 : i === hov ? 0.5 : 0,
          yaw = i === act ? -0.4 : 0;
        moving ||=
          Math.abs(mesh.position.z - z) > 0.001 ||
          Math.abs(mesh.rotation.y - yaw) > 0.001;
        const factor = reducedMotion ? 1 : -Math.expm1(-8 * dt);
        mesh.position.z += (z - mesh.position.z) * factor;
        mesh.rotation.y += (yaw - mesh.rotation.y) * factor;
      }
      return moving;
    },
  };
}
