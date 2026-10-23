import { Box3 } from "three";

/** Recompute bounds after model additions, rather than walking the scene each frame. */
export function createVisibility(group, margin = 2) {
  const bounds = new Box3();
  let dirty = true;
  return {
    invalidate() {
      dirty = true;
    },
    intersects(frustum) {
      if (dirty) {
        group.updateWorldMatrix(true, true);
        bounds.setFromObject(group).expandByScalar(margin);
        dirty = false;
      }
      return !bounds.isEmpty() && frustum.intersectsBox(bounds);
    },
  };
}
