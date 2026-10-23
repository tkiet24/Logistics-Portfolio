import * as T from "three";

/** Planar ribbon with distance-based UVs, shared by roads and railway ballast. */
export function createRibbonGeometry(curve, width, segments, height = 0) {
  const positions = new Float32Array((segments + 1) * 6);
  const uvs = new Float32Array((segments + 1) * 4);
  const indices = new Uint16Array(segments * 6);
  const point = new T.Vector3();
  const tangent = new T.Vector3();
  const length = curve.getLength();
  for (let i = 0; i <= segments; i++) {
    // CurvePath in Three r128 returns a new vector instead of filling a target.
    point.copy(curve.getPointAt(i / segments));
    tangent.copy(curve.getTangentAt(i / segments));
    const n = Math.hypot(tangent.x, tangent.z) || 1;
    for (let side = 0; side < 2; side++) {
      const offset = (side - 0.5) * width;
      positions.set(
        [
          point.x - (tangent.z / n) * offset,
          point.y + height,
          point.z + (tangent.x / n) * offset,
        ],
        i * 6 + side * 3,
      );
      uvs.set([(i / segments) * length, side], i * 4 + side * 2);
    }
    if (i < segments) {
      const v = i * 2;
      indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function extendRoad(curve, reach = 26, depth = 30) {
  const first = curve.getPoint(0);
  const last = curve.getPoint(1);
  const startTangent = curve.getTangent(0);
  const endTangent = curve.getTangent(1);
  const path = new T.CurvePath();
  path.add(
    new T.CubicBezierCurve3(
      new T.Vector3(-reach, first.y, -depth),
      new T.Vector3(-reach, first.y, -4),
      first.clone().addScaledVector(startTangent, -6),
      first,
    ),
  );
  path.add(curve);
  path.add(
    new T.CubicBezierCurve3(
      last,
      last.clone().addScaledVector(endTangent, 6),
      new T.Vector3(reach, last.y, -4),
      new T.Vector3(reach, last.y, -depth),
    ),
  );
  path.arcLengthDivisions = 1000;
  return path;
}

export function createRoad(curve, settings, lowDetail) {
  const roadCurve = extendRoad(curve, settings.exitReach, settings.exitDepth);
  const length = roadCurve.getLength();
  const group = new T.Group();
  group.name = "Continuous asphalt road";
  for (const shoulder of [true, false]) {
    const material = new T.MeshStandardMaterial({
      color: shoulder ? 0x777b75 : settings.colour,
      roughness: 0.96,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec2 roadUv;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nroadUv = uv;",
      );
      shader.fragmentShader = "varying vec2 roadUv;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        float grain = fract(sin(dot(floor(roadUv * vec2(85.0, 170.0)), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= 0.86 + grain * 0.22;
        float endFade = smoothstep(0.0, 8.0, roadUv.x) * smoothstep(0.0, 8.0, ${length.toFixed(6)} - roadUv.x);
        diffuseColor.a *= endFade;
        ${
          shoulder
            ? "diffuseColor.a *= smoothstep(0.0, 0.12, roadUv.y) * smoothstep(0.0, 0.12, 1.0-roadUv.y);"
            : `
        float edge = max(1.0 - smoothstep(0.007, 0.014, abs(roadUv.y - 0.075)), 1.0 - smoothstep(0.007, 0.014, abs(roadUv.y - 0.925)));
        float centre = (1.0 - smoothstep(0.006, 0.014, abs(roadUv.y - 0.5))) * (1.0 - smoothstep(0.64, 0.72, mod(roadUv.x, 1.35)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.77, 0.77, 0.69), max(edge, centre) * 0.88);
        `
        }
      `,
      );
    };
    material.customProgramCacheKey = () =>
      `asphalt-${shoulder}-${length.toFixed(6)}`;
    const mesh = new T.Mesh(
      createRibbonGeometry(
        roadCurve,
        settings.width + (shoulder ? 0.44 : 0),
        lowDetail ? 180 : 320,
        shoulder ? -0.095 : -0.08,
      ),
      material,
    );
    mesh.name = shoulder ? "Gravel shoulder" : "Asphalt and lane markings";
    // Scene fading moves vehicles into the transparent pass with depthWrite off.
    // Paint ground layers first; opaque models still occlude them via depthTest.
    mesh.renderOrder = shoulder ? -2 : -1;
    group.add(mesh);
  }
  return group;
}
