/** Presentation clock: collapse starts when the observed peak stops rising,
 * independently of reaction completion and history recording. */
export class FoamTiming {
  settling = 0;
  private peak = 0;
  private quiet = 0;
  reset() { this.settling = this.peak = this.quiet = 0; }
  update(elapsed: number, highest: number, dt: number) {
    if (this.settling > 0) { this.settling = Math.min(24, this.settling + dt); return; }
    if (highest > this.peak + 0.15) { this.peak = highest; this.quiet = 0; }
    else if (elapsed > 1.2 && highest > 45) this.quiet += dt;
    if (this.quiet >= 0.5) this.settling = 0.001;
  }
}
export const PLAYBACK_SPEED = 2;
export const INTERNAL_RISE_SECONDS = 1.2;
export function internalFoamTop(elapsed: number, liquidLevel: number) {
  return liquidLevel + (40 - liquidLevel) * Math.min(1, Math.max(0, elapsed / INTERNAL_RISE_SECONDS));
}
export function externalFoamGrowth(elapsed: number) {
  return Math.min(1, Math.max(0, (elapsed - INTERNAL_RISE_SECONDS) / 3));
}
