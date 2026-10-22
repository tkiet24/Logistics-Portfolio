import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const virtualId = "virtual:portfolio-assets";
const resolvedId = `\0${virtualId}`;
const slash = (value) => value.split(path.sep).join("/");
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const encodePath = (value) =>
  value.split("/").map(encodeURIComponent).join("/");

export function assertWithin(root, file) {
  const relative = path.relative(root, file);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Asset path escapes ${root}: ${file}`);
  }
  return file;
}

// Validate the complete GLB envelope, then read its JSON without changing model bytes.
export function parseGlb(bytes, label = "GLB") {
  if (
    bytes.length < 20 ||
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  ) {
    throw new Error(`Invalid GLB header: ${label}`);
  }
  let json;
  for (let offset = 12; offset < bytes.length; ) {
    if (offset + 8 > bytes.length)
      throw new Error(`Truncated GLB chunk: ${label}`);
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (length % 4 || end > bytes.length)
      throw new Error(`Invalid GLB chunk: ${label}`);
    if (offset === 12 && type !== 0x4e4f534a)
      throw new Error(`Missing GLB JSON: ${label}`);
    if (type === 0x4e4f534a) {
      if (json) throw new Error(`Duplicate GLB JSON: ${label}`);
      json = JSON.parse(
        bytes
          .subarray(offset + 8, end)
          .toString("utf8")
          .trim(),
      );
    }
    offset = end;
  }
  if (!json || json.asset?.version !== "2.0")
    throw new Error(`Invalid glTF JSON: ${label}`);
  return json;
}

export function externalUris(json) {
  return [
    ...new Set(
      [...(json.images ?? []), ...(json.buffers ?? [])]
        .map((item) => item.uri)
        .filter((uri) => uri !== undefined)
        .map((uri) => {
          if (typeof uri !== "string")
            throw new Error("GLB URI must be a string");
          return uri;
        })
        .filter((uri) => !/^data:/i.test(uri)),
    ),
  ];
}

export function dependencyPath(model, uri, root) {
  const decoded = decodeURIComponent(uri);
  if (
    !decoded ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    /[?#]/.test(uri) ||
    /[\\\0]/.test(decoded) ||
    decoded.startsWith("/")
  ) {
    throw new Error(`GLB dependency must be a local relative path: ${uri}`);
  }
  return assertWithin(root, path.resolve(path.dirname(model), decoded));
}

// Length framing prevents ambiguous path/content concatenations; paths affect the hash too.
export function fingerprintFiles(files) {
  const hash = createHash("sha256");
  for (const [name, bytes] of [...files].sort(([a], [b]) => compare(a, b))) {
    hash.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`);
    hash.update(bytes);
  }
  return hash.digest("hex").slice(0, 16);
}

async function workspaceFile(root, file) {
  assertWithin(root, file);
  assertWithin(await realpath(root), await realpath(file));
  return readFile(file);
}

function commonDirectory(files) {
  let directory = path.dirname(files[0]);
  for (const file of files) {
    while (path.relative(directory, file).split(path.sep)[0] === "..") {
      directory = path.dirname(directory);
    }
  }
  return directory;
}

export async function planAssets(root, sources) {
  if (
    !Array.isArray(sources) ||
    !sources.length ||
    new Set(sources).size !== sources.length
  ) {
    throw new Error(
      "ASSET_SOURCES must be a nonempty array of unique project-relative GLB paths",
    );
  }
  const groups = new Map();
  const models = new Map();
  for (const source of [...sources].sort(compare)) {
    if (
      typeof source !== "string" ||
      !source.startsWith("kits/") ||
      path.posix.normalize(source) !== source ||
      source.includes("\\") ||
      !source.endsWith(".glb")
    ) {
      throw new Error(`Invalid ASSET_SOURCES path: ${source}`);
    }
    const file = assertWithin(root, path.resolve(root, source));
    const bytes = await workspaceFile(root, file);
    const dependencies = externalUris(parseGlb(bytes, source));
    const key = source.split("/").length === 2 ? "root" : source.split("/")[1];
    if (!groups.has(key)) groups.set(key, { models: [], files: new Map() });
    const group = groups.get(key);
    group.models.push(source);
    group.files.set(file, bytes);
    for (const uri of dependencies) {
      const dependency = dependencyPath(file, uri, root);
      if (!group.files.has(dependency))
        group.files.set(dependency, await workspaceFile(root, dependency));
    }
    models.set(source, { sourceBytes: bytes.length, dependencies });
  }
  const files = new Map();
  const entries = {};
  const packs = [];
  const emittedSources = new Set();
  for (const [key, group] of groups) {
    const directory = commonDirectory([...group.files.keys()]);
    const relativeFiles = new Map(
      [...group.files].map(([file, bytes]) => [
        slash(path.relative(directory, file)),
        bytes,
      ]),
    );
    const hash = fingerprintFiles(relativeFiles);
    const name = key.toLowerCase().replace(/[^a-z\d-]+/g, "-");
    const prefix = `assets/models/${name}-${hash}`;
    for (const [file, bytes] of group.files) {
      // A cross-pack shared source cannot be copied twice while preserving its URI.
      if (emittedSources.has(file))
        throw new Error(`Shared dependency crosses pack boundaries: ${file}`);
      emittedSources.add(file);
      files.set(`${prefix}/${slash(path.relative(directory, file))}`, bytes);
    }
    for (const source of group.models) {
      const file = `${prefix}/${slash(path.relative(directory, path.resolve(root, source)))}`;
      entries[source] = {
        url: encodePath(file),
        file,
        ...models.get(source),
        emittedBytes: models.get(source).sourceBytes,
      };
    }
    packs.push({
      name,
      hash,
      directory: prefix,
      files: relativeFiles.size,
      emittedBytes: [...relativeFiles.values()].reduce(
        (sum, bytes) => sum + bytes.length,
        0,
      ),
    });
  }
  return { files, entries, packs, watchFiles: [...emittedSources] };
}

