import { pillarRadius, pillarSwelling } from "./foam-profile";
import * as THREE from "three";

// A continuous render-only skin. It never changes particle physics or recorded data.
class FoamRibbon extends THREE.Mesh<
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
  update(radius: number, phase: number, upright = false) {
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
      const r =
        radius *
        (1 +
          (upright ? 0.012 : 0.075) * Math.sin(u * 19 - phase) +
          (upright ? 0.008 : 0.035) * Math.sin(u * 43 + phase)) *
        end;
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
          this.center.x + nx * localRadius,
          this.center.y + ny * localRadius,
          this.center.z + nz * localRadius,
        );
        if (upright && u > 0.9) {
          const capT = (u - 0.9) / 0.1;
          const slope =
            (-radius * capT) /
            (Math.max(0.01, Math.sqrt(1 - capT * capT)) *
              0.1 *
              Math.max(1, this.points.at(-1)!.y - this.points[0].y));
          const length = Math.hypot(1, slope);
          normals.setXYZ(
            index,
            (nx - this.tangent.x * slope) / length,
            (ny - this.tangent.y * slope) / length,
            (nz - this.tangent.z * slope) / length,
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
  private puddles: THREE.Mesh[] = [];
  private collar: THREE.Mesh;
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
    this.column = new FoamRibbon(6, this.material);
    this.add(this.column);
    const geometry = new THREE.SphereGeometry(1, 28, 18);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.puddles.push(mesh);
      this.add(mesh);
    }
    this.collar = new THREE.Mesh(
      new THREE.SphereGeometry(1, 36, 20),
      this.material,
    );

    this.collar.position.set(0, 2, 0);
    this.collar.castShadow = true;
    this.collar.receiveShadow = true;
    this.add(this.collar);
    this.visible = false;
  }
  update(
    elapsed: number,
    top: number,
    settling: number,
    color: THREE.Color,
    landed: number,
  ) {
    this.visible = elapsed > 0;
    this.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.12);
    if (elapsed < this.lastElapsed || elapsed === 0) this.peak = 0;
    this.lastElapsed = elapsed;
    this.peak = Math.max(this.peak, top);
    const displayTop =
      settling > 0
        ? 39 + (this.peak - 39) * (1 - Math.min(0.25, settling / 300))
        : top;
    const grow = Math.min(1, elapsed / 2),
      height = Math.max(41, displayTop - 1.5);
    this.column.visible = height > 41;
    const h = height - 39;
    const cp = this.column.points;
    for (let i = 0; i < cp.length; i++)
      cp[i].set(
        0.12 * Math.sin(elapsed * 0.35) * Math.sin((i * Math.PI) / 5),
        39 + (h * i) / (cp.length - 1),
        0,
      );
    const soften = 1 - Math.min(0.18, settling / 150);
    this.column.update(8.5 * grow * soften, elapsed * 0.35, true);
    this.collar.visible = landed > 0;
    const build = Math.min(1, landed / 650);
    this.collar.scale.set(22, Math.max(0.15, build * 4), 20);
    for (let i = 0; i < this.puddles.length; i++) {
      const mesh = this.puddles[i];
      const pile = Math.min(1, landed / 700);
      mesh.visible = pile > 0;
      const angle = i * Math.PI * 0.5;
      mesh.position.set(Math.cos(angle) * 14, 2, Math.sin(angle) * 14);
      mesh.scale.set((10 + (i % 2)) * pile, 3.5 * pile, (10 + (i % 2)) * pile);
    }
  }
  dispose() {
    this.column.geometry.dispose();
    this.puddles[0].geometry.dispose();
    this.collar.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
