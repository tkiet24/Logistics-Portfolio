import * as T from "three";

// A pressed, trapezoidal sheet, with paint mapped directly onto its corrugations.
function corrugatedWall(width, height, ribs) {
  const vertices = [],
    uv = [],
    indices = [];
  const profile = [
    [0, 0],
    [0.18, 0],
    [0.34, 0.019],
    [0.66, 0.019],
    [0.82, 0],
    [1, 0],
  ];
  for (let rib = 0; rib < ribs; rib++) {
    for (const [fraction, depth] of profile) {
      const u = (rib + fraction) / ribs;
      vertices.push(
        (u - 0.5) * width,
        -height / 2,
        depth,
        (u - 0.5) * width,
        height / 2,
        depth,
      );
      uv.push(u, 0, u, 1);
    }
  }
  for (let i = 0; i < vertices.length / 6 - 1; i++) {
    const v = i * 2;
    indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createSkillContainer(ctx, colour, label, index) {
  const paint = new T.MeshStandardMaterial({
    color: colour,
    metalness: 0.1,
    roughness: 0.78,
  });
  const body = new T.Mesh(
    new T.BoxGeometry(2.34, 0.9, 0.94),
    Array(6).fill(paint),
  );
  body.name = `Freight module ${index + 1} · ${label}`;
  const trim = new T.MeshStandardMaterial({
    color: colour,
    metalness: 0.16,
    roughness: 0.68,
  });
  const fittings = new T.MeshStandardMaterial({
    color: 0x889393,
    metalness: 0.55,
    roughness: 0.58,
  });
  const gasket = new T.MeshStandardMaterial({
    color: 0x283333,
    roughness: 0.95,
  });
  const unit = new T.BoxGeometry(1, 1, 1);
  function batch(name, material, pieces) {
    const mesh = new T.InstancedMesh(unit, material, pieces.length);
    mesh.name = name;
    const transform = new T.Object3D();
    pieces.forEach(([size, position], i) => {
      transform.scale.set(...size);
      transform.position.set(...position);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    body.add(mesh);
    return mesh;
  }
  const texture = ctx.canvasTexture(
    1024,
    (x) => {
      x.fillStyle = `#${new T.Color(colour).getHexString()}`;
      x.fillRect(0, 0, 1024, 384);
      const bright = new T.Color(colour);
      const ink =
        bright.r * 0.21 + bright.g * 0.72 + bright.b * 0.07 > 0.55
          ? "#263b3c"
          : "#f2eee1";
      x.fillStyle = ink;
      x.font = "22px monospace";
      x.fillText(`KNGU 10000${index + 1}`, 66, 48);
      x.fillText("22G1", 860, 48);
      x.font = "bold 82px sans-serif";
      x.fillText(label, 66, 213, 880);
      x.font = "19px monospace";
      x.fillText("LOGISTICS & SUPPLY CHAIN", 68, 260);
      x.font = "17px monospace";
      x.fillText(`PORTFOLIO / 0${index + 1}`, 68, 340);
      // Small inspection marks and reflectors, rather than a framed graphic panel.
      x.fillRect(860, 310, 72, 3);
      x.fillRect(860, 322, 48, 3);
      x.fillStyle = "#ead8a1";
      x.fillRect(22, 318, 14, 40);
      x.fillRect(988, 318, 14, 40);
    },
    384,
  );
  texture.anisotropy = 4;
  const wallGeometry = corrugatedWall(2.23, 0.85, 16);
  const front = new T.Mesh(
    wallGeometry,
    new T.MeshStandardMaterial({
      map: texture,
      metalness: 0.08,
      roughness: 0.8,
    }),
  );
  front.name = "Painted corrugated sidewall";
  front.position.z = 0.478;
  body.add(front);
  const back = new T.Mesh(wallGeometry, paint);
  back.rotation.y = Math.PI;
  back.position.z = -0.478;
  body.add(back);
  const roof = new T.Mesh(corrugatedWall(2.23, 0.88, 16), paint);
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = 0.46;
  body.add(roof);
  const rails = [],
    castings = [],
    locks = [],
    handles = [];
  for (const y of [-0.465, 0.465])
    for (const z of [-0.48, 0.48])
      rails.push([
        [2.36, 0.055, 0.045],
        [0, y, z],
      ]);
  for (const x of [-1.15, 1.15])
    for (const z of [-0.48, 0.48])
      rails.push([
        [0.055, 0.91, 0.045],
        [x, 0, z],
      ]);
  for (const x of [-1.18, 1.18])
    for (const y of [-0.475, 0.475])
      for (const z of [-0.48, 0.48])
        castings.push([
          [0.08, 0.08, 0.075],
          [x, y, z],
        ]);
  batch("Painted perimeter rails", trim, rails);
  batch("Recessed corner castings", fittings, castings);
  // A pair of end doors recessed into the corner posts.
  batch("Twin end doors", trim, [
    [
      [0.025, 0.84, 0.42],
      [1.182, 0, -0.222],
    ],
    [
      [0.025, 0.84, 0.42],
      [1.182, 0, 0.222],
    ],
  ]);
  batch("Door centre gasket", gasket, [
    [
      [0.028, 0.86, 0.012],
      [1.186, 0, 0],
    ],
  ]);
  for (const z of [-0.32, -0.14, 0.14, 0.32]) {
    locks.push([
      [0.018, 0.76, 0.018],
      [1.21, 0, z],
    ]);
    for (const y of [-0.31, 0, 0.31])
      locks.push([
        [0.028, 0.035, 0.04],
        [1.212, y, z],
      ]);
    handles.push([
      [0.028, 0.018, 0.07],
      [1.222, -0.18, z + 0.025],
    ]);
  }
  batch("Galvanized locking rods", fittings, locks);
  batch("Door handles", fittings, handles);
  const indicator = new T.MeshBasicMaterial({ color: 0x486164 });
  batch("Selection status rail", indicator, [
    [
      [0.12, 0.018, 0.016],
      [1.02, 0.466, 0.51],
    ],
  ]);
  body.userData.setStatus = (active, hovered) =>
    indicator.color.setHex(active ? 0x8bf2cd : hovered ? 0xffcf8b : 0x486164);
  return body;
}
