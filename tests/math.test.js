import test from "node:test";
import assert from "node:assert/strict";
import {
  damp,
  distanceStops,
  nearestStop,
  scrollState,
  shortestAngle,
} from "../src/core/math.js";

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

const tops = [0, 1000, 2000, 3000, 5000, 6000];

test("Work holds the scene while its content advances, then exits continuously", () => {
  const entry = scrollState(3000, tops);
  assert.deepEqual(entry, {
    progress: 3,
    rawProgress: 3,
    workProgress: 0,
    section: 3,
  });

  const middle = scrollState(3880, tops);
  assert.equal(middle.progress, 3);
  close(middle.rawProgress, 3.44);
  close(middle.workProgress, 0.5);

  const holdEnd = scrollState(4760, tops);
  close(holdEnd.progress, 3);
  close(holdEnd.workProgress, 1);
  const exit = scrollState(4880, tops);
  close(exit.progress, 3.5);
  assert.equal(exit.workProgress, 1);

  const beforeNextSection = scrollState(5000 - 1e-6, tops);
  assert.ok(
    beforeNextSection.progress > 3.99999 && beforeNextSection.progress < 4,
  );
  assert.deepEqual(scrollState(5000, tops), {
    progress: 4,
    rawProgress: 4,
    workProgress: 1,
    section: 4,
  });
});

test("WebGL fallback follows document progress throughout Work without a scene hold", () => {
  const fallback = scrollState(3880, tops, 0.88, false);
  close(fallback.progress, 3.44);
  close(fallback.progress, fallback.rawProgress);
  close(fallback.workProgress, 0.5);
  assert.equal(fallback.section, 3);
  close(scrollState(4880, tops, 0.88, false).progress, 3.94);
});

test("scroll progress clamps overscroll and supports a configured Work hold fraction", () => {
  assert.deepEqual(scrollState(-200, tops), {
    progress: 0,
    rawProgress: 0,
    workProgress: 0,
    section: 0,
  });
  assert.deepEqual(scrollState(7000, tops), {
    progress: 5,
    rawProgress: 5,
    workProgress: 1,
    section: 5,
  });
  const customExit = scrollState(4800, tops, 0.8);
  close(customExit.progress, 3.5);
  assert.equal(customExit.workProgress, 1);
});

test("damping reaches the same position after equal time at 30, 60, and 120 FPS", () => {
  const duration = 2;
  const rate = 4;
  const expected = 10 * (1 - Math.exp(-rate * duration));
  const results = [30, 60, 120].map((fps) => {
    let position = 0;
    for (let frame = 0; frame < duration * fps; frame++)
      position = damp(position, 10, rate, 1 / fps);
    close(position, expected);
    return position;
  });
  close(results[0], results[1]);
  close(results[1], results[2]);
  assert.equal(damp(7, 10, rate, 0), 7);
  const falling = damp(10, 0, rate, 1 / 30);
  assert.ok(
    falling > 0 && falling < 10,
    "Damping must converge from above without overshooting",
  );
});

test("shortest-angle rotation crosses the wrap boundary in either direction", () => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  close(shortestAngle(radians(179), radians(-179)), radians(2));
  close(shortestAngle(radians(-179), radians(179)), radians(-2));
  close(shortestAngle(radians(350), radians(10)), radians(20));
  close(shortestAngle(8 * Math.PI + 0.2, -0.2), -0.4);
  close(shortestAngle(1, 1), 0);
});

test("nearestStop uses actual stop midpoints, advances on ties, and clamps the ends", () => {
  const stops = [0, 0.1, 0.65, 1];
  for (const [position, expected] of [
    [-1, 0],
    [0.049, 0],
    [0.05, 1],
    [0.3749, 1],
    [0.375, 2],
    [0.8, 2],
    [0.826, 3],
    [2, 3],
  ])
    assert.equal(
      nearestStop(position, stops),
      expected,
      `Wrong stop for position ${position}`,
    );
  assert.equal(nearestStop(0.7, [0.4]), 0);
});

test("distanceStops converts nonuniform curve samples to normalized travelled distance", () => {
  const curve = { getLengths: () => [0, 1, 4, 10] };
  const stops = distanceStops(curve, [0, 1 / 3, 0.5, 2 / 3, 1]);
  const expected = [0, 0.1, 0.25, 0.4, 1];
  stops.forEach((stop, index) => close(stop, expected[index]));
});
