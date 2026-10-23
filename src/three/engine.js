import * as T from "three";
import { smoothstep } from "../core/math.js";
import { createAssets } from "./assets.js";
import { createHelpers } from "./helpers.js";
import { createFade } from "./fade.js";
import { createEnvironment } from "./environment.js";
import { createCameraRig } from "./camera.js";
import { createVisibility } from "./visibility.js";

const sceneImports = [
  () => import("../scenes/home.js"),
  () => import("../scenes/port.js"),
  () => import("../scenes/skills.js"),
  () => import("../scenes/work.js"),
  () => import("../scenes/contact.js"),
];

export async function startEngine(config, ui) {
  if (ui.opening.cancelled) return;
  const canvas = document.querySelector("#c"),
    settings = config.performance;
  const mobile =
    innerWidth < settings.mobileBreakpoint || navigator.connection?.saveData;
  const quality = { mobile: !!mobile, detail: mobile ? 0.6 : 1 };
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !mobile,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const world = new T.Scene(),
    rig = createCameraRig(config, ui.scroll.read().progress),
    camera = rig.camera;
  // Static parts of the world do not need a recursive matrix walk every frame.
  world.autoUpdate = false;
  const ambient = new T.HemisphereLight(0xffffff, 0x6b6564, 1.1);
  world.add(ambient);
  const sun = new T.DirectionalLight(0xffffff, 1.1);
  sun.position.set(5, 8, 6);
  world.add(sun);
  const environment = createEnvironment(config, quality);
  const helpers = createHelpers(config, quality),
    scenes = new Map(),
    pending = new Set(),
    failed = new Set();
  let raf = 0,
    booting = true,
    stopped = false,
    last = 0,
    time = 0,
    progress = ui.scroll.read().progress;
  let pixelRatio = Math.min(
    devicePixelRatio || 1,
    mobile ? settings.mobilePixelRatio : settings.desktopPixelRatio,
  );
  let hovered = -1,
    pointerDirty = false,
    pointerOnCanvas = false,
    dragging = false,
    dragX = 0;
  let factory,
    factoryPending = false,
    factoryWasNear = false,
    scenery,
    sceneryPending = false,
    sceneryWasNear = false,
    slowFrames = 0;
  const frustum = new T.Frustum(),
    projection = new T.Matrix4();
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  const assets = createAssets(
    mobile ? settings.mobileConcurrentLoads : settings.maxConcurrentLoads,
    (stats) => {
      if (booting && scenes.size === sceneImports.length && factory && scenery) {
        const total = stats.completed + stats.failed + stats.active + stats.queued;
        ui.opening.progress(8 + 88 * ((stats.completed + stats.failed) / Math.max(1, total)), "Loading the journey…");
      }
      invalidate();
    },
  );
  let loadFailures = 0;
  ui.opening.onFinish(() => {
    if (!ui.opening.cancelled) return;
    stopped = true;
    assets.cancel();
    cancelAnimationFrame(raf);
    environment.dispose();
    renderer.dispose();
  });
  function invalidate() {
    if (!booting && !raf && !stopped && !document.hidden)
      raf = requestAnimationFrame(frame);
  }
  const error = (problem) => {
    if (stopped) return;
    loadFailures++;
    console.warn("A portfolio asset could not be loaded:", problem);
  };
  function context(record, priority) {
    return {
      config,
      quality,
      assets,
      ui,
      ...helpers,
      invalidate,
      error,
      reducedMotion: () => ui.reducedMotion.matches,
      changed(root) {
        record.visibility?.invalidate();
        if (record.scene) record.fade?.register(root || record.scene.group);
        invalidate();
      },
      fadeMaterial(material, value) {
        record.fade?.motion(material, value);
      },
      load(source, onLoad) {
        if (stopped) return Promise.reject(new Error("Portfolio loading was cancelled"));
        return assets
          .load(source, { priority })
          .then((model) => {
            if (stopped) return model;
            onLoad?.(model);
            record.visibility?.invalidate();
            record.fade?.register();
            invalidate();
            return model;
          })
          .catch((problem) => {
            error(problem);
            throw problem;
          });
      },
    };
  }
  async function ensureScene(index) {
    if (scenes.has(index) || pending.has(index) || failed.has(index)) return;
    pending.add(index);
    try {
      const module = await sceneImports[index](),
        record = {};
      if (stopped) return;
      record.scene = module.createScene(
        context(record, index === Math.round(progress) ? 0 : 2),
      );
      record.fade = createFade(record.scene.group);
      record.visibility = createVisibility(record.scene.group);
      record.fade.register();
      record.scene.theme?.(ui.theme.tokens());
      world.add(record.scene.group);
      scenes.set(index, record);
      record.scene.ready?.catch(error);
      invalidate();
      await record.scene.ready;
    } catch (problem) {
      failed.add(index);
      error(problem);
    } finally {
      pending.delete(index);
    }
  }
  async function ensureBackground(cameraX, preload = false) {
    const nearScenery = preload || cameraX > 25,
      nearFactory = preload || Math.abs(cameraX - config.factory.originX) < 18,
      enterScenery = nearScenery && !sceneryWasNear,
      enterFactory = nearFactory && !factoryWasNear;
    // Record both visits before awaiting either import, including overlapping frames.
    sceneryWasNear = nearScenery;
    factoryWasNear = nearFactory;
    if (!scenery && !sceneryPending && enterScenery) {
      sceneryPending = true;
      try {
        const { createScenery } = await import("../scenes/scenery.js");
        if (stopped) return;
        scenery = createScenery({
          config,
          quality,
          assets,
          ...helpers,
          invalidate,
          error,
          reducedMotion: () => ui.reducedMotion.matches,
        });
        world.add(scenery.group);
        if (preload) await scenery.preload();
        invalidate();
      } catch (problem) {
        error(problem);
      } finally {
        sceneryPending = false;
      }
    }
    if (stopped) return;
    if (!factory && !factoryPending && enterFactory) {
      factoryPending = true;
      try {
        const { createScene } = await import("../scenes/factory.js"),
          record = {};
        if (stopped) return;
        record.scene = createScene(context(record, 3));
        record.fade = createFade(record.scene.group, { dither: true });
        record.visibility = createVisibility(record.scene.group);
        record.fade.register();
        factory = record;
        world.add(record.scene.group);
        if (preload) await record.scene.ready;
        invalidate();
      } catch (problem) {
        error(problem);
      } finally {
        factoryPending = false;
      }
    }
  }
  function resize() {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    rig.resize(innerWidth, innerHeight);
    environment.resize(innerWidth, innerHeight, pixelRatio);
    invalidate();
  }
  function applyTheme() {
    const tokens = ui.theme.tokens();
    environment.theme(tokens);
    scenes.forEach(({ scene }) => scene.theme?.(tokens));
    invalidate();
  }
  function pick() {
    const skill = scenes.get(2)?.scene;
    if (!skill) return;
    let index = -1;
    if (pointerOnCanvas && Math.abs(progress - 2) < 0.4) {
      ray.setFromCamera(pointer, camera);
      index =
        ray.intersectObjects(skill.pickable, false)[0]?.object.userData.i ?? -1;
    }
    if (index !== hovered) {
      hovered = index;
      skill.hover(index);
      canvas.style.cursor = index >= 0 ? "pointer" : "";
    }
    pointerDirty = false;
  }
  function frame(now) {
    raf = 0;
    if (stopped || document.hidden) return;
    const reducedMotion = ui.reducedMotion.matches;
    const interval =
      1000 /
      (reducedMotion
        ? settings.reducedMotionFPS
        : mobile
          ? settings.mobileFPS
          : settings.targetFPS);
    if (last && now - last < interval - 1) {
      invalidate();
      return;
    }
    const frameMs = last ? now - last : 0;
    const dt = Math.min(
      settings.maxFrameDelta,
      last ? (now - last) / 1000 : 1 / 60,
    );
    last = now;
    if (!reducedMotion) time += dt;
    const state = ui.scroll.read(),
      movingCamera = rig.update(dt, state.progress, reducedMotion);
    progress = rig.progress;
    frustum.setFromProjectionMatrix(
      projection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    ui.update(progress);
    // Load the destination first when navigation jumps across sections.
    ensureScene(Math.round(state.progress));
    for (let i = 0; i < sceneImports.length; i++)
      if (
        Math.abs(state.progress - i) < settings.scenePreloadDistance &&
        (i === 0 || state.progress > 0.16)
      )
        ensureScene(i);
    // Background factory waits until the primary Home assets finish.
    if (assets.stats().completed >= 2 || progress > 0.3)
      ensureBackground(camera.position.x);
    const frameState = {
      camera,
      dt,
      time,
      progress,
      workProgress: state.workProgress,
      reducedMotion,
    };
    let animating = environment.update(frameState),
      settling = movingCamera;
    const night = environment.nightMix;
    ambient.color.setRGB(1 - night * .22, 1 - night * .12, 1);
    ambient.intensity = 1.1 - night * .22;
    sun.color.setRGB(1 - night * .25, .98 - night * .12, .92 + night * .08);
    sun.intensity = 1.1 - night * .3;
    scenes.forEach(({ scene, fade, visibility }, index) => {
      const distance = Math.abs(progress - index),
        visible = distance < 1.4;
      const contactClearance =
        index === 3 ? 1 - smoothstep(3.55, 3.95, progress) : 1;
      const homeClearance =
        index === 1
          ? smoothstep(...config.factory.revealProgress, progress)
          : 1;
      fade.update(
        visible
          ? (0.22 + 0.78 * (1 - smoothstep(0.55, 1.4, distance))) *
              contactClearance *
              homeClearance
          : 0,
      );
      if (!visible) return;
      scene.group.visible &&= visibility.intersects(frustum);
      if (!scene.group.visible) return;
      settling = !!scene.update?.(frameState) || settling;
      scene.group.updateMatrixWorld(true);
      animating ||= !!scene.animated;
    });
    if (factory) {
      factory.fade.update(
        smoothstep(...config.factory.revealProgress, progress) *
          (1 -
            smoothstep(
              16,
              28,
              Math.abs(camera.position.x - config.factory.originX),
            )),
      );
      factory.scene.group.visible &&= factory.visibility.intersects(frustum);
      if (factory.scene.group.visible) {
        factory.scene.update(frameState);
        factory.scene.group.updateMatrixWorld(true);
        animating = true;
      }
    }
    if (scenery)
      animating =
        scenery.update(camera, time, reducedMotion, frustum) || animating;
    if (pointerDirty || movingCamera) pick();
    const renderStart = performance.now();
    renderer.info.reset();
    renderer.clear();
    renderer.render(environment.scene, environment.camera);
    renderer.clearDepth();
    renderer.render(world, camera);
    // Lower resolution after sustained slow frames or expensive draw submission.
    if (
      settings.adaptResolution &&
      !reducedMotion &&
      (animating || settling) &&
      (frameMs > interval * 1.45 ||
        performance.now() - renderStart > interval * 0.85)
    )
      slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && pixelRatio > settings.minPixelRatio) {
      pixelRatio = Math.max(settings.minPixelRatio, pixelRatio - 0.25);
      slowFrames = 0;
      resize();
    }
    if (
      (!reducedMotion && (animating || settling)) ||
      (reducedMotion && progress !== state.progress)
    )
      invalidate();
  }
  addEventListener("resize", resize, { passive: true });
  addEventListener(
    "pointermove",
    (event) => {
      const pointerX = (event.clientX / innerWidth) * 2 - 1;
      const pointerY = (event.clientY / innerHeight) * 2 - 1;
      rig.setPointer(pointerX, pointerY);
      pointer.set(pointerX, -pointerY);
      pointerOnCanvas = event.target === canvas;
      pointerDirty = true;
      if (dragging) {
        scenes.get(0)?.scene.drag(event.clientX - dragX);
        dragX = event.clientX;
      }
      invalidate();
    },
    { passive: true },
  );
  canvas.addEventListener("pointerdown", (event) => {
    if (progress < 0.6 && event.pointerType !== "touch") {
      dragging = true;
      dragX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    }
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("click", () => {
    if (hovered >= 0) ui.select(hovered);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = 0;
      invalidate();
    }
  });
  ui.reducedMotion.addEventListener("change", () => {
    last = 0;
    invalidate();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stopped = true;
    cancelAnimationFrame(raf);
    environment.dispose();
    ui.fallback();
    ui.opening.cancel();
  });
  ui.connect({
    invalidate,
    onSkill: (index) => scenes.get(2)?.scene.select(index),
    onTheme: applyTheme,
  });
  try {
    if (ui.opening.cancelled || stopped) return;
    ui.opening.progress(8, "Loading the journey…");
    // Canvas lettering must use the loaded portfolio font on the first frame.
    await document.fonts?.ready;
    if (ui.opening.cancelled || stopped) return;
    await Promise.all([
      ...sceneImports.map((_, index) => ensureScene(index)),
      ensureBackground(camera.position.x, true),
    ]);
    if (ui.opening.cancelled || stopped) return;
    if (loadFailures || failed.size || scenes.size !== sceneImports.length || !factory || !scenery || assets.stats().failed > 0)
      throw new Error("The complete 3D journey could not be prepared");
    world.updateMatrixWorld(true);
    applyTheme();
    resize();
    ui.opening.progress(98, "Almost there…");
    environment.prepare(renderer);
    renderer.compile(environment.scene, environment.camera);
    // Warm every scene's shaders, including transparent and late-loaded materials.
    scenes.forEach(({ scene, fade }) => { fade.update(1); scene.group.visible = true; });
    factory.fade.update(1);
    scenery.group.traverse((part) => { part.visible = true; });
    renderer.compile(world, camera);
    scenes.forEach(({ fade }) => fade.update(0));
    factory.fade.update(0);
    booting = false;
    last = 0;
    frame(performance.now());
    ui.opening.progress(100, "Ready to explore.");
    await new Promise((resolve) => setTimeout(resolve, ui.reducedMotion.matches ? 0 : 350));
    ui.opening.finish();
  } catch (problem) {
    stopped = true;
    environment.dispose();
    renderer.dispose();
    ui.opening.cancel();
    throw problem;
  }
  if (new URLSearchParams(location.search).has("debug"))
    window.__portfolio = {
      config,
      stats: () => ({
        assets: assets.stats(),
        scenes: [...scenes.keys()],
        pixelRatio,
        render: renderer.info.render,
        memory: renderer.info.memory,
      }),
    };
}
