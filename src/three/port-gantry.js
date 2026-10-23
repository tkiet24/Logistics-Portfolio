import * as T from "three";

// Rail-mounted gantry: static steelwork is instanced per material.
export function createPortGantry({ groundY, railZ, containerScale, lowDetail }) {
  const group = new T.Group();
  group.name = "Container yard gantry";
  const paint = new T.MeshStandardMaterial({ color: 0xb84230, roughness: 0.62, metalness: 0.3 });
  const steel = new T.MeshStandardMaterial({ color: 0x34464d, roughness: 0.58, metalness: 0.6 });
  const silver = new T.MeshStandardMaterial({ color: 0x9aa8a9, roughness: 0.4, metalness: 0.65 });
  const rubber = new T.MeshStandardMaterial({ color: 0x20272b, roughness: 0.9 });
  const yellow = new T.MeshStandardMaterial({ color: 0xe4ad48, roughness: 0.55, metalness: 0.2 });
  const glass = new T.MeshStandardMaterial({ color: 0x245365, roughness: 0.22, metalness: 0.48 });
  const box = new T.BoxGeometry(1, 1, 1);
  const wheel = new T.CylinderGeometry(0.17, 0.17, 0.15, lowDetail ? 8 : 16);
  const up = new T.Vector3(0, 1, 0);
  const batches = new Map();
  const dummy = new T.Object3D();
  function block(parent, material, size, position, geometry = box) {
    const mesh = new T.Mesh(geometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  function fixed(material, size, position, rotation = 0, geometry = box) {
    const key = `${material.uuid}/${geometry.uuid}`;
    if (!batches.has(key)) batches.set(key, { material, geometry, matrices: [] });
    dummy.position.set(...position);
    dummy.scale.set(...size);
    dummy.rotation.set(rotation, 0, 0);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function strut(material, a, b, width, depth = width) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    dummy.position.copy(start).add(end).multiplyScalar(0.5);
    dummy.scale.set(width, start.distanceTo(end), depth);
    dummy.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
    dummy.updateMatrix();
    const key = `${material.uuid}/${box.uuid}`;
    if (!batches.has(key)) batches.set(key, { material, geometry: box, matrices: [] });
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const top = 5.5;
  for (const side of [-1, 1]) {
    const baseZ = railZ + side * 1.85;
    fixed(steel, [12.3, 0.08, 0.12], [-2, groundY + 0.04, baseZ]);
    for (const x of [-7.4, 3.4]) {
      fixed(steel, [1.3, 0.22, 0.42], [x, groundY + 0.4, baseZ]);
      for (const dx of [-0.44, 0.44]) {
        fixed(rubber, [1, 1, 1], [x + dx, groundY + 0.22, baseZ], Math.PI / 2, wheel);
        fixed(silver, [0.38, 1.08, 0.38], [x + dx, groundY + 0.22, baseZ + 0.015], Math.PI / 2, wheel);
      }
      strut(paint, [x, groundY + 0.5, baseZ], [x, top, railZ + side * 0.8], 0.27, 0.32);
      fixed(paint, [0.5, 0.12, 0.54], [x, groundY + 0.53, baseZ]);
      // Knee braces carry the bridge load without blocking the train opening.
      strut(paint, [x, 3.9, railZ + side * 1.05], [x + (x < 0 ? 1.3 : -1.3), top - 0.2, railZ + side * 0.65], 0.12);
      fixed(yellow, [0.29, 0.18, 0.34], [x, groundY + 0.85, railZ + side * 1.78]);
    }
    // Deep twin girders, with separate flange plates and visible web stiffeners.
    fixed(paint, [11.3, 0.45, 0.14], [-2, top, railZ + side * 0.65]);
    for (const y of [top - 0.25, top + 0.25])
      fixed(paint, [11.5, 0.07, 0.4], [-2, y, railZ + side * 0.65]);
    fixed(silver, [11.2, 0.055, 0.07], [-2, top + 0.32, railZ + side * 0.65]);
    for (let x = -7.2; x < 3.5; x += 0.9)
      fixed(paint, [0.045, 0.43, 0.34], [x, top, railZ + side * 0.65]);
  }
  for (const x of [-7.4, 3.4]) {
    fixed(paint, [0.45, 0.4, 2.05], [x, top, railZ]);
    strut(steel, [x, top - 1.1, railZ - 1.02], [x, top - 0.25, railZ], 0.08);
    strut(steel, [x, top - 1.1, railZ + 1.02], [x, top - 0.25, railZ], 0.08);
  }
  // Maintenance catwalk and restrained yellow safety railings.
  fixed(steel, [11.4, 0.06, 0.52], [-2, top + 0.22, railZ - 1.06]);
  for (const y of [top + 0.52, top + 0.9])
    fixed(yellow, [11.4, 0.035, 0.035], [-2, y, railZ - 1.3]);
  for (let x = -7.5; x < 3.6; x += 0.75)
    fixed(yellow, [0.035, 0.7, 0.035], [x, top + 0.55, railZ - 1.3]);
  for (const x of [3.12, 3.62])
    fixed(silver, [0.045, 5.5 - groundY, 0.045], [x, (5.5 + groundY) / 2, railZ - 2.08]);
  for (let y = groundY + 0.25; y < 5.5; y += 0.26)
    fixed(silver, [0.55, 0.035, 0.045], [3.37, y, railZ - 2.08]);
  for (const { material, geometry, matrices } of batches.values()) {
    const mesh = new T.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  const trolley = new T.Group();
  trolley.name = "Gantry trolley and cabin";
  trolley.position.set(-2, 6.13, railZ);
  group.add(trolley);
  block(trolley, steel, [2.1, 0.22, 1.45], [0, 0, 0]);
  block(trolley, paint, [0.85, 0.38, 0.62], [0, 0.25, 0]);
  for (const x of [-0.8, 0.8])
    for (const z of [-0.65, 0.65]) {
      const roller = block(trolley, steel, [0.75, 1, 0.75], [x, -0.16, z], wheel);
      roller.rotation.x = Math.PI / 2;
    }
  block(trolley, paint, [0.64, 0.75, 0.68], [0, -0.52, 1]);
  block(trolley, glass, [0.52, 0.43, 0.015], [0, -0.43, 1.35]);
  block(trolley, glass, [0.015, 0.43, 0.52], [0.33, -0.43, 1]);
  block(trolley, steel, [0.76, 0.07, 0.8], [0, -0.11, 1]);
  block(trolley, yellow, [0.68, 0.09, 0.72], [0, -0.9, 1]);

  const spreader = new T.Group();
  spreader.name = "Four-point container spreader";
  group.add(spreader);
  const sx = 1.06 * containerScale, sz = 0.4 * containerScale;
  for (const z of [-sz, sz])
    block(spreader, yellow, [2 * sx + 0.12, 0.14, 0.1], [0, 0, z]);
  for (const x of [-sx, sx]) {
    block(spreader, yellow, [0.12, 0.14, 2 * sz], [x, 0, 0]);
    for (const z of [-sz, sz])
      block(spreader, steel, [0.13, 0.16, 0.13], [x, -0.08, z]);
  }
  block(spreader, steel, [0.7, 0.18, 0.5], [0, 0.03, 0]);
  const ropes = [];
  for (const x of [-sx * 0.72, sx * 0.72])
    for (const z of [-sz, sz]) {
      const rope = block(group, steel, [0.018, 1, 0.018], [0, 0, 0]);
      rope.name = "Hoist cable";
      ropes.push({ rope, x, z });
    }
  function update(x, cargoY) {
    const liftY = cargoY + 0.5 * containerScale + 0.16;
    const anchorY = trolley.position.y - 0.12;
    trolley.position.x = x;
    spreader.position.set(x, liftY, railZ);
    for (const cable of ropes) {
      cable.rope.scale.y = Math.max(0.01, anchorY - liftY);
      cable.rope.position.set(x + cable.x, (anchorY + liftY) / 2, railZ + cable.z);
    }
  }
  return { group, update };
}
