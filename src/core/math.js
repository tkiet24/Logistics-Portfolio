export const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
export const damp = (current, target, rate, dt) =>
  current + (target - current) * -Math.expm1(-rate * dt);
export const smoothstep = (min, max, value) => {
  const t = clamp((value - min) / (max - min));
  return t * t * (3 - 2 * t);
};
export const shortestAngle = (from, to) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));
export function createRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function scrollState(y, tops, workFraction = 0.88, webgl = true) {
  let section = 0;
  while (section < tops.length - 1 && y >= tops[section + 1]) section++;
  const fraction =
    section < tops.length - 1
      ? clamp(
          (y - tops[section]) / Math.max(1, tops[section + 1] - tops[section]),
        )
      : 0;
  const rawProgress = section + fraction;
  const workProgress =
    section === 3 ? clamp(fraction / workFraction) : section > 3 ? 1 : 0;
  const progress =
    section === 3 && webgl
      ? 3 + clamp((fraction - workFraction) / (1 - workFraction))
      : rawProgress;
  return { progress, rawProgress, workProgress, section };
}
export function distanceStops(curve, parameters) {
  const lengths = curve.getLengths(),
    last = lengths.length - 1,
    total = lengths[last];
  return parameters.map((t) => {
    const sample = t * last,
      i = Math.floor(sample);
    return (
      (lengths[i] +
        (lengths[Math.min(last, i + 1)] - lengths[i]) * (sample - i)) /
      total
    );
  });
}
export function nearestStop(position, stops) {
  const i = stops.findIndex(
    (stop, index) =>
      index === stops.length - 1 || position < (stop + stops[index + 1]) / 2,
  );
  return Math.max(0, i);
}
