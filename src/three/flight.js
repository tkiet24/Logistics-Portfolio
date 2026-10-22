import { Curve, Vector3, MathUtils } from "three";

export function latLon(latitude, longitude, radius = 2) {
  const phi = ((90 - latitude) * Math.PI) / 180,
    theta = ((longitude + 180) * Math.PI) / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Great circle with smooth climb/descent; Curve supplies distance-based sampling. */
export function createFlightCurve(settings) {
  const start = latLon(...settings.departure, 1),
    end = latLon(...settings.destination, 1);
  const angle = Math.acos(MathUtils.clamp(start.dot(end), -1, 1)),
    sine = Math.sin(angle);
  if (angle < 1e-6 || Math.abs(sine) < 1e-6)
    throw new Error("Flight endpoints must be distinct and not antipodal.");
  return new (class extends Curve {
    constructor() {
      super();
      this.arcLengthDivisions = 300;
    }
    getPoint(u, target = new Vector3()) {
      const altitude =
        settings.altitude + settings.cruiseLift * Math.sin(Math.PI * u) ** 2;
      return target
        .copy(start)
        .multiplyScalar(Math.sin((1 - u) * angle) / sine)
        .addScaledVector(end, Math.sin(u * angle) / sine)
        .normalize()
        .multiplyScalar(settings.earthRadius + altitude);
    }
  })();
}
