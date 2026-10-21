import * as THREE from "three";
export const FLASK_OUTER: readonly (readonly [number, number])[] = [
  [0, 0],
  [11.8, 0],
  [13, 1.2],
  [13.8, 3],
  [13.5, 6],
  [12.4, 10],
  [10.6, 15],
  [8.4, 20],
  [5.6, 26],
  [3.7, 30],
  [3.65, 38.8],
  [4.1, 39.3],
  [4.2, 40],
  [3.55, 40.3],
];
const INNER: readonly (readonly [number, number])[] = [
  [12.3, 1.5],
  [13.1, 3.1],
  [12.9, 5.6],
  [11.8, 9.7],
  [10, 14.7],
  [7.8, 19.7],
  [5, 25.5],
  [3.05, 30],
  [3.05, 39.9],
];
function interpolate(
  profile: readonly (readonly [number, number])[],
  y: number,
) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1],
      [r1, y1] = profile[i];
    if (y >= y0 && y <= y1 && y1 > y0)
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return profile.at(-1)![0];
}
export const liquidRadiusAt = (y: number) => interpolate(INNER, y);
export const glassRadiusAt = (y: number) => interpolate(FLASK_OUTER, y);
export function flaskGeometry() {
  return new THREE.LatheGeometry(
    [...FLASK_OUTER, [3.1, 39.9], ...INNER.slice().reverse(), [0, 1.5]].map(
      ([r, y]) => new THREE.Vector2(r, y),
    ),
    80,
  );
}
export function liquidGeometry(level: number) {
  const top = Math.max(1.501, Math.min(39, level));
  const points = [
    [0, 1.5],
    ...INNER.filter(([, y]) => y < top),
    [liquidRadiusAt(top), top],
    [0, top],
  ];
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  );
}
export function flaskMarkings() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#263331";
  ctx.strokeStyle = "#263331";
  ctx.lineWidth = 4;
  ctx.textAlign = "center";
  ctx.font = "34px sans-serif";
  ctx.fillText("500 mL", 256, 85);
  ctx.font = "22px sans-serif";
  ctx.fillText("外觀示意刻度", 256, 120);
  for (let i = 0; i < 4; i++) {
    const y = 220 + i * 125;
    ctx.beginPath();
    ctx.moveTo(180, y);
    ctx.lineTo(320, y);
    ctx.stroke();
    ctx.font = "29px sans-serif";
    ctx.fillText(String(400 - i * 100), 360, y + 10);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const rows = 28,
    cols = 28,
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const y = 9 + (j / rows) * 18,
        a = 0.64 + (i / cols - 0.5) * 1.25,
        r = glassRadiusAt(y) + 0.07;
      positions.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push(i / cols, j / rows);
      if (j < rows && i < cols) {
        const n = j * (cols + 1) + i;
        indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.renderOrder = 4;
  return { mesh, texture };
}
