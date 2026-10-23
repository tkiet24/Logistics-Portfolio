import * as T from "three";

const wheelGeometryCache = new WeakMap();

function isDisc(size) {
  const largest = Math.max(size.x, size.y, size.z);
  const smallest = Math.min(size.x, size.y, size.z);
  const middle = size.x + size.y + size.z - largest - smallest;
  return largest > 0 && middle >= largest * 0.85 && smallest < largest * 0.6;
}

function triangleBounds(geometry, triangles) {
  const bounds = new T.Box3();
  const position = geometry.getAttribute("position");
  const vertex = new T.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = triangle * 3 + corner;
      const index = geometry.index ? geometry.index.getX(offset) : offset;
      bounds.expandByPoint(vertex.fromBufferAttribute(position, index));
    }
  }
  return bounds;
}

function subsetGeometry(source, triangles, bounds) {
  const geometry = new T.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(name, attribute);
  }
  const indices = new Uint32Array(triangles.length * 3);
  let previousMaterial = -1;
  for (let i = 0; i < triangles.length; i++) {
    const offset = triangles[i] * 3;
    for (let corner = 0; corner < 3; corner++) {
      indices[i * 3 + corner] = source.index
        ? source.index.getX(offset + corner)
        : offset + corner;
    }
    if (source.groups.length) {
      const group = source.groups.find(
        (entry) => offset >= entry.start && offset < entry.start + entry.count,
      );
      const materialIndex = group?.materialIndex ?? 0;
      if (materialIndex !== previousMaterial) {
        geometry.addGroup(i * 3, 3, materialIndex);
        previousMaterial = materialIndex;
      } else {
        geometry.groups[geometry.groups.length - 1].count += 3;
      }
    }
  }
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.boundingBox = bounds;
  geometry.boundingSphere = bounds.getBoundingSphere(new T.Sphere());
  return geometry;
}

function connectedTriangles(geometry) {
  const position = geometry.getAttribute("position");
  const parents = Int32Array.from({ length: position.count }, (_, i) => i);
  function find(index) {
    let root = index;
    while (root !== parents[root]) root = parents[root];
    while (index !== root) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  }
  function union(a, b) {
    parents[find(a)] = find(b);
  }
  const welded = new Map();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map((value) => Math.round(value * 1e4))
      .join(",");
    if (welded.has(key)) union(i, welded.get(key));
    else welded.set(key, i);
  }
  const vertexCount = geometry.index?.count ?? position.count;
  const vertexAt = (offset) =>
    geometry.index ? geometry.index.getX(offset) : offset;
  for (let i = 0; i < vertexCount; i += 3) {
    union(vertexAt(i), vertexAt(i + 1));
    union(vertexAt(i + 1), vertexAt(i + 2));
  }
  const components = new Map();
  for (let i = 0; i < vertexCount; i += 3) {
    const root = find(vertexAt(i));
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(i / 3);
  }
  return components.values();
}

function wheelGeometry(source) {
  if (wheelGeometryCache.has(source)) return wheelGeometryCache.get(source);
  const result = { discs: [], remainder: null, whole: false };
  wheelGeometryCache.set(source, result);
  if (!source.getAttribute("position")) return result;
  if (!source.boundingBox) source.computeBoundingBox();
  if (isDisc(source.boundingBox.getSize(new T.Vector3()))) {
    result.discs.push(source);
    result.whole = true;
    return result;
  }
  const remainder = [];
  for (const triangles of connectedTriangles(source)) {
    const bounds = triangleBounds(source, triangles);
    if (isDisc(bounds.getSize(new T.Vector3()))) {
      result.discs.push(subsetGeometry(source, triangles, bounds));
    } else {
      for (const triangle of triangles) remainder.push(triangle);
    }
  }
  if (result.discs.length && remainder.length) {
    result.remainder = subsetGeometry(
      source,
      remainder,
      triangleBounds(source, remainder),
    );
  }
  return result;
}

/** Extract wheel pivots without modifying the loader's shared source geometry. */
export function extractTrainWheels(models, trainRig) {
  const candidates = [];
  for (const model of models) {
    model.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes("wheel"))
        candidates.push(child);
    });
  }
  const discs = [];
  for (const mesh of candidates) {
    const parts = wheelGeometry(mesh.geometry);
    if (parts.whole) {
      discs.push(mesh);
      continue;
    }
    for (const geometry of parts.discs) {
      const disc = new T.Mesh(geometry, mesh.material);
      disc.name = `${mesh.name}_disc`;
      disc.position.copy(mesh.position);
      disc.quaternion.copy(mesh.quaternion);
      disc.scale.copy(mesh.scale);
      disc.castShadow = mesh.castShadow;
      disc.receiveShadow = mesh.receiveShadow;
      mesh.parent.add(disc);
      discs.push(disc);
    }
    if (parts.discs.length) {
      if (parts.remainder) mesh.geometry = parts.remainder;
      else mesh.parent.remove(mesh);
    }
  }
  trainRig.updateWorldMatrix(true, true);
  const inverseRig = trainRig.matrixWorld.clone().invert();
  return discs.map((disc) => {
    const transform = new T.Matrix4().multiplyMatrices(
      inverseRig,
      disc.matrixWorld,
    );
    const bounds = disc.geometry.boundingBox.clone().applyMatrix4(transform);
    const size = bounds.getSize(new T.Vector3());
    const pivot = new T.Group();
    pivot.position.copy(bounds.getCenter(new T.Vector3()));
    trainRig.add(pivot);
    pivot.attach(disc);
    return { pivot, radius: Math.max(size.x, size.y, size.z) / 2 };
  });
}
