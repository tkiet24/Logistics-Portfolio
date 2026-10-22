# Architecture

The document and interface initialize before the WebGL engine. The engine imports scenes near the current scroll position and owns their visibility and frame scheduling.

## Source map

```text
index.html                       Section markup, copy, metadata, model credits
src/
  main.js                        Local fonts, CSS, UI startup, deferred engine import
  config/
    site.js                      Runtime layout, quality, palette, scene settings
    content.js                   Skills content
    scenery.js                   Route-side model packs and placement
    assets.js                    Production model allowlist
  core/
    math.js                      Damping, angles, scroll mapping, seeded randomness
    asset-queue.js               Prioritized, cached model loading
  ui/
    interface.js                 Navigation, panels, skills, Work selection, fallback
    scroll.js                    Section measurements and cached scroll state
    theme.js                     Theme persistence and CSS token lookup
  three/
    engine.js                    Renderer, dynamic imports, frame scheduling
    camera.js                    Camera interpolation, parallax, responsive framing
    assets.js                    GLTFLoader and per-request model/material clones
    environment.js               Shared particles and route markings
    helpers.js                   Containers, canvas textures, contact shadows
    fade.js                      Material registration and group fades
    visibility.js                Cached scene bounds and camera-frustum checks
    flight.js                    Globe flight route calculations
    aircraft-material.js         Aircraft material treatment
    wheels.js                    Cached train wheel splitting and pivots
  scenes/
    home.js, port.js, skills.js, work.js, contact.js
    scenery.js, factory.js       Background logistics sites and factory
  styles/site.css                Page layout, themes, visual tokens, fallback styles
build/asset-plugin.js            Allowlist validation and hashed model packs
scripts/verify-build.mjs          Production output verification
tests/                          Node tests
kits/                           Original models, textures, licenses
vite.config.js                  Bundling and asset plugin
vercel.json                     Hosting commands and cache headers
```

## Scene lifecycle

The five main scenes have indices 0–4 in document order. Each exports `createScene(ctx)` and returns `group` and `update(frame)`, with optional `ready`, `theme(tokens)`, and `animated`. Frames contain `dt` in seconds, `time`, `progress`, `workProgress`, and `reducedMotion`. `workProgress` drives the car before scrolling transitions away from Work.

The context supplies config, quality, UI, shared helpers, loaders, and invalidation. `ctx.load(path, callback)` resolves a model, runs the callback, registers new materials, and requests a render. Direct `ctx.assets.load(path, { priority })` callers register additions with `ctx.changed()`; background scenery manages its own fades and invalidation. Scene groups are mounted by the engine.

Work returns `true` while its car or highlighted buildings settle. Scenes with ongoing animation declare `animated: true`. The engine skips updates for distant scenes, cancels its frame request when the document is hidden, and resumes on visibility changes. Static views can sleep until input, loading, or another change invalidates them. Reduced motion suppresses autonomous animation and snaps relevant transitions.

Cached bounds also exclude scenes outside the camera view from animation updates. Bounds refresh after model additions rather than on every frame. Background import failures and failed scenery items can retry when the user leaves and re-enters their activation range; successful items are retained.

## Loading and rendering

Scene imports and background site loads are deferred until needed. The asset queue limits concurrency and serves lower numeric priorities first. Repeated paths share download/parsing work; consumers receive cloned object hierarchies and materials while geometry and textures remain shared. Failed cache entries are removed so a later request can retry. Wheel splitting caches geometry analysis across wagon clones.

Mobile or Save-Data mode selects a lower initial detail budget, concurrency, and DPR cap (1.25 by default). Mobile and desktop both target 60 FPS; reduced motion uses a separate cadence. The engine caps frame delta and can lower DPR after sustained long frame intervals or slow CPU submission to `renderer.render()`. These are budgets and adaptation rules, not measured FPS guarantees. Shared soft contact shadows and transparent local surfaces avoid a large opaque ground plane.

## Inspect runtime statistics

Run the development server and open `http://127.0.0.1:5173/?debug` using the port Vite reports. In the browser console, run:

```js
window.__portfolio.stats();
```

After the engine starts, this reports asset queue counts, loaded scene indices, current pixel ratio, and Three.js render/memory counters. The counters do not measure FPS or GPU memory in bytes.

See [configuration](configuration.md), [deployment](deployment.md), or the [README](../README.md).

<!-- Last reviewed: 2026-10-22. -->
