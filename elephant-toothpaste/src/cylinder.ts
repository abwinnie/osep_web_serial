import * as THREE from "three";
export const CYLINDER_CAPACITY_ML = 100;
export const LIQUID_BOTTOM = 2;
export const CYLINDER_INNER_RADIUS = 3.05;
export const CYLINDER_OUTER_RADIUS = 3.65;
export const CYLINDER_FULL_LEVEL = 35;
export function liquidLevelForVolume(volume: number) {
  return (
    LIQUID_BOTTOM +
    ((CYLINDER_FULL_LEVEL - LIQUID_BOTTOM) *
      Math.max(0, Math.min(100, volume))) /
      100
  );
}
export function cylinderGeometry() {
  const profile = [
    [0, 0],
    [8.5, 0],
    [8.8, 0.6],
    [8.5, 1.4],
    [4, 1.4],
    [3.65, 2],
    [3.65, 39.2],
    [4.1, 39.6],
    [4.1, 40],
    [3.05, 40],
    [3.05, 2],
    [0, 2],
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    80,
  );
}
export function liquidGeometry(level: number) {
  const top = Math.max(LIQUID_BOTTOM + 0.001, Math.min(39, level));
  return new THREE.LatheGeometry(
    [
      [0, LIQUID_BOTTOM],
      [CYLINDER_INNER_RADIUS, LIQUID_BOTTOM],
      [CYLINDER_INNER_RADIUS, top],
      [0, top],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    64,
  );
}
export function cylinderMarkings() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#263331";
  ctx.strokeStyle = "#263331";
  ctx.lineWidth = 3;
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("100 mL", 128, 58);
  // The marking mesh spans y=2..38. Numeric levels follow the volume mapping.
  for (let ml = 5; ml <= 100; ml += 5) {
    const y = ((38 - liquidLevelForVolume(ml)) / 36) * 1536;
    ctx.beginPath();
    ctx.moveTo(ml % 10 === 0 ? 30 : 65, y);
    ctx.lineTo(145, y);
    ctx.stroke();
    if (ml % 10 === 0) {
      ctx.font = "28px sans-serif";
      ctx.fillText(String(ml), 200, y + 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const rows = 36,
    cols = 28,
    positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const y = 2 + (j / rows) * 36,
        a = 0.64 + (i / cols - 0.5) * 1.7,
        r = CYLINDER_OUTER_RADIUS + 0.06;
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
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.renderOrder = 4;
  return { mesh, texture };
}
