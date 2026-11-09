# Logistics Portfolio

An interactive personal portfolio for **Bui Thi Kieu Nga**, a Logistics and Supply Chain Management student seeking internship opportunities. The website combines readable HTML content with a scroll-driven Three.js journey through aviation, rail transport, shipping containers, city roads, and a harbour.

This is a static frontend built with vanilla JavaScript ES modules and Vite. Contact actions use email and telephone links; no backend, database, or application environment variables are required.

## Portfolio sections

| Section | Content and interaction | 3D scene |
| --- | --- | --- |
| Home | Introduction and links to background and contact details | Earth globe with an animated aircraft route |
| About | Education, GPA, Excel certification, and tutoring experience | Freight train, containers, and port equipment |
| Skills | Four selectable topics with expandable details | Interactive containers linked to the selected topic |
| Work | Education, customer service, tutoring, and a planned purchasing project | A car following a road between milestones |
| Contact | Email, telephone, location, and a CV download link | Harbour with vessels, water, and cranes |

## Features

- Scroll-linked camera movement, section navigation, progress indicators, and background logistics scenery.
- Light and dark themes, with the user's selection saved in local storage.
- An opening progress screen that prepares the complete 3D journey and offers a **View text version** button.
- A readable document fallback when WebGL or asset loading fails, plus basic content when JavaScript is disabled.
- Responsive layouts, reduced-motion support, semantic controls, and ARIA state updates for interactive content.
- Prioritized model loading, shared asset caching, visibility checks, and adaptive rendering quality for smaller screens or Save-Data mode.
- Locally bundled fonts and an asset pipeline that includes only explicitly selected models and their dependencies in production.

## Technology stack

| Technology | Role |
| --- | --- |
| HTML and CSS | Portfolio content, responsive layouts, themes, and loading screen |
| JavaScript ES modules | UI state, scroll handling, configuration, and scene logic |
| Three.js `0.128.0` | WebGL rendering, GLB models, camera movement, lighting, and animation |
| Vite `8.3.5` | Development server, module bundling, and production builds |
| Fontsource | Locally bundled Inter Tight and IBM Plex Mono fonts |
| Node.js built-in test runner | Test discovery through `node --test` |

## Getting started

Install **Node.js 22.12 or newer** and npm. Run commands from the project root, beside `package.json`:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use the development server instead of opening `index.html` directly, because the application relies on modules and generated asset mappings.

On Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`:

```powershell
npm.cmd ci
npm.cmd run dev
```

### Required source assets

Keep `kits/` in its original directory structure, including external textures and supplied licenses. Model paths are case-sensitive on some deployment systems and must match the entries in `src/config/assets.js`.

The CV link expects **`CV_KieuNga_LogisticsIntern.pdf` in the project root**. That PDF is missing from the current checkout. Add it before validating a release, or update the CV integration if using a different filename. Vite fingerprints the PDF during bundling, and the verification script checks that the emitted file matches the original.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on `127.0.0.1` |
| `npm test` | Run tests discovered by Node.js in the current checkout |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run verify` | Verify an existing production build against the source assets |
| `npm run check` | Run tests, build, and production verification in sequence |
| `npm run preview` | Serve the existing production build locally on `127.0.0.1` |

To validate and preview a release after supplying the required assets:

```sh
npm run check
npm run preview
```

Production verification checks the model allowlist, model and dependency bytes, asset fingerprints, local HTML/CSS/JavaScript references, and the CV download. Test discovery alone does not validate browser interactions or the production bundle.

## Source structure

```text
index.html                  Section content, navigation, metadata, and contact links
src/
  main.js                   Font/CSS imports, UI startup, and deferred engine import
  assets/                   Moon texture and its attribution
  config/                   Content, scene settings, scenery placement, model allowlist
  core/                     Math utilities, statistics formatting, and asset queue
  ui/                       Navigation, skills, themes, scroll state, and opening loader
  scenes/                   Five section scenes, background scenery, and factory
  three/                    Renderer, camera, model loading, lighting, and effects
  styles/                   Page and loading-screen styles
build/asset-plugin.js       Model validation and hashed production asset packs
scripts/verify-build.mjs    Production output verification
kits/                      Original GLB models, external resources, and licenses
docs/                      Content guidance and technical documentation
vite.config.js             Build configuration and asset plugin registration
vercel.json                Vercel build settings and cache headers
```

### How the application works

`src/main.js` initializes the HTML interface and opening loader before importing the Three.js engine. The engine assembles all five main scenes and the background environment, waits for their assets, and warms shaders before revealing the journey. Visitors can switch to the text version during loading; failed initialization also activates that fallback.

During exploration, scroll state drives the camera and active section. Scene modules expose `createScene(ctx)` with their objects and frame update logic, while shared modules handle model loading, lighting, fades, and visibility. Rendering pauses when the page is hidden and limits work for distant scenes.

The custom Vite plugin reads `ASSET_SOURCES` from `src/config/assets.js` and packages those GLB files with their external dependencies. It preserves relative resource paths and generates content-hashed model packs, an `asset-manifest.json`, and an `asset-size-report.txt`. The full `kits/` directory is not copied to `dist/`.

## Customization

| File | What to edit |
| --- | --- |
| `index.html` | Name, introduction, education, Work entries, metadata, and contact/CV links |
| `src/config/content.js` | Skill topics, descriptions, and accordion entries |
| `src/config/site.js` | Camera/layout settings, render budgets, scene dimensions, motion, and palette |
| `src/config/scenery.js` | Background model packs and placements |
| `src/config/assets.js` | Exact model paths allowed into the production build |
| `src/styles/site.css` | Fonts, colours, spacing, responsive layouts, and theme tokens |
| `src/styles/loading.css` | Opening-screen presentation and animation |

Keep the Work entries in `index.html` aligned with the milestones configured in `src/config/site.js`. When adding a model, include its exact path in the asset allowlist and retain any relative texture or buffer dependencies. Rebuild after editing content or assets.

For runtime diagnostics, append `?debug` to the development URL. Once the 3D engine has started, inspect the following in the browser console:

```js
window.__portfolio.stats();
```

This reports asset queue state, loaded scene indices, pixel ratio, and Three.js rendering/memory counters.

## Deployment

The production output is `dist/`. The included `vercel.json` configures Vite with `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. Set the deployment root to the directory containing `package.json`, `kits/`, and `vercel.json`.

Run `npm run check` before releasing: the configured Vercel build command only builds the site. Deploy HTML and generated assets from the same build together. See the [deployment guide](docs/deployment.md) for details.

## Documentation and asset credits

- [Architecture](docs/architecture.md): module responsibilities, scene lifecycle, and rendering concepts.
- [Configuration](docs/configuration.md): content settings, visual tokens, and model packaging.
- [Portfolio content template](docs/portfolio-content-template.md): section copy and editing prompts.
- [Model credits](docs/model-credits.md): model authors and license references.
- [Moon texture credits](src/assets/moon-credits.md): source and attribution for the lunar texture.

Retain the original licenses supplied with the assets under `kits/` when reusing or redistributing them.
