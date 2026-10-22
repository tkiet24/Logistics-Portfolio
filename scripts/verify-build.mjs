import assert from "node:assert/strict";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertWithin,
  dependencyPath,
  encodePath,
  externalUris,
  fingerprintFiles,
  parseGlb,
} from "../build/asset-plugin.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = await realpath(path.resolve(root, process.argv[2] ?? "dist"));
const manifest = JSON.parse(
  await readFile(path.join(dist, "asset-manifest.json"), "utf8"),
);
assert.equal(manifest.version, 1, "Unsupported asset manifest version");
assert.equal(typeof manifest.base, "string", "Missing Vite base");
const { ASSET_SOURCES } = await import(
  pathToFileURL(path.join(root, "src/config/assets.js")).href
);
assert.deepEqual(
  Object.keys(manifest.assets).sort(),
  [...ASSET_SOURCES].sort(),
  "Manifest must match ASSET_SOURCES exactly",
);

async function readLocal(file) {
  assertWithin(dist, file);
  assertWithin(dist, await realpath(file));
  assert.ok((await stat(file)).isFile(), `Not a regular file: ${file}`);
  return readFile(file);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else files.push(file);
  }
  return files;
}

const allFiles = await walk(dist);
const relative = (file) => path.relative(dist, file).split(path.sep).join("/");
const expected = new Set();
const sourceToOutput = new Map();
let sourceBytes = 0;
for (const [source, entry] of Object.entries(manifest.assets)) {
  assert.match(
    entry.file,
    /^assets\/models\/[a-z\d-]+-[a-f\d]{16}\/.+\.glb$/,
    `Unfingerprinted model: ${source}`,
  );
  assert.equal(
    entry.url,
    encodePath(entry.file),
    `Wrong URL encoding: ${source}`,
  );
  const file = assertWithin(dist, path.resolve(dist, entry.file));
  const bytes = await readLocal(file);
  const original = await readFile(path.resolve(root, source));
  assert.ok(bytes.equals(original), `GLB bytes changed: ${source}`);
  assert.equal(
    bytes.length,
    entry.sourceBytes,
    `Wrong source byte count: ${source}`,
  );
  assert.equal(
    bytes.length,
    entry.emittedBytes,
    `Wrong emitted GLB byte count: ${source}`,
  );
  sourceBytes += bytes.length;
  expected.add(file);
  const uris = externalUris(parseGlb(bytes, entry.file));
  assert.deepEqual(
    uris,
    entry.dependencies,
    `Wrong dependency list: ${source}`,
  );
  for (const uri of uris) {
    const dependency = dependencyPath(file, uri, dist);
    const originalPath = dependencyPath(path.resolve(root, source), uri, root);
    const external = await readLocal(dependency);
    assert.ok(
      external.equals(await readFile(originalPath)),
      `Dependency bytes changed: ${uri}`,
    );
    if (sourceToOutput.has(originalPath)) {
      assert.equal(
        sourceToOutput.get(originalPath),
        dependency,
        `Duplicated shared dependency: ${uri}`,
      );
    }
    sourceToOutput.set(originalPath, dependency);
    expected.add(dependency);
  }
}

const actualModelFiles = allFiles.filter((file) =>
  relative(file).startsWith("assets/models/"),
);
assert.deepEqual(
  actualModelFiles.sort(),
  [...expected].sort(),
  "Unexpected or missing files in assets/models",
);
assert.deepEqual(
  allFiles.filter((file) => file.endsWith(".glb")).sort(),
  Object.values(manifest.assets)
    .map((entry) => path.resolve(dist, entry.file))
    .sort(),
  "Unexpected or missing emitted GLBs",
);
const packed = new Set();
let emittedBytes = 0;
for (const pack of manifest.packs) {
  assert.equal(pack.directory, `assets/models/${pack.name}-${pack.hash}`);
  const prefix = `${pack.directory}/`;
  const files = actualModelFiles.filter((file) =>
    relative(file).startsWith(prefix),
  );
  const content = new Map();
  let packBytes = 0;
  for (const file of files) {
    assert.ok(!packed.has(file), `Overlapping packs: ${file}`);
    packed.add(file);
    const bytes = await readLocal(file);
    content.set(relative(file).slice(prefix.length), bytes);
    packBytes += bytes.length;
  }
  assert.equal(
    fingerprintFiles(content),
    pack.hash,
    `Pack fingerprint mismatch: ${pack.name}`,
  );
  assert.equal(files.length, pack.files, `Wrong file count: ${pack.name}`);
  assert.equal(
    packBytes,
    pack.emittedBytes,
    `Wrong emitted size: ${pack.name}`,
  );
  emittedBytes += packBytes;
}
assert.equal(
  packed.size,
  expected.size,
  "Some model resources are outside fingerprinted packs",
);
assert.equal(manifest.totals.models, ASSET_SOURCES.length);
assert.equal(manifest.totals.files, expected.size);
assert.equal(manifest.totals.sourceBytes, sourceBytes);
assert.equal(manifest.totals.emittedBytes, emittedBytes);
const buildFiles = allFiles.filter(
  (file) =>
    !["asset-manifest.json", "asset-size-report.txt"].includes(relative(file)),
);
const buildSizes = await Promise.all(
  buildFiles.map(async (file) => (await readLocal(file)).length),
);
assert.equal(
  manifest.totals.buildBytes,
  buildSizes.reduce((sum, size) => sum + size, 0),
  "Wrong total build size",
);
assert.ok(
  (await readLocal(path.join(dist, "asset-size-report.txt"))).length,
  "Missing asset size report",
);

