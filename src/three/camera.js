import { PerspectiveCamera, Vector3, MathUtils } from "three";
import { damp, smoothstep } from "../core/math.js";

export function createCameraRig(config, initialProgress = 0) {
  const camera = new PerspectiveCamera(50, 1, 0.1, 300);
  const position = new Vector3(),
    look = new Vector3();
  let progress = initialProgress,
    zoom = 1;
  let pointerX = 0,
    pointerY = 0,
    parallaxX = 0,
    parallaxY = 0;
  return {
    camera,
    get progress() {
      return progress;
    },
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
    resize(width, height) {
      const aspect = width / height;
      camera.aspect = aspect;
      zoom = aspect < 1.2 ? Math.min(2.6, 1.25 / aspect + 0.2) : 1;
      const desktop = width > config.layout.desktopBreakpoint;
      camera.setViewOffset(
        width,
        height,
        desktop ? -width * 0.17 : 0,
        desktop ? 0 : height * 0.14,
        width,
        height,
      );
      camera.updateProjectionMatrix();
    },
    update(dt, target, reducedMotion) {
      progress = reducedMotion
        ? target
        : damp(progress, target, config.layout.cameraDamping, dt);
      if (Math.abs(progress - target) < 0.0001) progress = target;
      const index = Math.min(3, Math.floor(progress)),
        ease = smoothstep(0, 1, progress - index);
      const a = config.layout.cameraKeyframes[index],
        b = config.layout.cameraKeyframes[index + 1];
      for (let axis = 0; axis < 3; axis++) {
        position.setComponent(
          axis,
          MathUtils.lerp(a[0][axis], b[0][axis], ease),
        );
        look.setComponent(axis, MathUtils.lerp(a[1][axis], b[1][axis], ease));
      }
      position.x *= config.layout.sceneSpacing / 40;
      look.x *= config.layout.sceneSpacing / 40;
      position.sub(look).multiplyScalar(zoom).add(look);
      parallaxX = reducedMotion ? 0 : damp(parallaxX, pointerX, 3, dt);
      parallaxY = reducedMotion ? 0 : damp(parallaxY, pointerY, 3, dt);
      position.x += parallaxX * 0.7;
      position.y -= parallaxY * 0.4;
      camera.position.copy(position);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      return (
        progress !== target ||
        (!reducedMotion &&
          (Math.abs(parallaxX - pointerX) > 0.001 ||
            Math.abs(parallaxY - pointerY) > 0.001))
      );
    },
  };
}
