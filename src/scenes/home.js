import * as T from "three";
import { createFlightCurve, latLon } from "../three/flight.js";
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
  const segments = ctx.quality.mobile
    ? Math.round(settings.routeSegments * 0.6)
    : settings.routeSegments;
  const trailSegments = ctx.quality.mobile
    ? Math.round(settings.trailSegments * 0.6)
    : settings.trailSegments;
  for (const [radius, opacity] of [
    [0.018, 0.12],
    [0.005, 0.82],
  ]) {
    globe.add(
      new T.Mesh(
        new T.TubeGeometry(arc, segments, radius, 5, false),
        new T.MeshBasicMaterial({
          color: settings.routeColour,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      ),
    );
  }
  const trail = new T.Mesh(
    new T.TubeGeometry(arc, trailSegments, 0.009, 4, false),
    new T.MeshBasicMaterial({
      color: settings.trailColour,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  trail.geometry.setDrawRange(0, 0);
  globe.add(trail);
  const markers = endpoints.map((point) => {
    const marker = new T.Group();
    marker.add(
      new T.Mesh(
        new T.SphereGeometry(0.028, 12, 12),
        new T.MeshBasicMaterial({ color: settings.trailColour }),
      ),
    );
    const ring = new T.Mesh(
      new T.RingGeometry(0.055, 0.073, 32),
      new T.MeshBasicMaterial({
        color: settings.routeColour,
        transparent: true,
        opacity: 0.75,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      point.clone().normalize(),
    );
    marker.add(ring);
    marker.position.copy(point);
    globe.add(marker);
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
      const end = Math.floor(u * trailSegments),
        start = Math.max(
          0,
          end - Math.round(trailSegments * settings.trailLength),
        );
      trail.geometry.setDrawRange(start * 24, (end - start) * 24);
      ctx.fadeMaterial(trail.material, fade);
      for (const marker of markers)
        marker.scale.setScalar(1 + 0.08 * Math.sin(time * 2.2));
    },
  };
}
