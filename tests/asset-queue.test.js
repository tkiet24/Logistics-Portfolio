import test from "node:test";
import assert from "node:assert/strict";
import { AssetQueue } from "../src/core/asset-queue.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test(
  "AssetQueue limits simultaneous loads and fills each released slot",
  { timeout: 2000 },
  async () => {
    const gates = new Map(["a", "b", "c", "d"].map((key) => [key, deferred()]));
    const started = [];
    let inFlight = 0,
      peak = 0;
    const changes = [];
    const queue = new AssetQueue({
      concurrency: 2,
      onChange: (stats) => changes.push(stats),
      load: async (key) => {
        started.push(key);
        peak = Math.max(peak, ++inFlight);
        try {
          return await gates.get(key).promise;
        } finally {
          inFlight--;
        }
      },
    });
    const requests = [...gates.keys()].map((key) => queue.load(key));
    await flush();
    assert.deepEqual(started, ["a", "b"]);
    assert.equal(queue.stats().active, 2);
    assert.equal(queue.stats().queued, 2);

    gates.get("b").resolve("B");
    await flush();
    assert.deepEqual(started, ["a", "b", "c"]);
    assert.equal(inFlight, 2);
    gates.get("a").resolve("A");
    await flush();
    assert.deepEqual(started, ["a", "b", "c", "d"]);
    assert.equal(peak, 2);
    gates.get("c").resolve("C");
    gates.get("d").resolve("D");
    assert.deepEqual(await Promise.all(requests), ["A", "B", "C", "D"]);
    await flush();
    assert.deepEqual(queue.stats(), {
      active: 0,
      queued: 0,
      completed: 4,
      failed: 0,
      cached: 4,
    });
    assert.equal(changes.length, 4);
    assert.equal(changes.at(-1).completed, 4);
  },
);

test(
  "queued priority and later promotion select the next load without duplicating it",
  { timeout: 2000 },
  async () => {
    const keys = ["visible", "background", "nearby", "urgent"];
    const gates = new Map(keys.map((key) => [key, deferred()]));
    const started = [];
    const queue = new AssetQueue({
      concurrency: 1,
      load: (key) => {
        started.push(key);
        return gates.get(key).promise;
      },
    });
    const visible = queue.load("visible");
    const background = queue.load("background", { priority: 100 });
    const nearby = queue.load("nearby", { priority: 10 });
    const urgent = queue.load("urgent", { priority: -1 });
    const promoted = queue.load("background", { priority: -5 });
    await flush();
    assert.deepEqual(
      started,
      ["visible"],
      "An active download must not be preempted",
    );
    for (const [finished, expectedNext] of [
      ["visible", "background"],
      ["background", "urgent"],
      ["urgent", "nearby"],
    ]) {
      gates.get(finished).resolve(finished);
      await flush();
      assert.equal(started.at(-1), expectedNext);
    }
    gates.get("nearby").resolve("nearby");
    await Promise.all([visible, background, nearby, urgent, promoted]);
    await flush();
    assert.deepEqual(started, ["visible", "background", "urgent", "nearby"]);
    assert.equal(queue.stats().completed, 4);
  },
);

test(
  "concurrent and cached consumers share a single load but receive independent clones",
  { timeout: 2000 },
  async () => {
    const gate = deferred();
    let loads = 0,
      clones = 0;
    const original = {
      scene: { position: { x: 0 }, children: [{ name: "cargo" }] },
    };
    const queue = new AssetQueue({
      load: () => {
        loads++;
        return gate.promise;
      },
      clone: (asset) => {
        clones++;
        return structuredClone(asset);
      },
    });
    const first = queue.load("cargo.glb");
    const second = queue.load("cargo.glb");
    await flush();
    assert.equal(loads, 1);
    gate.resolve(original);
    const [a, b] = await Promise.all([first, second]);
    assert.notStrictEqual(a, b);
    assert.notStrictEqual(a.scene, b.scene);
    a.scene.position.x = 42;
    a.scene.children[0].name = "changed";
    assert.equal(b.scene.position.x, 0);
    assert.equal(b.scene.children[0].name, "cargo");
    const cached = await queue.load("cargo.glb");
    assert.deepEqual(cached, original);
    assert.notStrictEqual(cached, b);
    assert.equal(original.scene.position.x, 0);
    assert.equal(loads, 1);
    assert.equal(clones, 3);
  },
);

for (const synchronous of [false, true]) {
  test(
    `a ${synchronous ? "synchronous throw" : "rejected load"} releases the slot and can be retried`,
    { timeout: 2000 },
    async () => {
      const failure = new Error("Model unavailable");
      const healthyGate = deferred();
      const started = [];
      let attempts = 0;
      const queue = new AssetQueue({
        concurrency: 1,
        load: (key) => {
          started.push(key);
          if (key === "healthy") return healthyGate.promise;
          if (++attempts === 1) {
            if (synchronous) throw failure;
            return Promise.reject(failure);
          }
          return { recovered: true };
        },
      });
      const firstFailure = queue.load("flaky");
      const duplicateFailure = queue.load("flaky");
      const healthy = queue.load("healthy");
      // Attach both handlers before the loader gets its first microtask.
      await Promise.all(
        [firstFailure, duplicateFailure].map((request) =>
          assert.rejects(request, (error) => error === failure),
        ),
      );
      await flush();
      assert.deepEqual(started, ["flaky", "healthy"]);
      assert.equal(attempts, 1);
      assert.deepEqual(queue.stats(), {
        active: 1,
        queued: 0,
        completed: 0,
        failed: 1,
        cached: 1,
      });
      const retry = queue.load("flaky");
      assert.equal(queue.stats().queued, 1);
      healthyGate.resolve("healthy model");
      assert.equal(await healthy, "healthy model");
      assert.deepEqual(await retry, { recovered: true });
      await flush();
      assert.equal(attempts, 2);
      assert.deepEqual(started, ["flaky", "healthy", "flaky"]);
      assert.deepEqual(queue.stats(), {
        active: 0,
        queued: 0,
        completed: 2,
        failed: 1,
        cached: 2,
      });
    },
  );
}
