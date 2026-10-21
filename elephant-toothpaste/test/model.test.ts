import { FoamRibbon } from "../src/foam-surface";
import { MeshStandardMaterial } from "three";
import {
  CYLINDER_CAPACITY_ML,
  CYLINDER_INNER_RADIUS,
  CYLINDER_OUTER_RADIUS,
  cylinderGeometry,
  liquidGeometry,
  liquidLevelForVolume,
} from "../src/cylinder";
import {
  pillarRadius,
  pillarSwelling,
  collapseProgress,
  localCollapseProgress,
  pillarPoint,
} from "../src/foam-profile";
import { estimateFoam, ESTIMATE_ASSUMPTIONS } from "../src/estimates";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  FoamSimulation,
  calculateCatalystEffect,
  bounded,
  visualParameters,
  DURATION,
} from "../src/model";
import { catalysts } from "../src/catalysts";
import {
  createRecord,
  group,
  concentrations,
  unfair,
  unique,
  loadHistory,
  STORAGE_KEY,
} from "../src/history";
import { csv } from "../src/csv";
function run(h2o2 = 30, catalystId = "ki", concentration = 10, dt = 1 / 60) {
  const sim = new FoamSimulation({
    ...defaults(),
    h2o2,
    catalystId,
    concentration,
  });
  for (let t = 0; t < DURATION + 0.2; t += dt) sim.advance(dt);
  return sim;
}
test("固定視覺基準：30% H₂O₂ / 10% KI 濃密高柱及堆積", () => {
  const sim = run();
  assert.ok(sim.emitted >= 3500 && sim.emitted <= 3650);
  assert.ok(sim.maxHeight > 110 && sim.maxHeight < 140);
  assert.ok(sim.particles.filter((p) => p.landed).length > 500);
  assert.ok(sim.particles.some((p) => Math.hypot(p.x, p.z) > 10));
  assert.ok(sim.particles.some((p) => p.y > 80));
  console.log(
    "動畫基準",
    JSON.stringify({
      particles: sim.emitted,
      height: sim.maxHeight,
      landed: sim.particles.filter((p) => p.landed).length,
    }),
  );
});
test("不同畫面更新頻率不改變固定步進結果", () => {
  const a = run(),
    b = run(30, "ki", 10, 1 / 30);
  assert.equal(a.emitted, b.emitted);
  assert.equal(a.maxHeight, b.maxHeight);
  const slow = run(30, "ki", 10, 0.5);
  assert.equal(a.maxHeight, slow.maxHeight);
  assert.equal(a.emitted, slow.emitted);
});
test("百分比、零濃度、上限及粒子限制", () => {
  assert.equal(calculateCatalystEffect(defaults()), 1);
  for (const c of catalysts) {
    assert.equal(run(0, c.id, 100).emitted, 0);
    assert.equal(run(30, c.id, 0).emitted, 0);
  }
  const sim = run(100, "ki", 100);
  sim.advance(200);
  assert.ok(
    sim.particles.length <= visualParameters(sim.parameters).foamParticleLimit,
  );
  assert.ok(sim.liquidDrop <= 7.5);
  assert.equal(bounded("abc", 0, 100), 0);
  assert.equal(bounded(-1, 0, 100), 0);
  assert.equal(bounded(200, 0, 100), 100);
});
test("十種物質、化學式和名目濃度基準", () => {
  assert.equal(catalysts.length, 10);
  assert.equal(new Set(catalysts.map((c) => c.formula)).size, 10);
  assert.ok(!JSON.stringify(catalysts).includes("KMnO₄"));
  assert.match(
    catalysts.find((c) => c.id === "mno2")!.concentrationBasis,
    /懸浮液/,
  );
});
test("快照不可變、唯一 ID、自動分組不合併濃度及 CSV 一致", () => {
  const sim = run();
  const a = createRecord(sim, 1, 1);
  sim.parameters.rgb[0] = 0;
  assert.equal(a.parameters.rgb[0], 65);
  const b = createRecord(run(30, "mno2", 20), 2, 0.85);
  const c = createRecord(run(20), 3, 2 / 3);
  const records = [c, b, a];
  assert.equal(group(records, 30).length, 2);
  assert.equal(group([a, a], 30).length, 1);
  assert.deepEqual(concentrations(records), [20, 30]);
  assert.equal(unique([a, a]).length, 1);
  assert.ok(unfair([a, b]));
  assert.equal(
    group(
      records.filter((r) => r.id !== a.id),
      30,
    ).length,
    1,
  );
  assert.equal(group([], 30).length, 0);
  const exported = csv(records);
  assert.ok(exported.startsWith("\uFEFF"));
  assert.ok(exported.includes(String(a.volume)));
  assert.ok(exported.includes(String(a.mass)));
  assert.ok(exported.includes(String(a.height)));
  assert.ok(exported.includes(a.id));
  assert.equal(exported.split("\r\n").length, 4);
});
test("重新載入去重，損毀與未知版本資料不靜默覆寫", () => {
  const record = createRecord(run(), 1, 1);
  const storage = {
    getItem: (key: string) =>
      key === STORAGE_KEY ? JSON.stringify([record, record]) : null,
  };
  assert.equal(loadHistory(storage).length, 1);
  assert.throws(() => loadHistory({ getItem: () => "{broken" }));
  assert.throws(() =>
    loadHistory({ getItem: () => JSON.stringify([{ id: "old" }]) }),
  );
});