async function readSources(root) {
  const file = path.resolve(root, "src/config/assets.js");
  const { mtimeMs } = await stat(file);
  return (await import(`${pathToFileURL(file).href}?modified=${mtimeMs}`))
    .ASSET_SOURCES;
}

export default function portfolioAssets() {
  let config;
  let plan;
  return {
    name: "portfolio-assets",
    configResolved(resolved) {
      config = resolved;
      const [major, minor] = process.versions.node.split(".").map(Number);
      if (major < 22 || (major === 22 && minor < 12))
        throw new Error("Node.js >=22.12 is required");
    },
    async buildStart() {
      plan = await planAssets(config.root, await readSources(config.root));
      this.addWatchFile(path.resolve(config.root, "src/config/assets.js"));
      for (const file of plan.watchFiles) this.addWatchFile(file);
      if (config.command !== "build") return;
      for (const [fileName, source] of plan.files)
        this.emitFile({ type: "asset", fileName, source });
    },
    resolveId(id) {
      return id === virtualId ? resolvedId : null;
    },
    load(id) {
      if (id !== resolvedId) return null;
      const urls = Object.fromEntries(
        Object.entries(plan.entries).map(([source, entry]) => [
          source,
          config.command === "build" ? entry.url : encodePath(source),
        ]),
      );
      return `const paths = ${JSON.stringify(urls)};
const base = import.meta.env.BASE_URL;
export default Object.freeze(Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, base + value])));`;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const assetBytes = [...plan.files.values()].reduce(
          (sum, bytes) => sum + bytes.length,
          0,
        );
        const manifest = {
          version: 1,
          base: config.base,
          assets: plan.entries,
          packs: plan.packs,
          totals: {
            models: Object.keys(plan.entries).length,
            files: plan.files.size,
            sourceBytes: Object.values(plan.entries).reduce(
              (sum, entry) => sum + entry.sourceBytes,
              0,
            ),
            emittedBytes: assetBytes,
            buildBytes: Object.values(bundle).reduce(
              (sum, item) =>
                sum +
                (item.type === "chunk"
                  ? Buffer.byteLength(item.code)
                  : Buffer.byteLength(item.source)),
              0,
            ),
          },
        };
        const report = [
          "Portfolio asset sizes (uncompressed bytes)",
          "source => URL | source bytes | emitted GLB bytes",
          ...Object.entries(plan.entries).map(
            ([source, entry]) =>
              `${source} => ${entry.url} | ${entry.sourceBytes} | ${entry.emittedBytes}`,
          ),
          "",
          JSON.stringify(manifest.totals, null, 2),
          "sourceBytes counts GLBs; emittedBytes includes each external dependency once.",
          "buildBytes excludes this manifest and report. URLs are relative to base.",
        ].join("\n");
        this.emitFile({
          type: "asset",
          fileName: "asset-manifest.json",
          source: JSON.stringify(manifest, null, 2),
        });
        this.emitFile({
          type: "asset",
          fileName: "asset-size-report.txt",
          source: report,
        });
        config.logger.info(
          `Portfolio assets: ${manifest.totals.models} GLBs, ${plan.files.size} files, ${(assetBytes / 1048576).toFixed(2)} MiB`,
        );
      },
    },
    configureServer(server) {
      // Vite's root static server preserves original GLB-relative texture URLs.
      // Intercept missing kit files so they never reach Vite's HTML fallback.
      server.middlewares.use(async (req, res, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent((req.url ?? "").split("?")[0]);
        } catch {
          res.statusCode = 400;
          res.end("Invalid asset URL");
          return;
        }
        if (pathname.startsWith(config.base) && config.base !== "/")
          pathname = `/${pathname.slice(config.base.length)}`;
        if (!pathname.startsWith("/kits/")) return next();
        try {
          const kits = path.resolve(config.root, "kits");
          const file = assertWithin(
            kits,
            path.resolve(config.root, pathname.slice(1)),
          );
          if (!plan.watchFiles.includes(file))
            throw new Error(
              "Asset is outside ASSET_SOURCES and their dependencies",
            );
          assertWithin(await realpath(kits), await realpath(file));
          if (!(await stat(file)).isFile()) throw new Error("Not a file");
          const types = {
            ".glb": "model/gltf-binary",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
          };
          res.setHeader(
            "Content-Type",
            types[path.extname(file)] ?? "application/octet-stream",
          );
          res.setHeader("Cache-Control", "no-cache");
          if (req.method === "HEAD") return res.end();
          createReadStream(file)
            .on("error", () => res.destroy())
            .pipe(res);
        } catch {
          res.statusCode = 404;
          res.end("Asset not found");
        }
      });
    },
    async handleHotUpdate(context) {
      if (
        !slash(context.file).includes("/kits/") &&
        slash(context.file) !==
          slash(path.resolve(config.root, "src/config/assets.js"))
      )
        return;
      plan = await planAssets(config.root, await readSources(config.root));
      const module = context.server.moduleGraph.getModuleById(resolvedId);
      if (module) context.server.moduleGraph.invalidateModule(module);
      context.server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