// Use a synthetic origin only to resolve local references, never to construct deployment URLs.
const origin = "https://build-verification.invalid";
const base = new URL(manifest.base || "./", `${origin}/`);
async function verifyReference(reference, owner) {
  if (!reference || reference.startsWith("#")) return;
  const url = new URL(
    reference.replaceAll("&amp;", "&"),
    new URL(encodePath(relative(owner)), base),
  );
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== base.origin)
    return;
  assert.ok(
    url.pathname.startsWith(base.pathname),
    `Reference escapes configured base: ${reference}`,
  );
  let name = decodeURIComponent(url.pathname.slice(base.pathname.length));
  if (!name || name.endsWith("/")) name += "index.html";
  await readLocal(path.resolve(dist, name));
}

const indexFile = path.join(dist, "index.html");
const html = (await readLocal(indexFile)).toString("utf8");
const cvAnchor = html.match(/<a\b(?=[^>]*\bdata-cv(?:\s|=|>))[^>]*>/i)?.[0];
assert.ok(cvAnchor, "Missing CV download link");
const cvHref = cvAnchor.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
assert.ok(cvHref, "CV download has no URL");
const cvUrl = new URL(cvHref, new URL("index.html", base));
assert.equal(cvUrl.origin, base.origin, "CV must be bundled locally");
assert.match(
  cvUrl.pathname,
  /\/assets\/[^/]+-[A-Za-z\d_-]{8,}\.pdf$/,
  "CV must have a fingerprinted URL",
);
const cvFile = path.resolve(
  dist,
  decodeURIComponent(cvUrl.pathname.slice(base.pathname.length)),
);
assert.deepEqual(
  await readLocal(cvFile),
  await readFile(path.join(root, "CV_KieuNga_LogisticsIntern.pdf")),
  "Bundled CV must preserve the original PDF bytes",
);
for (const match of html.matchAll(
  /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi,
)) {
  await verifyReference(match[1], indexFile);
}
for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
  if (match[1].startsWith("data:")) continue;
  for (const candidate of match[1].split(","))
    await verifyReference(candidate.trim().split(/\s+/)[0], indexFile);
}
const scripts = allFiles.filter((file) => file.endsWith(".js"));
const styles = allFiles.filter((file) => file.endsWith(".css"));
assert.ok(scripts.length, "No JavaScript assets emitted");
assert.ok(styles.length, "No CSS assets emitted");
assert.match(
  html,
  /<script\b[^>]*\bsrc\s*=/i,
  "index.html does not load built JavaScript",
);
assert.match(
  html,
  /<link\b[^>]*\bhref\s*=["'][^"']+\.css(?:[?#][^"']*)?["']/i,
  "index.html does not load built CSS",
);
for (const file of allFiles.filter((file) =>
  relative(file).startsWith("assets/"),
)) {
  assert.ok(
    relative(file).startsWith("assets/models/") ||
      /-[A-Za-z\d_-]{8,}\.[^.]+$/.test(file),
    `Immutable asset URL has no fingerprint: ${relative(file)}`,
  );
}
for (const file of styles) {
  const css = (await readLocal(file)).toString("utf8");
  for (const match of css.matchAll(
    /url\(\s*["']?([^\s"')]+)["']?\s*\)|@import\s*["']([^"']+)["']/g,
  )) {
    await verifyReference(match[1] ?? match[2], file);
  }
}
for (const file of scripts) {
  const js = (await readLocal(file)).toString("utf8");
  const imports =
    /\b(?:import|export)\s*(?:[^;"'()]*?\s*from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g;
  for (const match of js.matchAll(imports))
    await verifyReference(match[1] ?? match[2], file);
}

console.log("CV download verified: fingerprinted PDF matches the source.");
console.log(
  `Build verified: ${ASSET_SOURCES.length} GLBs, ${expected.size - ASSET_SOURCES.length} external resources, ${scripts.length} JS, ${styles.length} CSS; ${(emittedBytes / 1048576).toFixed(2)} MiB model assets. Base: ${manifest.base}`,
);
