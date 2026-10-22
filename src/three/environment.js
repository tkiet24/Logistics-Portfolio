import * as T from "three";
import { createRandom } from "../core/math.js";

export function createEnvironment(config, quality) {
  const group = new T.Group(),
    random = createRandom(1327),
    count = quality.mobile ? 180 : 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++)
    positions.set(
      [
        random() * config.layout.sceneSpacing * 5 - 20,
        (random() - 0.5) * 14,
        -14 + random() * 16,
      ],
      i * 3,
    );
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  const material = new T.PointsMaterial({
    size: 0.035,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  group.add(new T.Points(geometry, material));
  const points = [],
    y = config.layout.floorY + 0.015;
  for (const [start, end, z] of [
    [2.8, 18.5, 1.4],
    [60.5, 75.5, 1.4],
    [84.5, 104, 1.4],
    [136, 152.5, 0],
  ]) {
    for (let x = start; x < end; x += 1.2)
      points.push(x, y, z, Math.min(end, x + 0.6), y, z);
  }
  const lineGeometry = new T.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(points, 3),
  );
  group.add(
    new T.LineSegments(
      lineGeometry,
      new T.LineBasicMaterial({
        color: config.palette.accent,
        transparent: true,
        opacity: 0.35,
      }),
    ),
  );
  return {
    group,
    theme(tokens) {
      material.color.set(tokens.dot);
    },
  };
}
