import * as T from "three";
import { SCENERY_PACKS, SCENERY_SITES } from "../config/scenery.js";
import { smoothstep } from "../core/math.js";
import { createFade } from "../three/fade.js";
import { createVisibility } from "../three/visibility.js";

function normalizeModel(model, width, maxHeight, count) {
  const bounds = new T.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error("Scenery model has no bounds");
  const size = bounds.getSize(new T.Vector3());
  const center = bounds.getCenter(new T.Vector3());
  model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
  const template = new T.Group();
  template.add(model);
  const scale = Math.min(
    width / Math.max(size.x, size.z, 0.01),
    maxHeight / Math.max(size.y * count, 0.01),
  );
  template.scale.setScalar(scale);
  return {
    template,
    width: size.x * scale,
    depth: size.z * scale,
    height: size.y * scale,
  };
}

export function createScenery(ctx) {
  const { config, quality } = ctx;
  const settings = config.scenery;
  const group = new T.Group();
  group.name = "Route logistics scenery";
  const sites = SCENERY_SITES.map((layout) => {
    const siteGroup = new T.Group();
    siteGroup.name = layout.name;
    siteGroup.position.set(layout.x, config.layout.floorY, layout.z);
    siteGroup.visible = false;
    group.add(siteGroup);
    return {
      layout,
      group: siteGroup,
      fade: createFade(siteGroup),
      visibility: createVisibility(siteGroup),
      started: false,
      wasNear: false,
      remainingItems: quality.mobile
        ? layout.items.slice(0, settings.mobileItems)
        : [...layout.items],
      dirty: true,
      cranes: [],
    };
  });

  function loadSite(site) {
    site.started = true;
    const items = site.remainingItems.splice(0);
    for (const item of items) {
      const [pack, name, x, z, width, yaw, stack = 1] = item;
      const source = `kits/${SCENERY_PACKS[pack]}/Models/GLB format/${name}.glb`;
      ctx.assets
        .load(source, { priority: 4 })
        .then((model) => {
          const count = quality.mobile ? 1 : stack;
          const normalized = normalizeModel(
            model,
            width,
            settings.maxHeight,
            count,
          );
          for (let level = 0; level < count; level++) {
            const placed =
              level === 0
                ? normalized.template
                : normalized.template.clone(true);
            placed.rotation.y = yaw;
            placed.position.set(x, level * normalized.height, z);
            site.group.add(placed);
            if (name === "crane") {
              const arm = placed.getObjectByName("arm");
              if (arm) site.cranes.push({ arm, yaw: arm.rotation.y });
            }
            site.fade.register(placed);
          }
          const cosine = Math.abs(Math.cos(yaw)),
            sine = Math.abs(Math.sin(yaw));
          const shadow = ctx.shadow(
            site.group,
            x,
            z,
            normalized.width * cosine + normalized.depth * sine + 0.6,
            normalized.depth * cosine + normalized.width * sine + 0.6,
            0.012,
          );
          shadow.material.opacity = 0.2;
          site.fade.register(shadow);
          site.dirty = true;
          site.visibility.invalidate();
          ctx.invalidate();
        })
        .catch((error) => {
          site.remainingItems.push(item);
          console.warn("Scenery GLB load error:", source, error);
        });
    }
  }

  function update(camera, time, reducedMotion = ctx.reducedMotion(), frustum) {
    let animated = false;
    for (const site of sites) {
      const distance = Math.abs(camera.position.x - site.layout.x);
      const near = distance <= config.performance.sceneryPreloadDistance;
      if (
        near &&
        (!site.started || (!site.wasNear && site.remainingItems.length))
      )
        loadSite(site);
      site.wasNear = near;
      site.fade.update(
        (1 - smoothstep(settings.fadeNear, settings.fadeFar, distance)) *
          (1 - smoothstep(config.layout.sceneSpacing * 3.55, config.layout.sceneSpacing * 3.95, camera.position.x)),
      );
      if (!site.group.visible) continue;
      if (frustum && !site.visibility.intersects(frustum)) {
        site.group.visible = false;
        continue;
      }
      const swinging =
        !reducedMotion &&
        settings.craneSpeed !== 0 &&
        settings.craneSwing !== 0;
      for (const { arm, yaw } of site.cranes) {
        const target =
          yaw +
          (swinging
            ? Math.sin(time * settings.craneSpeed + site.layout.x * 0.1) *
              settings.craneSwing
            : 0);
        if (arm.rotation.y !== target) {
          arm.rotation.y = target;
          site.dirty = true;
        }
      }
      if (site.dirty) {
        // The world disables automatic matrix updates; do not traverse hidden sites.
        site.group.updateWorldMatrix(true, true);
        site.dirty = false;
      }
      if (swinging && site.cranes.length) animated = true;
    }
    return animated;
  }

  return { group, update };
}
