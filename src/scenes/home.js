import * as T from "three";
import { createFlightCurve, latLon } from "../three/flight.js";
import { createGlobeMarker } from "../three/globe-markers.js";
import { paintAircraft } from "../three/aircraft-material.js";

export function createScene(ctx) {
  const settings = ctx.config.home,
    group = new T.Group(),
    globe = new T.Group();
  globe.position.y = settings.positionY;
  globe.rotation.x = 0.28;
  group.add(globe);
  const arc = createFlightCurve(settings);
  const endpoints = [
    latLon(...settings.departure, settings.earthRadius + 0.03),
    latLon(...settings.destination, settings.earthRadius + 0.03),
  ];
  const base = Math.atan2(
    -endpoints[0].clone().add(endpoints[1]).x,
    endpoints[0].clone().add(endpoints[1]).z,
  );
  const markers = endpoints.map((point, index) => {
    const marker = createGlobeMarker(
      point,
      index ? settings.arrivalColour : settings.departureColour,
      index,
    );
    globe.add(marker.group);
    return marker;
  });
  const earth = new T.Group();
  globe.add(earth);
  const earthReady = ctx.load("kits/earth.glb", (model) => {
    const bounds = new T.Box3().setFromObject(model),
      size = bounds.getSize(new T.Vector3());
    model.position.sub(bounds.getCenter(new T.Vector3()));
    earth.scale.setScalar(
      (settings.earthRadius * 2) / Math.max(size.x, size.y, size.z),
    );
    earth.add(model);
  });
  const aircraft = new T.Group(),
    materials = new Set();
  globe.add(aircraft);
  const aircraftReady = ctx.load("kits/cargo_plane.glb", (model) => {
    model.traverse((part) => {
      if (!part.isMesh) return;
      for (const material of Array.isArray(part.material)
        ? part.material
        : [part.material]) {
        if (!materials.has(material)) {
          materials.add(material);
          paintAircraft(material, settings);
        }
      }
    });
    const bounds = new T.Box3().setFromObject(model),
      size = bounds.getSize(new T.Vector3());
    model.position.sub(bounds.getCenter(new T.Vector3()));
    const normalized = new T.Group();
    normalized.add(model);
    normalized.scale.setScalar(
      settings.aircraftSize / Math.max(size.x, size.y, size.z),
    );
    normalized.rotation.y = Math.PI;
    aircraft.add(normalized);
  });
  ctx.shadow(group, 0, 0, 4.8, 4.8, ctx.config.layout.floorY + 0.01);
  // Reuse frame vectors and matrix instead of creating garbage at render speed.
  const position = new T.Vector3(),
    forward = new T.Vector3(),
    up = new T.Vector3(),
    right = new T.Vector3(),
    top = new T.Vector3(),
    backward = new T.Vector3(),
    rotation = new T.Matrix4();
  let dragOffset = 0;
  return {
    group,
    animated: true,
    ready: Promise.allSettled([earthReady, aircraftReady]),
    drag(delta) {
      dragOffset += delta * 0.01;
    },
    update({ time, reducedMotion }) {
      globe.rotation.y = base + dragOffset + Math.sin(time * 0.3) * 0.3;
      const u = reducedMotion ? 0.35 : (time * settings.flightSpeed) % 1;
      arc.getPointAt(u, position);
      arc.getTangentAt(u, forward).normalize();
      up.copy(position).normalize();
      right.crossVectors(forward, up).normalize();
      top.crossVectors(right, forward).normalize();
      backward.copy(forward).negate();
      rotation.makeBasis(right, top, backward);
      aircraft.position.copy(position);
      aircraft.quaternion.setFromRotationMatrix(rotation);
      const fade = reducedMotion
        ? 1
        : T.MathUtils.smoothstep(u, 0, 0.045) *
          (1 - T.MathUtils.smoothstep(u, 0.955, 1));
      for (const material of materials) ctx.fadeMaterial(material, fade);
      for (const marker of markers)
        marker.update(time, reducedMotion, ctx.fadeMaterial);
    },
  };
}
