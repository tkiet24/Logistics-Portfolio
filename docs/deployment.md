# Build and Vercel setup

The repository owner operates Vercel and chooses when to deploy. This source refactor supplies local validation and import settings; it does not sign in, run a deployment CLI, or publish a live site.

## Check a production build locally

Use Node.js 22.12 or newer. From the directory containing `package.json`:

```sh
npm ci
npm run check
npm run preview
```

On Windows PowerShell, replace `npm` with `npm.cmd`. Open the URL printed by the preview server. `check` runs tests, `vite build`, and `scripts/verify-build.mjs` in sequence; it does not publish anything.

The build writes `dist/`, including bundled scripts/styles/fonts, hashed model packs, `asset-manifest.json`, and `asset-size-report.txt`. Verification checks the exact GLB allowlist, unchanged model/dependency bytes, dependency paths, pack fingerprints, output sizes, and local HTML/CSS/JS references. Run `npm run verify` to recheck an existing build.

## Configure a Vercel import

Import the Git repository as a Vercel project. Set **Root Directory** to the app directory containing `package.json`, `index.html`, `kits/`, and `vercel.json`. If that is the repository root, keep the default root. For a nested checkout, select that directory rather than `src/` or `dist/`. Vercel limits build access to the configured root. See [Vercel's build configuration documentation](https://vercel.com/docs/builds/configure-a-build#root-directory).

Confirm the settings supplied by [vercel.json](../vercel.json):

| Setting          | Value                                      |
| ---------------- | ------------------------------------------ |
| Framework        | Vite                                       |
| Install command  | `npm ci`                                   |
| Build command    | `npm run build`                            |
| Output directory | `dist`                                     |
| Node.js          | A supported version satisfying `>=22.12.0` |

The configured Vercel build runs `build`, so run `check` locally or in CI before releasing. Include the lockfile, build plugin, config modules, source models, and their external textures in Git. No application environment variables are currently required. Vite support is described in the [official Vercel guide](https://vercel.com/docs/frameworks/frontend/vite).

## Asset URLs and cache policy

`/assets/*` receives `Cache-Control: public, max-age=31536000, immutable`. Vite fingerprints application assets, while the custom plugin fingerprints complete model packs and preserves GLB-relative texture paths. Rebuild after model or texture edits so clients receive a new pack URL.

The root page, HTML pages, and `asset-manifest.json` revalidate with `public, max-age=0, must-revalidate`. Keep HTML and its generated assets from the same build together.

For a missing model or texture, check `src/config/assets.js`, exact filename case, and the source GLB's relative dependencies, then rebuild and run verification. See [configuration](configuration.md), [architecture](architecture.md), or the [README](../README.md).

<!-- Last reviewed: 2026-10-22. -->
