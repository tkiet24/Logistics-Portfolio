/** Register on creation/load instead of traversing every model during animation. */
export function createFade(group) {
  const known = new WeakSet(),
    entries = new Map();
  let opacity = 0;
  function apply(material) {
    const base = entries.get(material);
    if (!base) return;
    const alpha =
      base.opacity * opacity * (material.userData.motionOpacity ?? 1);
    const transparent = base.transparent || alpha < 0.999;
    if (material.transparent !== transparent) material.needsUpdate = true;
    material.transparent = transparent;
    material.opacity = alpha;
    material.depthWrite = alpha > 0.98 ? base.depthWrite : false;
  }
  function register(root = group) {
    root.traverse((part) => {
      if (!part.material) return;
      for (const material of Array.isArray(part.material)
        ? part.material
        : [part.material]) {
        if (known.has(material)) continue;
        known.add(material);
        entries.set(material, {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        });
        apply(material);
      }
    });
  }
  return {
    register,
    get opacity() {
      return opacity;
    },
    update(value) {
      group.visible = value > 0.002;
      if (Math.abs(value - opacity) < 0.002) return false;
      opacity = value;
      entries.forEach((_, material) => apply(material));
      return true;
    },
    motion(material, value) {
      material.userData.motionOpacity = value;
      apply(material);
    },
  };
}
