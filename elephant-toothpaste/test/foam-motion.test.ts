import test from 'node:test';
import assert from 'node:assert/strict';
import { FoamMotion } from '../src/foam-motion';
test('影片動作：頂端先彎折、下段支撐、同一批材料接地並保留', () => {
  const motion = new FoamMotion();
  motion.reset(88);
  const points = motion.points;
  motion.advance(4, 88);
  assert.deepEqual(points[0].toArray(), [0, 39, 0]);
  assert.deepEqual(points[24].toArray(), [0, 72, 0]);
  assert.ok(points[64].x < -0.1);
  assert.ok(points[64].y < 127);
  motion.advance(24, 88);
  assert.equal(motion.points, points);
  assert.ok(points.some(p => p.y < 12));
  assert.ok(points.every(p => p.y >= 2.4 && p.toArray().every(Number.isFinite)));
  const settled = points.map(p => p.toArray());
  motion.advance(3600, 88);
  assert.deepEqual(points.map(p => p.toArray()), settled);
});
test('固定步長：不同畫面更新間隔得到相同折疊；重設清除動作', () => {
  const a = new FoamMotion(), b = new FoamMotion();
  a.reset(88); b.reset(88);
  a.advance(24, 88);
  for (let i = 1; i <= 1440; i++) b.advance(i / 60, 88);
  assert.deepEqual(a.points.map(p => p.toArray()), b.points.map(p => p.toArray()));
  b.reset(88);
  assert.deepEqual(b.points[64].toArray(), [0, 127, 0]);
  b.advance(24, 20);
  assert.deepEqual(b.points[64].toArray(), [0, 59, 0]);
});

test('實際表面重用頂點、無非有限數值，堆積後保持形狀', async () => {
  const { FoamRibbon } = await import('../src/foam-surface');
  const { MeshStandardMaterial } = await import('three');
  const material = new MeshStandardMaterial(), mesh = new FoamRibbon(65, material);
  const motion = new FoamMotion(); motion.reset(88);
  const buffer = mesh.geometry.getAttribute('position').array;
  const update = (t: number) => {
    const points = motion.advance(t, 88);
    mesh.points.forEach((p, i) => p.copy(points[i]));
    mesh.update(2.1, 0, true, 0, 0, motion.radii);
    assert.equal(mesh.geometry.getAttribute('position').array, buffer);
    assert.ok(Array.from(buffer).every(Number.isFinite));
  };
  for (const t of [0, 4, 8, 12, 24]) {
    update(t);
    if (t === 0) {
      for (let i = 0; i < buffer.length; i += 3)
        assert.ok(Math.hypot(buffer[i], buffer[i + 2]) <= 3.05, '剛噴出的整段泡沫不超過量筒內徑');
    }
    const length = motion.points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(motion.points[i]), 0);
    assert.ok(Math.abs(length - 88) / 88 < 0.02, '折疊保持材料長度，不整根壓縮成堆');
  }
  mesh.geometry.computeBoundingBox();
  assert.ok(mesh.geometry.boundingBox!.min.y <= 0.1, "盤繞堆積須貼地，不可懸浮");
  const settled = Array.from(buffer);
  update(3600);
  assert.deepEqual(Array.from(buffer), settled);
  mesh.geometry.dispose(); material.dispose();
});


test('落下的原泡沫盤繞成多層立體堆積，筒口維持原直徑', () => {
  const motion = new FoamMotion(); motion.reset(88);
  motion.advance(4, 88);
  assert.ok(motion.radii.every(r => r === 2.1), '尚未落地不可在底部憑空膨出泡沫');
  motion.advance(24, 88);
  const deposited = motion.points.filter((_, i) => motion.radii[i] > 3);
  assert.ok(deposited.length > 30);
  const top = Math.max(...deposited.map(p => p.y));
  const bottom = Math.min(...deposited.map(p => p.y));
  assert.ok(top - bottom > 18, '同一批材料堆出多層高度，不能攤成平面');
  assert.ok(Math.max(...deposited.map(p => p.x)) - Math.min(...deposited.map(p => p.x)) < 16);
  assert.ok(Math.max(...deposited.map(p => p.z)) - Math.min(...deposited.map(p => p.z)) > 5);
  assert.equal(motion.radii[0], 2.1, '噴口截面不膨大');
  assert.equal(motion.points.length, 65, '不另外生成地面泡沫');
  const shape = motion.points.map(p => p.toArray()), radii = [...motion.radii];
  motion.advance(3600, 88);
  assert.deepEqual(motion.points.map(p => p.toArray()), shape);
  assert.deepEqual(motion.radii, radii);
  motion.reset(88);
  assert.ok(motion.radii.every(r => r === 2.1));
});
