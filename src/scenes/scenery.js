import * as T from "three";
import { SCENERY_PACKS, SCENERY_SITES } from "../config/scenery.js";
import { smoothstep } from "../core/math.js";
import { createFade } from "../three/fade.js";
import { createVisibility } from "../three/visibility.js";
import { createSectionLights } from "../three/section-lights.js";

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

function createSiteSurface(layout) {
  const group = new T.Group();
  group.name = `${layout.name} pavement`;
  const [width, depth] = layout.size;
  const asphalt = new T.MeshStandardMaterial({ color: 0x383e42, roughness: 0.96 });
  const concrete = new T.MeshStandardMaterial({ color: 0x939b94, roughness: 0.95 });
  const paint = new T.MeshStandardMaterial({ color: 0xeee6ce, roughness: 0.9 });
  function slab(name, x, z, w, d, height, y, material) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, height, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    // Paint ground layers before markings and fading vehicles.
    mesh.renderOrder = material === asphalt ? -3 : material === concrete ? -2 : -1;
    group.add(mesh);
  }
  slab("Asphalt pad", 0, 0, width, depth, 0.08, -0.04, asphalt);
  for (const side of [-1, 1]) {
    slab("Side curb", side * (width / 2 - 0.09), 0, 0.18, depth, 0.08, 0, concrete);
  }
  slab("Rear curb", 0, -depth / 2 + 0.09, width, 0.18, 0.08, 0, concrete);
  if (layout.kind === "parking") {
    const { columns, bayWidth, bayDepth, rowZ } = layout.parking;
    for (const side of [-1, 1]) {
      for (let column = 0; column <= columns; column++) {
        slab("Parking bay divider", (column - columns / 2) * bayWidth,
          side * rowZ, 0.045, bayDepth, 0.012, 0.008, paint);
      }
      slab("Parking bay end", 0, side * (rowZ + bayDepth / 2),
        columns * bayWidth, 0.045, 0.012, 0.008, paint);
    }
  } else {
    for (const side of [-1, 1]) {
      slab("City sidewalk", 0, side * 1.65, width - 0.36, 0.55, 0.06, 0.02, concrete);
    }
    for (let x = -width / 2 + 0.8; x < width / 2 - 0.4; x += 1.4) {
      slab("City lane dash", x, 0, 0.65, 0.045, 0.012, 0.008, paint);
    }
  }
  return group;
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
    const surface = createSiteSurface(layout);
    siteGroup.add(surface);
    const fade = createFade(siteGroup);
    fade.register(surface);
    group.add(siteGroup);
    return {
      layout,
      group: siteGroup,
      fade,
      visibility: createVisibility(siteGroup),
      started: false,
      wasNear: false,
      pending: Promise.resolve(),
      remainingItems: quality.mobile
        ? layout.items.slice(0, settings.mobileItems)
        : [...layout.items],
      dirty: true,
    };
  });

  function loadSite(site) {
    site.started = true;
    const items = site.remainingItems.splice(0);
    const loads = items.map((item) => {
      const [pack, name, x, z, width, yaw, stack = 1] = item;
      const source = `kits/${SCENERY_PACKS[pack]}/Models/GLB format/${name}.glb`;
      return ctx.assets
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
            placed.name = name;
            site.group.add(placed);
            if (pack === "city") site.lights?.fixtures.building(placed);
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
          if (ctx.error) ctx.error(error);
          else console.warn("Scenery GLB load error:", source, error);
        });
    });
    // Include earlier loads when re-entry retries begin before they all settle.
    site.pending = Promise.allSettled([site.pending, ...loads]);
    return site.pending;
  }

  function preload() {
    return Promise.allSettled(
      sites.map((site) => site.started ? site.pending : loadSite(site)),
    );
  }

  function prepareLighting() {
    for (const site of sites) {
      if (site.lights) continue;
      site.lights = createSectionLights({ group: site.group, layout: site.layout }, site.layout.kind, config, quality);
      site.fade.register();
      site.visibility.invalidate();
      site.dirty = true;
    }
  }

  function update(camera, time, reducedMotion = ctx.reducedMotion(), frustum, lighting) {
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
      if (site.dirty) {
        // The world disables automatic matrix updates; do not traverse hidden sites.
        site.group.updateWorldMatrix(true, true);
        site.dirty = false;
      }
      if (lighting) site.lights?.update({ camera, time, reducedMotion,
        ...lighting, opacity: site.fade.opacity });
    }
    return false;
  }

  return { group, update, preload, prepareLighting,
    disposeLighting() {
      for (const site of sites) { site.lights?.dispose(); site.lights = null; }
    },
  };
}
