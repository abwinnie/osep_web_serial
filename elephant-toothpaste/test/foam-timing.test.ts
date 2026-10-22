import test from 'node:test';
import assert from 'node:assert/strict';
import { FoamTiming, PLAYBACK_SPEED, internalFoamTop, externalFoamGrowth } from '../src/foam-timing';
import { FoamSimulation, defaults } from '../src/model';
import { liquidLevelForVolume } from '../src/cylinder';
test('從 10 mL 液面先在筒內長高，到筒口才連續向外延伸', () => {
  const bottom = liquidLevelForVolume(defaults().liquidVolume);
  assert.equal(internalFoamTop(0, bottom), bottom);
  assert.ok(internalFoamTop(0.6, bottom) > bottom);
  assert.ok(internalFoamTop(0.6, bottom) < 40);
  assert.equal(internalFoamTop(1.2, bottom), 40);
  assert.equal(externalFoamGrowth(1.2), 0);
  assert.ok(externalFoamGrowth(1.21) < 0.01);
  assert.equal(externalFoamGrowth(4.2), 1);
});
test('最高點停止增加即倒塌，不等待反應完成；重設與暫停不推進', () => {
  const timing = new FoamTiming(), sim = new FoamSimulation(defaults());
  let onset = 0;
  for (let i = 0; i < 960; i++) {
    sim.advance(1/60); timing.update(sim.elapsed, sim.maxHeight, 1/60);
    if (timing.settling > 0) { onset = sim.elapsed; break; }
  }
  assert.ok(onset > 4.2 && onset < 6);
  const time = timing.settling;
  timing.update(sim.elapsed, sim.maxHeight, 0);
  assert.equal(timing.settling, time);
  timing.reset(); assert.equal(timing.settling, 0);
  assert.equal(PLAYBACK_SPEED, 2);
});
