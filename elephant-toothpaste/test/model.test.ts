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
  assert.ok(exported.includes("未估算"));
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
