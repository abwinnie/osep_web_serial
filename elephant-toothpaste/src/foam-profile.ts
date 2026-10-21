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
