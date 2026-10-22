import { clamp } from "./math.js";

/** Keep decimal GPA values intact during the same count-up used for integers. */
export function formatStat(target, progress, decimals = 0, suffix = "") {
  const value = clamp(progress);
  return (target * value).toFixed(decimals) + (value === 1 ? suffix : "");
}
