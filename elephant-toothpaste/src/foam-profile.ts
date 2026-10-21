/** Render-only upright column: broad foot, quiet sides, a rounded dome. */
export function pillarRadius(u: number) {
  const t = Math.max(0, Math.min(1, u));
  if (t === 1) return 0;
  const foot = 1 + 0.35 * Math.exp(-t * 12);
  const cap = t <= 0.9 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2));
  return foot * cap;
}

/** Attached side lobes, not detached beads or a bent column centreline. */
export function pillarSwelling(u: number, side: number) {
  const left =
    Math.max(0, -side) ** 4 * 0.42 * Math.exp(-(((u - 0.63) / 0.13) ** 2));
  const right =
    Math.max(0, side) ** 4 * 0.23 * Math.exp(-(((u - 0.8) / 0.1) ** 2));
  return 1 + left + right;
}

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
/** Visual loss of support after emission ends; not a calibrated foam stability law. */
export function collapseProgress(seconds: number, height: number) {
  const slenderness = Math.max(0, Math.min(1, (height / 17 - 2) / 2));
  return smooth((seconds - 2) / 10) * slenderness;
}
export function pillarPoint(u: number, height: number, seconds: number) {
  const t = Math.max(0, Math.min(1, u)),
    bend = collapseProgress(seconds, height);
  const upper = smooth((t - 0.2) / 0.8),
    drop = smooth((seconds - 12) / 12) * bend;
  return {
    x: -height * 0.6 * bend * upper || 0,
    y:
      39 +
      height * t * (1 - 0.75 * bend * t * t) -
      (35 + height * 0.25) * drop * t ** 4,
    z: height * 0.08 * bend * upper,
  };
}
