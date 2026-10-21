import { catalystById } from "./catalysts";
export const MODEL_VERSION = "illustrative-1.1";
export const DURATION = 16;
export interface Parameters {
  h2o2: number;
  catalystId: string;
  concentration: number;
  rgb: [number, number, number];
  liquidVolume: number;
  syncLiquid: boolean;
}
export const defaults = (): Parameters => ({
  h2o2: 30,
  catalystId: "ki",
  concentration: 10,
  rgb: [65, 204, 169],
  liquidVolume: 100,
  syncLiquid: true,
});
export function bounded(
  value: unknown,
  min: number,
  max: number,
  fallback = min,
) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
export function calculateCatalystEffect(p: Parameters) {
  return p.h2o2 === 0
    ? 0
    : catalystById(p.catalystId).modelCoefficient *
        Math.sqrt(p.concentration / 10) *
        (p.h2o2 / 30);
}
export function reaction(p: Parameters, t: number) {
  const rate = calculateCatalystEffect(p);
  return rate === 0 ? 0 : 1 - Math.exp((-rate * Math.max(0, t)) / 4);
}
export function visualParameters(p: Parameters) {
  const effect = calculateCatalystEffect(p);
  return {
    foamEmissionRate: effect === 0 ? 0 : 225 * Math.min(2, Math.sqrt(effect)),
    foamParticleLimit: 6000,
    eruptionVelocity: Math.min(65, 40 * Math.sqrt(effect)),
    foamSpread: 0.65,
    foamLifetime: null, // Retain foam until the user explicitly starts/stops a run.
    foamAccumulationRate: 0.8,
    foamExpansion: 1.2,
    foamOpacity: 0.98,
    gravity: 9.8,
  };
}
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  landed: boolean;
  age: number;
}
// Fixed seed and fixed physics step keep the visual baseline independent of rendering frame rate.
export class FoamSimulation {
  particles: Particle[] = [];
  elapsed = 0;
  emitted = 0;
  maxHeight = 0;
  private budget = 0;
  private seed = 123456;
  private accumulator = 0;
  constructor(public readonly parameters: Parameters) {}
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  advance(dt: number) {
    this.accumulator += Math.max(0, dt);
    while (this.accumulator >= 1 / 60) {
      this.step(1 / 60);
      this.accumulator -= 1 / 60;
    }
  }
  private step(dt: number) {
    if (this.elapsed >= DURATION) return;
    this.elapsed = Math.min(DURATION, this.elapsed + dt);
    const v = visualParameters(this.parameters);
    this.budget += v.foamEmissionRate * dt;
    while (this.budget >= 1 && this.particles.length < v.foamParticleLimit) {
      this.budget--;
      const angle = this.random() * Math.PI * 2,
        r = this.random() * 2.1;
      this.particles.push({
        x: Math.cos(angle) * r,
        y: 39,
        z: Math.sin(angle) * r,
        vx: (this.random() - 0.5) * v.foamSpread,
        vy: v.eruptionVelocity * (0.91 + this.random() * 0.12),
        vz: (this.random() - 0.5) * v.foamSpread,
        radius: 1.25 + this.random() * 0.95,
        landed: false,
        age: 0,
      });
      this.emitted++;
    }
    for (let index = 0; index < this.particles.length; index++) {
      const p = this.particles[index];
      p.age += dt;
      if (!p.landed) {
        p.vy -= v.gravity * dt;
        const spread = p.vy < 8 ? 2.5 : 0;
        p.vx += (this.random() - 0.5) * spread * dt;
        p.vz += (this.random() - 0.5) * spread * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        // On return, spill beyond the neck rather than pass visibly through the flask.
        if (p.vy < 0 && p.y < 41 && Math.hypot(p.x, p.z) < 14) {
          const a = Math.atan2(p.z, p.x);
          p.x = Math.cos(a) * 15;
          p.z = Math.sin(a) * 15;
        }
        const mound =
          Math.max(0, 9 - Math.hypot(p.x, p.z) * 0.18) *
          Math.min(1, this.elapsed / 10);
        if (p.y <= p.radius + mound) {
          p.y = p.radius + mound;
          p.landed = true;
          p.vx = 0;
          p.vy = 0;
          p.vz = 0;
        }
        // Local neighbour repulsion: bounded O(n), no all-pairs allocation.
        const neighbour = index > 0 ? this.particles[index - 1] : null;
        if (neighbour && !neighbour.landed) {
          const dx = p.x - neighbour.x,
            dz = p.z - neighbour.z,
            dy = p.y - neighbour.y;
          const distance = Math.hypot(dx, dy, dz);
          if (
            distance > 0.01 &&
            distance < (p.radius + neighbour.radius) * 0.55
          ) {
            p.vx += (dx / distance) * 0.8 * dt;
            p.vz += (dz / distance) * 0.8 * dt;
          }
        }
        this.maxHeight = Math.max(this.maxHeight, p.y + p.radius);
      } else {
        // Gentle deterministic separation and settling keeps a continuous pile.
        const r = Math.hypot(p.x, p.z);
        if (r < 55) {
          p.x += p.x * 0.012 * dt;
          p.z += p.z * 0.012 * dt;
        }
        p.y = Math.max(p.radius, p.y - 0.025 * dt);
      }
    }
  }
  get progress() {
    return reaction(this.parameters, this.elapsed);
  }
  get liquidDrop() {
    return this.progress * 7.5;
  }
}
