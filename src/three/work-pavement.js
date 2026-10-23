import * as T from "three";
import { extendRoad } from "./ribbon.js";

/** A bounded paved city block whose front edge meets the inside road shoulder. */
export function createWorkPavement(curve, config, lowDetail) {
  const road = config.work.road;
  const route = extendRoad(curve, road.exitReach, road.exitDepth);
  const front = [], halfWidth = road.width / 2 + .18;
  const segments = lowDetail ? 180 : 320;
  for (let i = 0; i <= segments; i++) {
    const point = route.getPointAt(i / segments);
    const tangent = route.getTangentAt(i / segments);
    const length = Math.hypot(tangent.x, tangent.z) || 1;
    // The city is on the -Z side of the route as it runs from left to right.
    const x = point.x + tangent.z / length * halfWidth;
    const z = point.z - tangent.x / length * halfWidth;
    if (x >= -18 && x <= 18 && z >= -15) front.push(new T.Vector2(x, -z));
  }
  const shape = new T.Shape();
  shape.moveTo(-18, 15);
  shape.lineTo(-18, front[0].y);
  for (const point of front) shape.lineTo(point.x, point.y);
  shape.lineTo(18, front.at(-1).y);
  shape.lineTo(18, 15);
  shape.closePath();

  const material = new T.MeshStandardMaterial({ color: 0x626c70, roughness: .96 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 pavementPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\npavementPosition = position.xz;");
    shader.fragmentShader = "varying vec2 pavementPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec2 tile = abs(fract(pavementPosition / 1.4 + .5) - .5);
      float joint = smoothstep(.482, .498, max(tile.x, tile.y));
      float grain = fract(sin(dot(floor(pavementPosition * 65.0), vec2(12.9898,78.233))) * 43758.5453);
      diffuseColor.rgb *= (.97 + .06 * grain) * (1.0 - .13 * joint);
    `);
  };
  material.customProgramCacheKey = () => "work-city-pavement-v1";
  const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, {
    depth: .08, bevelEnabled: false, steps: 1, curveSegments: 1,
  }).rotateX(-Math.PI / 2), material);
  mesh.name = "Work city pavement";
  // Top at floorY + .002: below road, shadows, lamps and building bases.
  mesh.position.y = config.layout.floorY - .078;
  mesh.renderOrder = -4;
  return mesh;
}