test("體積與質量依化學計量與假設換算，不依賴粒子數，且舊紀錄不補算", () => {
  const p = defaults();
  assert.deepEqual(estimateFoam(p, 0), { volume: 0, mass: 0 });
  assert.deepEqual(estimateFoam({ ...p, h2o2: 0 }, 1), { volume: 0, mass: 0 });
  const full = estimateFoam(p, 1),
    half = estimateFoam(p, 0.5);
  const moles = (100 * 0.3) / 34.0147 / 2;
  const gas = moles * 24465 * 0.15;
  const liquid = (gas * 0.02) / 0.98;
  assert.ok(Math.abs(full.volume - (gas + liquid)) < 1e-8);
  assert.ok(Math.abs(full.mass - (moles * 31.998 * 0.15 + liquid)) < 1e-8);
  assert.ok(full.volume > half.volume && full.mass > half.mass);
  for (const h2o2 of [0, 10, 30, 100]) {
    const value = estimateFoam({ ...p, h2o2 }, 1);
    assert.ok(value.mass <= 100);
    assert.ok(Number.isFinite(value.volume));
  }
  const sim = run();
  const a = createRecord(sim, 1, 1);
  sim.particles = [];
  sim.emitted = 0;
  assert.deepEqual(estimateFoam(sim.parameters, sim.progress), {
    volume: a.volume,
    mass: a.mass,
  });
  assert.deepEqual(a.estimateAssumptions, ESTIMATE_ASSUMPTIONS);
  const old = {
    ...a,
    modelVersion: "illustrative-1.0",
    volume: null,
    mass: null,
  };
  delete old.estimateAssumptions;
  const data = loadHistory({ getItem: () => JSON.stringify([old, a]) });
  assert.equal(data[0].volume, a.volume); // duplicate ID keeps one actual snapshot
  old.id = "legacy";
  const mixed = loadHistory({ getItem: () => JSON.stringify([old, a]) });
  assert.equal(mixed.length, 2);
  assert.equal(mixed[0].volume, null);
  assert.equal(mixed[0].mass, null);
  assert.ok(csv(mixed).includes("未估算"));
  assert.ok(csv(mixed).includes(String(a.volume)));
  assert.throws(() =>
    loadHistory({ getItem: () => JSON.stringify([{ ...a, mass: -1 }]) }),
  );
});

test("直立泡沫輪廓：粗柱、底部外擴、圓頂收合", () => {
  assert.ok(pillarRadius(0) > pillarRadius(0.5));
  assert.ok(pillarRadius(0.5) > 0.99);
  assert.ok(pillarRadius(0.95) > 0.8);
  assert.ok(pillarRadius(0.99) > 0 && pillarRadius(0.99) < pillarRadius(0.95));
  assert.equal(pillarRadius(1), 0);
  for (let i = 0; i <= 100; i++)
    assert.ok(Number.isFinite(pillarRadius(i / 100)));
});

test("側邊鼓起連在柱身、左右不對稱，圓頂不形成鉤狀", () => {
  assert.ok(pillarSwelling(0.63, -1) > 1.4);
  assert.ok(pillarSwelling(0.63, -1) > pillarSwelling(0.63, 1));
  assert.ok(pillarSwelling(0.8, 1) > 1.2);
  assert.ok(pillarSwelling(1, -1) < 1.01);
  assert.equal(pillarSwelling(0.6, 0), 1);
});

test("過高泡沫完成後漸進側傾、頂部下垂及落地；矮柱不強制坍塌", () => {
  const height = 88;
  assert.equal(collapseProgress(0, height), 0);
  assert.equal(collapseProgress(2, height), 0);
  assert.ok(collapseProgress(7, height) > 0 && collapseProgress(7, height) < 1);
  assert.equal(collapseProgress(12, height), 1);
  assert.equal(collapseProgress(30, 20), 0);
  const start = pillarPoint(1, height, 0),
    bend = pillarPoint(1, height, 12),
    end = pillarPoint(1, height, 24);
  assert.equal(start.x, 0);
  assert.equal(start.y, 127);
  assert.ok(bend.x < -20 && bend.y < start.y);
  assert.ok(end.y <= 5.001 && end.y >= 0);
  assert.deepEqual(pillarPoint(0, height, 6), { x: 0, y: 39, z: 0 });
  let previous = 0;
  for (let t = 0; t <= 30; t += 0.1) {
    const p = pillarPoint(1, height, t);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(Math.abs(p.x - previous) < 2);
    previous = p.x;
  }
});

