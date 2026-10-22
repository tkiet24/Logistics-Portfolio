# Configuration reference

Edit source settings and rebuild production output. These modules are bundled by Vite; no runtime configuration service is required.

## Where settings live

| File                                              | Controls                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [src/config/site.js](../src/config/site.js)       | `CONFIG`: layout, camera, render budgets, palette, and scene dimensions/motion             |
| [src/config/content.js](../src/config/content.js) | `SKILLS`: labels, descriptions, category tags, and accordion entries                       |
| [src/config/scenery.js](../src/config/scenery.js) | `SCENERY_PACKS` aliases and `SCENERY_SITES` placements                                     |
| [src/config/assets.js](../src/config/assets.js)   | `ASSET_SOURCES`: exact project-relative GLB allowlist                                      |
| [src/styles/site.css](../src/styles/site.css)     | CSS tokens, responsive layouts, atmosphere, light/dark and reduced-motion styles           |
| [index.html](../index.html)                       | Portfolio identity, section copy, Work entries, contact links, metadata, and model credits |

## Runtime groups

| `CONFIG` group        | Main settings                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layout`              | `sceneSpacing`, `floorY`, camera keyframes/damping, desktop breakpoint, `workTravelFraction`                                                     |
| `performance`         | Mobile breakpoint, desktop/mobile DPR caps and load concurrency, render cadence targets, preload distances, max frame delta, adaptive resolution |
| `palette`             | Three.js accent and procedural container colors                                                                                                  |
| `home`                | Globe radius, flight coordinates/speed/altitude, aircraft size/material treatment, route and trail                                               |
| `port`                | Scene height, train/track/container scale, wagon count, rail offsets/length, arrival duration                                                    |
| `skills`              | Container scale, centered columns, horizontal `gap`, vertical `rowGap` (default 1.24)                                                            |
| `work`                | Route, milestones, car scale, follow/steering damping, building widths, far counts, random seed                                                  |
| `contact`             | Scene scale/rotation and desktop/mobile bean counts                                                                                              |
| `scenery` / `factory` | Site fade distances, model height/mobile limits, crane motion; factory scale, origin, conveyor speed                                             |

For example, change `CONFIG.port.wagonCount` to change train length, or `CONFIG.work.buildingWidths.heroTower` to resize the tall Work milestones. Keep Work milestones ordered from 0 to 1, and align their count with the Work entries in `index.html`. Performance FPS fields set scheduling targets; they are not measured results.

Scenery item arrays contain `[pack, model, x, z, footprintWidth, yaw, stack?]`. Coordinates are local to the site, yaw is in radians, and `stack` defaults to 1. Add the corresponding model path to `ASSET_SOURCES` when adding a scenery item.

## Visual tokens

`--bg`, `--fg`, `--muted`, `--panel`, and `--line` control page surfaces and text. `--accent`, `--onacc`, `--accent-2`, and `--accent-tint` control UI accents. Font, spacing, radius, shadow, and atmosphere variables also live in `site.css`.

The theme bridge reads `--bg` as `background`, `--ball` as `ground`, and `--dot` as `dot` for scene theme hooks. Update both the system-dark and explicit `[data-theme='dark']` rules when changing dark tokens. Three.js accent/container colors are separately defined in `CONFIG.palette`.

The [previous design brief](archive/previous-design-brief.md) retains historical visual guidance. Use the current CSS for active token values and `src/config/site.js` for runtime settings.

## Models and production URLs

Scene code loads original paths such as `kits/train-kit/Models/GLB format/train-locomotive-a.glb`. Keep spaces and case exact, use forward slashes, and include each model in `ASSET_SOURCES`. The loader resolves paths through the generated `virtual:portfolio-assets` module.

The [asset plugin](../build/asset-plugin.js) groups allowlisted models and their external image/buffer dependencies into content-hashed packs under `assets/models/`. It preserves model bytes and relative dependency paths, including `../Textures/...`; keep those files in their original source layout. Pack hashes include filenames and dependency bytes, so editing a shared texture changes the pack URL. Other kit files are not copied to production; `publicDir` is disabled.

Inspect these settings without starting the browser:

```sh
node --input-type=module -e "import { CONFIG } from './src/config/site.js'; console.log(CONFIG.port.wagonCount, CONFIG.work.carScale)"
```

Then run `npm run check` (`npm.cmd run check` in Windows PowerShell). See [deployment](deployment.md) for output verification and caching, or return to the [README](../README.md).

<!-- Last reviewed: 2026-10-22. -->
