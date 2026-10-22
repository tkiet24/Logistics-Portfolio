# Logistics Portfolio

A Vite and Three.js logistics portfolio for Bui Thi Kieu Nga, with Home, About, Skills, Work, and Contact scenes. Readable HTML and navigation remain available when WebGL is unavailable.

## Run locally

Use Node.js **22.12 or newer**, with npm. Run commands from this directory, beside `package.json`:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In Windows PowerShell, use **`npm.cmd`** instead of `npm`: `npm.cmd ci`, `npm.cmd run dev`, and `npm.cmd run check`. This avoids PowerShell blocking the `npm.ps1` wrapper.

## Validate and preview

```sh
npm run check
npm run preview
```

`check` runs Node tests, builds `dist/`, and verifies emitted assets and local references. `preview` serves that production build locally. Individual commands are `npm test`, `npm run build`, and `npm run verify`; verification requires an existing build. Serve through Vite rather than opening `index.html` as a file.

## Documentation

- [Portfolio content template](docs/portfolio-content-template.md): fill-in prompts for each section and optional case studies.
- [Architecture](docs/architecture.md): source map, scene lifecycle, loading, rendering, and debug statistics.
- [Configuration](docs/configuration.md): content, visual tokens, scene settings, and the model allowlist.
- [Deployment](docs/deployment.md): local release checks and Vercel import settings.

Source models live in `kits/`; production includes only allowlisted models and their dependencies. Keep model credits in `index.html` and the supplied asset licenses when reusing them.

The CV download uses `CV_KieuNga_LogisticsIntern.pdf` from the project root. Keep that source file in Git; Vite bundles it under a fingerprinted URL, and `verify` checks that the output matches the original PDF.

<!-- Last reviewed: 2026-10-22. -->
