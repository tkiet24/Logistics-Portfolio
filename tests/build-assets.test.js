import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dependencyPath,
  encodePath,
  externalUris,
  fingerprintFiles,
  parseGlb,
  planAssets,
} from "../build/asset-plugin.js";

const root = fileURLToPath(new URL("../", import.meta.url));

function makeGlb(
  json = { asset: { version: "2.0" }, buffers: [{ byteLength: 8 }] },
) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonLength = Math.ceil(text.length / 4) * 4;
  const bytes = Buffer.alloc(12 + 8 + jsonLength + 8 + 8);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(0x20, 20, 20 + jsonLength);
  text.copy(bytes, 20);
  bytes.writeUInt32LE(8, 20 + jsonLength);
  bytes.writeUInt32LE(0x004e4942, 24 + jsonLength);
  return bytes;
}

test("pack fingerprints are deterministic but invalidate for changed bytes or filenames", () => {
  const glb = makeGlb();
  const texture = Buffer.from([0, 1, 2, 3]);
  const files = new Map([
    ["cargo.glb", glb],
    ["Textures/colormap.png", texture],
  ]);
  const original = fingerprintFiles(files);
  assert.match(original, /^[a-f\d]{16}$/);
  assert.equal(
    fingerprintFiles(new Map([...files].reverse())),
    original,
    "Input ordering must not affect deployment URLs",
  );
  assert.notEqual(
    fingerprintFiles(
      new Map([
        ["cargo.glb", glb],
        ["Textures/colormap.png", Buffer.from([0, 1, 2, 4])],
      ]),
    ),
    original,
    "A same-size shared texture edit must invalidate the pack",
  );
  assert.notEqual(
    fingerprintFiles(
      new Map([
        ["renamed.glb", glb],
        ["Textures/colormap.png", texture],
      ]),
    ),
    original,
    "Renaming a file must invalidate the pack even when its bytes are unchanged",
  );
  const changedGlb = Buffer.from(glb);
  changedGlb[changedGlb.length - 1] = 1;
  assert.notEqual(
    fingerprintFiles(
      new Map([
        ["cargo.glb", changedGlb],
        ["Textures/colormap.png", texture],
      ]),
    ),
    original,
    "A model edit must invalidate the pack",
  );
});

test("valid GLB JSON is decoded while embedded binary payloads stay untouched", () => {
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: 8 }],
    images: [{ uri: "Textures/colormap.png" }],
  };
  const bytes = makeGlb(json);
  const before = Buffer.from(bytes);
  assert.deepEqual(parseGlb(bytes, "cargo.glb"), json);
  assert.ok(bytes.equals(before));
});

test("truncated GLBs fail both at the envelope and within advertised chunk lengths", () => {
  const valid = makeGlb();
  assert.throws(() => parseGlb(valid.subarray(0, 8)), /Invalid GLB header/);
  assert.throws(() => parseGlb(valid.subarray(0, -1)), /Invalid GLB header/);
  // Repairing total length must not hide a truncated BIN payload.
  const truncatedPayload = Buffer.from(valid.subarray(0, -4));
  truncatedPayload.writeUInt32LE(truncatedPayload.length, 8);
  assert.throws(() => parseGlb(truncatedPayload), /Invalid GLB chunk/);
  const truncatedChunkHeader = Buffer.concat([valid, Buffer.alloc(4)]);
  truncatedChunkHeader.writeUInt32LE(truncatedChunkHeader.length, 8);
  assert.throws(() => parseGlb(truncatedChunkHeader), /Truncated GLB chunk/);
});

test("invalid GLB magic, version, first chunk, and unaligned chunks are rejected", () => {
  for (const [offset, value, message] of [
    [0, 0, /Invalid GLB header/],
    [4, 1, /Invalid GLB header/],
    [16, 0x004e4942, /Missing GLB JSON/],
    [12, 3, /Invalid GLB chunk/],
  ]) {
    const bytes = makeGlb();
    bytes.writeUInt32LE(value, offset);
    assert.throws(() => parseGlb(bytes), message);
  }
  assert.throws(
    () => parseGlb(makeGlb({ asset: { version: "1.0" } })),
    /Invalid glTF JSON/,
  );
});

