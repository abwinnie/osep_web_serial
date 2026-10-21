import {
  pillarRadius,
  pillarSwelling,
  localCollapseProgress,
  pillarPoint,
} from "./foam-profile";
import * as THREE from "three";

// A continuous render-only skin. It never changes particle physics or recorded data.
export class FoamRibbon extends THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshStandardMaterial
> {
  readonly points: THREE.Vector3[];
  private curve: THREE.CatmullRomCurve3;
  private center = new THREE.Vector3();
  private tangent = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private binormal = new THREE.Vector3();
  private reference = new THREE.Vector3(0, 0, 1);
  private ahead = new THREE.Vector3();
  private behind = new THREE.Vector3();
  private readonly rings = 72;
  private readonly sides = 18;
  constructor(pointCount: number, material: THREE.MeshStandardMaterial) {
    const geometry = new THREE.BufferGeometry();
    const count = 73 * 19;
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const uv = new Float32Array(count * 2),
      indices: number[] = [];
    for (let i = 0; i <= 72; i++)
      for (let j = 0; j <= 18; j++) {
        const n = i * 19 + j;
        uv[n * 2] = j / 18;
        uv[n * 2 + 1] = (i / 72) * 2;
        if (i < 72 && j < 18) {
          const a = n,
            b = n + 19;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    super(geometry, material);
    this.points = Array.from({ length: pointCount }, () => new THREE.Vector3());
    this.curve = new THREE.CatmullRomCurve3(this.points, false, "centripetal");
    this.frustumCulled = false;
    this.castShadow = true;
    this.receiveShadow = true;
  }
  update(
    radius: number,
    phase: number,
    upright = false,
    baseClosure = 0,
    originalHeight = 0,
  ) {
    const positions = this.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const normals = this.geometry.getAttribute(
      "normal",
    ) as THREE.BufferAttribute;
    for (let i = 0; i <= this.rings; i++) {
      const u = i / this.rings;
      this.curve.getPoint(u, this.center);
      this.curve.getTangent(u, this.tangent);
      this.normal.crossVectors(this.tangent, this.reference).normalize();
      this.binormal.crossVectors(this.tangent, this.normal).normalize();
      const end = upright
        ? pillarRadius(u)
        : Math.min(1, Math.sqrt(Math.max(0, (1 - u) * 18)));
      const baseCap =
        u < 0.1
          ? 1 -
            baseClosure *
              (1 - Math.sqrt(Math.max(0, 1 - ((0.1 - u) / 0.1) ** 2)))
          : 1;
      const r =
        radius *
        (1 +
          (upright ? 0.012 : 0.075) * Math.sin(u * 19 - phase) +
          (upright ? 0.008 : 0.035) * Math.sin(u * 43 + phase)) *
        end *
        baseCap;
      // Only material that actually reaches the floor can flatten and spread.
      const arrival = Math.max(0, Math.min(1, (12 - this.center.y) / 8));
      const du = Math.min(1, u + 0.003) - Math.max(0, u - 0.003);
      this.curve.getPoint(Math.min(1, u + 0.003), this.ahead);
      this.curve.getPoint(Math.max(0, u - 0.003), this.behind);
      const stretch =
        originalHeight > 0
          ? Math.min(
              8,
              Math.max(
                1,
                (originalHeight * du) /
                  Math.max(0.001, this.ahead.distanceTo(this.behind)),
              ),
            )
          : 1;
      const flatten = 1 - 0.6 * arrival,
        spread = Math.sqrt((1 + (stretch - 1) * arrival) / flatten);
      for (let j = 0; j <= this.sides; j++) {
        const a = (j / this.sides) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a);
        const nx = this.normal.x * c + this.binormal.x * s,
          ny = this.normal.y * c + this.binormal.y * s,
          nz = this.normal.z * c + this.binormal.z * s;
        const localRadius = r * (upright ? pillarSwelling(u, c) : 1);
        const index = i * (this.sides + 1) + j;
        positions.setXYZ(
          index,
          this.center.x + nx * localRadius * spread,
          Math.max(0.08, this.center.y + ny * localRadius * spread * flatten),
          this.center.z + nz * localRadius * spread,
        );
        if (upright && u > 0.9) {
          const capT = (u - 0.9) / 0.1;
          const radial = Math.sqrt(Math.max(0, 1 - capT * capT));
          normals.setXYZ(
            index,
            nx * radial + this.tangent.x * capT,
            ny * radial + this.tangent.y * capT,
            nz * radial + this.tangent.z * capT,
          );
        } else if (upright && u < 0.1 && baseClosure > 0) {
          const capT = ((0.1 - u) / 0.1) * baseClosure,
            radial = Math.sqrt(Math.max(0, 1 - capT * capT));
          normals.setXYZ(
            index,
            nx * radial - this.tangent.x * capT,
            ny * radial - this.tangent.y * capT,
            nz * radial - this.tangent.z * capT,
          );
        } else normals.setXYZ(index, nx, ny, nz);
      }
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
  }
}
export class FoamSurface extends THREE.Group {
  readonly material: THREE.MeshStandardMaterial;
  readonly texture: THREE.CanvasTexture;
  private column: FoamRibbon;
  private peak = 0;
  private lastElapsed = 0;
  constructor() {
    super();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#aaaaaa";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 7361;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 6500; i++) {
      const x = random() * 256,
        y = random() * 256,
        r = 0.4 + random() * 1.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = random() > 0.5 ? "#777777" : "#dddddd";
      ctx.fill();
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.material = new THREE.MeshStandardMaterial({
      color: 0xf4cc5e,
      roughness: 0.86,
      bumpMap: this.texture,
      bumpScale: 0.24,
    });
    this.column = new FoamRibbon(17, this.material);
    this.add(this.column);
    this.visible = false;
  }
  update(elapsed: number, top: number, settling: number, color: THREE.Color) {
    this.visible = elapsed > 0;
    this.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.12);
    if (elapsed < this.lastElapsed || elapsed === 0) this.peak = 0;
    this.lastElapsed = elapsed;
    this.peak = Math.max(this.peak, top);
    const grow = Math.min(1, elapsed / 2),
      height = Math.max(41, (settling > 0 ? this.peak : top) - 1.5);
    this.column.visible = height > 41;
    const h = height - 39;
    const cp = this.column.points;
    for (let i = 0; i < cp.length; i++) {
      const u = i / (cp.length - 1),
        point = pillarPoint(u, h, settling);
      cp[i].set(
        point.x + 0.12 * Math.sin(elapsed * 0.35) * Math.sin(u * Math.PI),
        point.y,
        point.z,
      );
    }
    this.column.update(
      8.5 * grow,
      elapsed * 0.35,
      true,
      localCollapseProgress(settling, h, 0),
      h,
    );
  }
  dispose() {
    this.column.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
