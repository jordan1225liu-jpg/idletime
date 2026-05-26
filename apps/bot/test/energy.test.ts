/**
 * 體力結算的單元測試。
 * 跑法:pnpm --filter @idletime/bot test
 *
 * 不需要 DB,只測純函式 settleFromState + msUntilNextEnergy。
 */
import { strict as assert } from 'node:assert';
import {
  ENERGY_REGEN_INTERVAL_MS,
  msUntilNextEnergy,
  settleFromState,
} from '../src/lib/energy.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.error(`      ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const FIVE_MIN = ENERGY_REGEN_INTERVAL_MS;
const base = new Date('2026-01-01T00:00:00.000Z');

console.log('\n[settleFromState]');

test('5 分鐘整 → +1 體力,timer 推進 5 分鐘', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 5 * MIN);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 51);
  assert.equal(r.energyLastSettledAt.toISOString(), now.toISOString());
});

test('4 分鐘 → 不變(未到一個 tick)', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 4 * MIN);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 50);
  assert.equal(r.energyLastSettledAt.toISOString(), base.toISOString());
});

test('6 分鐘 → +1,timer 推進 5 分(剩 1 分 carry)', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 6 * MIN);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 51);
  // timer 只推進 5 分鐘,不是 6
  assert.equal(r.energyLastSettledAt.toISOString(), new Date(base.getTime() + 5 * MIN).toISOString());
});

test('8 小時離線(50 → 100,卡上限)', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 8 * HOUR);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 100);
  // 50 次 tick,共 250 分鐘
  assert.equal(
    r.energyLastSettledAt.toISOString(),
    new Date(base.getTime() + 50 * FIVE_MIN).toISOString(),
  );
});

test('3 天離線(從滿開始)→ 還是滿,timer 推進到 now', () => {
  const state = { energy: 100, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 3 * DAY);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 100);
  // 已滿狀態 timer 直接推進到 now,避免之後用掉一點就瞬間補滿
  assert.equal(r.energyLastSettledAt.toISOString(), now.toISOString());
});

test('連續呼叫:6 分 → 14 分 (剩餘累積正確)', () => {
  // 第一次 settle:6 分,+1,timer 在 +5
  let state: { energy: number; energyMax: number; energyLastSettledAt: Date } = {
    energy: 50,
    energyMax: 100,
    energyLastSettledAt: base,
  };
  state = settleFromState(state, new Date(base.getTime() + 6 * MIN));
  assert.equal(state.energy, 51);
  assert.equal(state.energyLastSettledAt.toISOString(), new Date(base.getTime() + 5 * MIN).toISOString());

  // 第二次 settle:從 base+14min,timer 在 base+5min → 9 分鐘經過 = 1 tick + 4 分鐘剩餘
  state = settleFromState(state, new Date(base.getTime() + 14 * MIN));
  assert.equal(state.energy, 52);
  assert.equal(
    state.energyLastSettledAt.toISOString(),
    new Date(base.getTime() + 10 * MIN).toISOString(),
  );
});

test('剛好卡上限:90/100 + 100 分鐘 → 100/100, timer = base + 50 分', () => {
  const state = { energy: 90, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 100 * MIN);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 100);
  // 只用了 10 個 tick = 50 分鐘
  assert.equal(r.energyLastSettledAt.toISOString(), new Date(base.getTime() + 50 * MIN).toISOString());
});

test('已滿 + 1 分(尚未到 tick,但因為已滿要更新 timer)', () => {
  const state = { energy: 100, energyMax: 100, energyLastSettledAt: base };
  const now = new Date(base.getTime() + 1 * MIN);
  const r = settleFromState(state, now);
  assert.equal(r.energy, 100);
  assert.equal(r.energyLastSettledAt.toISOString(), now.toISOString());
});

console.log('\n[msUntilNextEnergy]');

test('剛剛 settle 完,剩 5 分整', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const ms = msUntilNextEnergy(state, base);
  assert.equal(ms, FIVE_MIN);
});

test('過了 2 分,剩 3 分', () => {
  const state = { energy: 50, energyMax: 100, energyLastSettledAt: base };
  const ms = msUntilNextEnergy(state, new Date(base.getTime() + 2 * MIN));
  assert.equal(ms, 3 * MIN);
});

test('已滿時回 0', () => {
  const state = { energy: 100, energyMax: 100, energyLastSettledAt: base };
  const ms = msUntilNextEnergy(state, new Date(base.getTime() + 100 * MIN));
  assert.equal(ms, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
