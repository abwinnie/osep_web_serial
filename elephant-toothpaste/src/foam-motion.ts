import { Vector3 } from 'three';
/** Illustrative material chain. Fixed steps and contact preserve the emitted
 * sections during folding; this is not a calibrated fluid solver. */
export class FoamMotion {
  readonly points = Array.from({ length: 65 }, () => new Vector3());
  private previous = this.points.map(() => new Vector3());
  private clock = 0;
  private height = 0;
  private delta = new Vector3();
  reset(height: number) {
    this.height = height; this.clock = 0;
    this.points.forEach((p, i) => {
      p.set(0, 39 + height * i / 64, 0); this.previous[i].copy(p);
    });
  }
  advance(seconds: number, height: number) {
    if (height !== this.height || seconds < this.clock - 1 / 120) this.reset(height);
    const target = Math.min(24, Math.max(0, seconds));
    const dt = 1 / 120, length = height / 64;
    const slender = Math.max(0, Math.min(1, (height - 34) / 34));
    while (this.clock + dt <= target + 1e-8) {
      this.clock += dt;
      const released = (i: number) => i > 0 && slender > 0 && this.clock > 2 + (1 - i / 64) * 9;
      for (let i = 1; i < 65; i++) {
        const p = this.points[i], old = this.previous[i];
        if (!released(i)) { p.set(0, 39 + height * i / 64, 0); old.copy(p); continue; }
        const x = p.x, y = p.y, z = p.z, contact = y <= 5.1;
        p.x += (x - old.x) * (contact ? 0.8 : 0.997) - 3.8 * slender * dt * dt;
        p.y += (y - old.y) * 0.997 - 22 * dt * dt;
        p.z += (z - old.z) * (contact ? 0.8 : 0.997) + Math.sin(i * 0.43) * 1.5 * dt * dt;
        old.set(x, y, z);
      }
      for (let iteration = 0; iteration < 12; iteration++) {
        for (let i = 1; i < 65; i++) {
          const a = this.points[i - 1], b = this.points[i];
          this.delta.subVectors(b, a);
          const d = this.delta.length();
          if (d > 1e-9) {
            this.delta.multiplyScalar((d - length) / d);
            if (released(i - 1)) { a.addScaledVector(this.delta, 0.5); b.addScaledVector(this.delta, -0.5); }
            else if (released(i)) b.sub(this.delta);
          }
        }
        for (let i = 1; i < 65; i++) {
          if (!released(i)) continue;
          for (let j = 1; j < i - Math.ceil(11 / Math.max(length, 0.1)); j++) {
            this.delta.subVectors(this.points[i], this.points[j]);
            const d = this.delta.length();
            if (d > 0.001 && d < 10) {
              this.delta.multiplyScalar((10 - d) / d * 0.5);
              this.points[i].add(this.delta);
              if (released(j)) this.points[j].sub(this.delta);
            }
          }
          const p = this.points[i]; p.y = Math.max(5, p.y);
          const clearance = p.y >= 39 ? 0 : p.y > 30 ? Math.sqrt(81 - (p.y - 30) ** 2) : 9;
          if (Math.hypot(p.x, p.z) < clearance) {
            const r = Math.hypot(p.x, p.z);
            if (r < 0.001) p.x = -clearance;
            else { p.x *= clearance / r; p.z *= clearance / r; }
          }
        }
      }
    }
    return this.points;
  }
}
