import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CONFIG } from '../src/config/site.js';
import { SCENERY_PACKS, SCENERY_SITES } from '../src/config/scenery.js';
import { createScenery } from '../src/scenes/scenery.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(t, mobile, fail) {
  const calls = [];
  const layout = SCENERY_SITES[0];
  const item = layout.items[1];
  const failedSource = `kits/${SCENERY_PACKS[item[0]]}/Models/GLB format/${item[1]}.glb`;
  const warnings = t.mock.method(console, 'warn', () => {});
  const scenery = createScenery({
    config: { ...CONFIG, performance: { ...CONFIG.performance, sceneryPreloadDistance: 2 } },
    quality: { mobile },
    reducedMotion: () => true,
    invalidate() {},
    assets: { load(source) {
      calls.push(source);
      if (source === failedSource) {
        const failure = fail(calls.filter((call) => call === source).length);
        if (failure) return failure;
      }
      return Promise.resolve(new T.Mesh(new T.BoxGeometry(2, 1, 1), new T.MeshBasicMaterial()));
    } },
    shadow(parent) {
      const shadow = new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
      parent.add(shadow);
      return shadow;
    },
  });
  return {
    calls, failedSource, warnings,
    site: scenery.group.children[0],
    visit: () => scenery.update({ position: { x: layout.x } }, 0, true),
    leave: () => scenery.update({ position: { x: 0 } }, 0, true),
    count: mobile ? Math.min(layout.items.length, CONFIG.scenery.mobileItems) : layout.items.length,
  };
}

for (const mobile of [false, true]) {
  test(`scenery retries only failed items on re-entry (${mobile ? 'mobile' : 'desktop'})`, async (t) => {
    const f = fixture(t, mobile, (attempt) => attempt === 1 ? Promise.reject(new Error('offline')) : null);
    f.leave();
    assert.equal(f.calls.length, 0);
    f.visit();
    await flush();
    assert.equal(f.calls.length, f.count);
    assert.equal(f.warnings.mock.callCount(), 1);
    const successfulChildren = [...f.site.children];
    for (let frame = 0; frame < 20; frame++) f.visit();
    await flush();
    assert.equal(f.calls.length, f.count, 'Failure must not cause per-frame retries');
    f.leave();
    f.visit();
    await flush();
    assert.equal(f.calls.length, f.count + 1);
    assert.equal(f.calls.at(-1), f.failedSource);
    assert.equal(f.site.children.length, successfulChildren.length + 2, 'Only the failed model and its shadow should be added');
    for (const child of successfulChildren) assert.ok(f.site.children.includes(child));
    f.leave();
    f.visit();
    await flush();
    assert.equal(f.calls.length, f.count + 1, 'A recovered site must not duplicate successful items');
    assert.equal(f.warnings.mock.callCount(), 1);
  });
}

test('crossing the range during a pending load does not duplicate it or retry a late failure in the same visit', async (t) => {
  let reject;
  const pending = new Promise((_, no) => { reject = no; });
  const f = fixture(t, false, (attempt) => attempt === 1 ? pending : null);
  f.visit();
  await flush();
  f.leave();
  f.visit();
  assert.equal(f.calls.length, f.count, 'Pending items must not be queued again');
  reject(new Error('late network failure'));
  await flush();
  f.visit();
  await flush();
  assert.equal(f.calls.length, f.count, 'A late failure must wait for another range entry');
  f.leave();
  f.visit();
  await flush();
  assert.equal(f.calls.length, f.count + 1);
  assert.equal(f.warnings.mock.callCount(), 1);
});

test('persistent scenery failures log once per visit rather than once per frame', async (t) => {
  const f = fixture(t, false, () => Promise.reject(new Error('still offline')));
  for (let visit = 1; visit <= 3; visit++) {
    f.visit();
    await flush();
    for (let frame = 0; frame < 20; frame++) f.visit();
    await flush();
    assert.equal(f.warnings.mock.callCount(), visit);
    assert.equal(f.calls.length, f.count + visit - 1);
    f.leave();
  }
});
