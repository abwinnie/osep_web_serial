import { Vector3 } from 'three';
/** Illustrative material chain. Fixed steps and contact preserve the emitted
 * sections during folding; this is not a calibrated fluid solver. */
export class FoamMotion {
  readonly points = Array.from({ length: 65 }, () => new Vector3());
  private previous = this.points.map(() => new Vector3());
  private clock = 0;
  private height = 0;
  private delta = new Vector3();
  readonly radii = Array.from({ length: 65 }, () => 2.1);
  private landed = new Uint8Array(65);
  private landing: Vector3 | null = null;
  private depositTargets = this.points.map(() => new Vector3());
  private depositRadii = this.points.map(() => 2.1);
  reset(height: number) {
    this.height = height; this.clock = 0;
    this.landing = null; this.landed.fill(0); this.radii.fill(2.1);
    let angle = 0, elevation = 1.8;
    const length = height / 64;
    for (let i = 64; i >= 0; i--) {
      const t = (64 - i) / 64;
      const radius = 4.8 - 3.2 * t;
      const thickness = 4.5 - 2.2 * t;
      const pitch = thickness * 1.75;
      if (i < 64) {
        const turn = length / Math.hypot(radius, pitch / (2 * Math.PI));
        angle += turn;
        elevation += pitch * turn / (2 * Math.PI);
      }
      // Broad base beside the cylinder; upper folds narrow and lean inward.
      const centre = -12 + 2 * t;
      this.depositTargets[i].set(
        Math.min(-(3.65 + thickness + 0.15), centre + radius * Math.cos(angle)),
        elevation,
        radius * Math.sin(angle),
      );
      this.depositRadii[i] = thickness;
    }
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
        const x = p.x, y = p.y, z = p.z, contact = this.landed[i] > 0;
        if (this.landing) {
          // Soft deposition guide, parameterised by emitted material arc length.
          // Sections can join only after falling onto the existing deposit.
          const target = this.depositTargets[i];
          const tx = target.x, ty = target.y, tz = target.z;
          if ((i === 64 || this.landed[i + 1]) && y <= ty + 0.5) this.landed[i] = 1;
          if (this.landed[i]) {
            p.x += (tx - x) * 60 * dt * dt;
            p.y += (ty - y) * 60 * dt * dt;
            p.z += (tz - z) * 60 * dt * dt;
          }
        }
        if (this.landed[i]) this.radii[i] = Math.min(this.depositRadii[i], this.radii[i] + dt * 1.5);
        const kick = this.clock < 3.5 + (1 - i / 64) * 9 ? 1.1 * slender : 0;
        p.x += (x - old.x) * (contact ? 0.65 : 0.997) - kick * dt * dt;
        p.y += (y - old.y) * 0.997 - 22 * dt * dt;
        p.z += (z - old.z) * (contact ? 0.65 : 0.997) + Math.sin(i * 0.43) * 1.5 * dt * dt;
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
          for (let j = 1; j < i - Math.ceil(8 / Math.max(length, 0.1)); j++) {
            this.delta.subVectors(this.points[i], this.points[j]);
            const d = this.delta.length();
            const diameter = (this.radii[i] + this.radii[j]) * 0.88;
            if (d > 0.001 && d < diameter) {

              this.delta.multiplyScalar((diameter - d) / d * 0.5);
              this.points[i].add(this.delta);
              if (released(j)) this.points[j].sub(this.delta);
            }
          }
          const p = this.points[i];
          if (p.y <= this.radii[i] + 0.3) {
            if (!this.landing) this.landing = p.clone();
            this.landed[i] = 1;
          }

          p.y = Math.max(2.4, p.y);
          const wall = 3.65 + this.radii[i] + 0.15;
          const clearance = p.y >= 39 ? 0 : p.y > 39 - wall
            ? Math.sqrt(wall * wall - (p.y - (39 - wall)) ** 2) : wall;
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