test("external URI enumeration deduplicates images and buffers and ignores embedded resources", () => {
  const json = {
    images: [
      { uri: "Textures/shared.png" },
      { uri: "Textures/shared.png" },
      { bufferView: 0 },
      { uri: "DATA:image/png;base64,AAAA" },
    ],
    buffers: [
      { byteLength: 8 },
      { uri: "geometry.bin" },
      { uri: "data:application/octet-stream;base64,AAAA" },
    ],
  };
  assert.deepEqual(externalUris(json), ["Textures/shared.png", "geometry.bin"]);
  assert.deepEqual(externalUris({}), []);
  assert.throws(
    () => externalUris({ images: [{ uri: 12 }] }),
    /URI must be a string/,
  );
});

test("external paths preserve encoded filename characters and safe relative parent paths", () => {
  const model = path.join(root, "kits", "pack", "Models", "cargo.glb");
  assert.equal(
    dependencyPath(model, "Textures/color%20map%23a.png", root),
    path.join(root, "kits", "pack", "Models", "Textures", "color map#a.png"),
  );
  assert.equal(
    dependencyPath(model, "../Textures/shared.png", root),
    path.join(root, "kits", "pack", "Textures", "shared.png"),
  );
  assert.equal(
    encodePath("assets/models/pack hash/Textures/color map#a.png"),
    "assets/models/pack%20hash/Textures/color%20map%23a.png",
  );
});

test("unsafe external URIs cannot fetch remote files or escape the workspace", () => {
  const model = path.join(root, "kits", "cargo.glb");
  for (const uri of [
    "https://example.com/texture.png",
    "//example.com/texture.png",
    "file:///tmp/texture.png",
    "/absolute/texture.png",
    "C:/outside/texture.png",
    "../..%2foutside.png",
    "../../outside.png",
    "%2e%2e/%2e%2e/outside.png",
    "%2foutside.png",
    "Textures\\colormap.png",
    "Textures/%5ccolormap.png",
    "Textures/%00.png",
    "Textures/colormap.png?cache=1",
    "Textures/colormap.png#fragment",
    "",
    "%ZZ",
  ])
    assert.throws(
      () => dependencyPath(model, uri, root),
      undefined,
      `Unsafe URI accepted: ${JSON.stringify(uri)}`,
    );
});

test("planning a real pack emits only selected GLBs and one shared texture with relative paths intact", async () => {
  const sources = [
    "kits/factory-kit/Models/GLB format/conveyor.glb",
    "kits/factory-kit/Models/GLB format/conveyor-long.glb",
  ];
  const plan = await planAssets(root, sources);
  assert.deepEqual(Object.keys(plan.entries).sort(), [...sources].sort());
  assert.equal(plan.packs.length, 1);
  assert.equal(plan.files.size, 3);
  const textureFiles = [...plan.files.keys()].filter((file) =>
    file.endsWith("/Textures/colormap.png"),
  );
  assert.equal(textureFiles.length, 1);
  for (const source of sources) {
    const entry = plan.entries[source];
    assert.match(entry.file, /^assets\/models\/factory-kit-[a-f\d]{16}\//);
    assert.equal(entry.url, encodePath(entry.file));
    assert.ok(plan.files.has(entry.file));
    assert.deepEqual(externalUris(parseGlb(plan.files.get(entry.file))), [
      "Textures/colormap.png",
    ]);
    assert.equal(
      path.posix.join(path.posix.dirname(entry.file), "Textures/colormap.png"),
      textureFiles[0],
    );
  }
  assert.equal(
    plan.packs[0].emittedBytes,
    [...plan.files.values()].reduce((sum, bytes) => sum + bytes.length, 0),
  );
});

test("asset planning rejects duplicate and noncanonical source allowlists", async () => {
  const source = "kits/earth.glb";
  for (const sources of [
    [],
    [source, source],
    ["kits/../outside.glb"],
    ["src/model.glb"],
    ["kits/model.gltf"],
  ]) {
    await assert.rejects(planAssets(root, sources), /ASSET_SOURCES/);
  }
});