test("100 mL 量筒：直筒、平底底座、容量刻度與固定液底", () => {
  assert.equal(CYLINDER_CAPACITY_ML, 100);
  assert.ok(CYLINDER_INNER_RADIUS < CYLINDER_OUTER_RADIUS);
  const glass = cylinderGeometry();
  glass.computeBoundingBox();
  assert.equal(glass.boundingBox!.min.y, 0);
  assert.ok(glass.boundingBox!.max.y >= 40);
  glass.dispose();
  assert.equal(liquidLevelForVolume(0), 2);
  assert.equal(liquidLevelForVolume(100), 35);
  assert.equal(liquidLevelForVolume(50), (2 + 35) / 2);
  for (const volume of [10, 50, 100]) {
    const level = liquidLevelForVolume(volume),
      g = liquidGeometry(level);
    g.computeBoundingBox();
    assert.equal(g.boundingBox!.min.y, 2);
    assert.ok(Math.abs(g.boundingBox!.max.y - level) < 1e-5);
    g.dispose();
  }
});

test("坍塌由最高點向下傳遞，同一批泡沫落地，底部不能提前冒出", () => {
  const h = 88;
  assert.ok(localCollapseProgress(3, h, 1) > 0);
  assert.equal(localCollapseProgress(3, h, 0.5), 0);
  assert.equal(localCollapseProgress(3, h, 0), 0);
  assert.deepEqual(pillarPoint(0, h, 10), { x: 0, y: 39, z: 0 });
  assert.equal(pillarPoint(0.5, h, 6).y, 83);
  assert.ok(pillarPoint(1, h, 6).y < 127);
  for (let t = 0; t <= 24; t += 0.2) {
    assert.ok(
      localCollapseProgress(t, h, 1) >= localCollapseProgress(t, h, 0.5),
    );
    assert.ok(
      localCollapseProgress(t, h, 0.5) >= localCollapseProgress(t, h, 0),
    );
  }
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    let previous = 39 + h * u;
    for (let t = 0; t <= 24; t += 0.1) {
      const point = pillarPoint(u, h, t);
      assert.ok(point.y <= previous + 1e-8);
      assert.ok(point.y >= 2);
      previous = point.y;
    }
    assert.ok(pillarPoint(u, h, 24).y <= 14.001);
  }
});

test("實際曲面由同一頂點緩衝下落：前期底部不冒泡，落地後才攤開", () => {
  const material = new MeshStandardMaterial(),
    mesh = new FoamRibbon(17, material),
    h = 88;
  const position = mesh.geometry.getAttribute("position");
  const buffer = position.array;
  const update = (time: number) => {
    mesh.points.forEach((p, i) => {
      const point = pillarPoint(i / 16, h, time);
      p.set(point.x, point.y, point.z);
    });
    mesh.update(8.5, 0, true, localCollapseProgress(time, h, 0), h);
    mesh.geometry.computeBoundingBox();
  };
  update(0);
  const base = Array.from(buffer.slice(0, 19 * 3)),
    initialWidth =
      mesh.geometry.boundingBox!.max.z - mesh.geometry.boundingBox!.min.z;
  update(6);
  assert.deepEqual(Array.from(buffer.slice(0, 19 * 3)), base);
  for (const time of [0, 3, 6, 9, 12, 18, 24]) {
    update(time);
    assert.equal(position.array, buffer);
    assert.ok(Array.from(buffer).every(Number.isFinite));
    assert.ok(mesh.geometry.boundingBox!.min.y >= 0);
  }
  assert.ok(mesh.geometry.boundingBox!.max.y < 30);
  assert.ok(
    mesh.geometry.boundingBox!.max.z - mesh.geometry.boundingBox!.min.z >
      initialWidth,
  );
  mesh.geometry.dispose();
  material.dispose();
});

test("坍塌後原泡沫長時間保留：不縮小、不換頂點或消失", () => {
  assert.equal(visualParameters(defaults()).foamLifetime, null);
  const material = new MeshStandardMaterial(),
    mesh = new FoamRibbon(17, material),
    h = 88;
  const update = (time: number) => {
    mesh.points.forEach((point, i) => {
      const p = pillarPoint(i / 16, h, time);
      point.set(p.x, p.y, p.z);
    });
    mesh.update(8.5, 16 * 0.35, true, localCollapseProgress(time, h, 0), h);
  };
  update(24);
  const settled = Array.from(mesh.geometry.getAttribute("position").array);
  mesh.geometry.computeBoundingBox();
  assert.ok(mesh.geometry.boundingBox!.max.y > 10);
  for (const time of [60, 300, 3600]) {
    update(time);
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute("position").array),
      settled,
    );
    assert.ok(mesh.visible);
  }
  mesh.geometry.dispose();
  material.dispose();
});
