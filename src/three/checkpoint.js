import * as T from "three";

export function createCheckpoint(ctx, index) {
  const group = new T.Group();
  group.name = `Journey checkpoint ${index + 1}`;
  group.userData.checkpointIndex = index;
  const holder = new T.Group();
  group.add(holder);
  const ready = ctx.load("kits/checkpoint.glb", (model) => {
    // Normalize the supplied hierarchy and offset origin, keeping the base on
    // the road even when the checkpoint is active.
    const bounds = new T.Box3().setFromObject(model);
    const center = bounds.getCenter(new T.Vector3());
    const size = bounds.getSize(new T.Vector3());
    model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z));
    const normalized = new T.Group();
    normalized.scale.setScalar(1.1 / Math.max(size.x, size.y, size.z, 0.001));
    normalized.add(model);
    holder.add(normalized);
  });
  return {
    group,
    ready,
    setState(activeIndex) {
      const active = index === activeIndex;
      group.userData.state = active
        ? "active"
        : index < activeIndex
          ? "complete"
          : "upcoming";
      // Keep the original colours and materials; highlight by scale.
      holder.scale.setScalar(active ? 1.12 : 0.92);
    },
  };
}
