/**
 * 作物生長計算 + 升級數學的單元測試。
 * 跑法:pnpm --filter @idletime/bot test:crops
 */
import { strict as assert } from 'node:assert';
import { computeCropProgress, CROPS } from '../src/lib/crops.js';
import { addExp, expForNextLevel } from '../src/lib/leveling.js';

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

const base = new Date('2026-01-01T00:00:00.000Z');
const MIN = 60 * 1000;

console.log('\n[computeCropProgress — 小麥 15 min]');

test('剛種下 → 0%, 還剩 15 分', () => {
  const r = computeCropProgress(base, 15 * 60, base);
  assert.equal(r.ready, false);
  assert.equal(r.progress, 0);
  assert.equal(r.msUntilReady, 15 * MIN);
});

test('種下 5 分鐘 → 33%', () => {
  const r = computeCropProgress(base, 15 * 60, new Date(base.getTime() + 5 * MIN));
  assert.equal(r.ready, false);
  assert.equal(r.progress, 33);
  assert.equal(r.msUntilReady, 10 * MIN);
});

test('種下 15 分鐘整 → 可收成 (ready=true, 100%)', () => {
  const r = computeCropProgress(base, 15 * 60, new Date(base.getTime() + 15 * MIN));
  assert.equal(r.ready, true);
  assert.equal(r.progress, 100);
  assert.equal(r.msUntilReady, 0);
});

test('種下 1 小時(超過很多)→ 依然 ready, 100%', () => {
  const r = computeCropProgress(base, 15 * 60, new Date(base.getTime() + 60 * MIN));
  assert.equal(r.ready, true);
  assert.equal(r.progress, 100);
});

test('99% 上限:14 分 59 秒 → 99% 不到 100', () => {
  // 14:59 / 15:00 = 99.88...% → floor 99
  const r = computeCropProgress(base, 15 * 60, new Date(base.getTime() + 14 * MIN + 59 * 1000));
  assert.equal(r.ready, false);
  assert.equal(r.progress, 99);
});

console.log('\n[CROPS 設定一致性]');

test('每個 CROP 的 seedId 都有 _seed 後綴', () => {
  for (const crop of Object.values(CROPS)) {
    assert.ok(crop.seedId.endsWith('_seed'), `${crop.id}.seedId 應該以 _seed 結尾`);
  }
});

test('解鎖等級遞增(wheat ≤ carrot ≤ pumpkin)', () => {
  assert.ok(CROPS.wheat!.unlockLevel <= CROPS.carrot!.unlockLevel);
  assert.ok(CROPS.carrot!.unlockLevel <= CROPS.pumpkin!.unlockLevel);
});

test('成熟時間遞增(高級作物 = 久)', () => {
  assert.ok(CROPS.wheat!.growSeconds < CROPS.carrot!.growSeconds);
  assert.ok(CROPS.carrot!.growSeconds < CROPS.pumpkin!.growSeconds);
});

test('XP 報酬遞增', () => {
  assert.ok(CROPS.wheat!.xpReward < CROPS.carrot!.xpReward);
  assert.ok(CROPS.carrot!.xpReward < CROPS.pumpkin!.xpReward);
});

console.log('\n[addExp — 升級邏輯]');

test('Lv 1 + 50 XP (不夠升)→ 還在 Lv 1', () => {
  // expForNextLevel(1) = floor(100 * 1^1.5) = 100
  const r = addExp(1, 0, 50);
  assert.equal(r.level, 1);
  assert.equal(r.exp, 50);
  assert.equal(r.levelsGained, 0);
});

test('Lv 1 + 100 XP (剛好夠)→ 升 Lv 2, 0 XP', () => {
  const r = addExp(1, 0, 100);
  assert.equal(r.level, 2);
  assert.equal(r.exp, 0);
  assert.equal(r.levelsGained, 1);
});

test('Lv 1 + 150 XP → 升 Lv 2, 剩 50 XP', () => {
  const r = addExp(1, 0, 150);
  assert.equal(r.level, 2);
  assert.equal(r.exp, 50);
  assert.equal(r.levelsGained, 1);
});

test('連跳兩級:Lv 1 + 500 XP', () => {
  // need 100 (→Lv2) + 282 (→Lv3) = 382 → Lv 3, 剩 118
  // expForNextLevel(2) = floor(100 * 2^1.5) = floor(282.84) = 282
  const r = addExp(1, 0, 500);
  assert.equal(r.level, 3);
  assert.equal(r.exp, 500 - 100 - 282);
  assert.equal(r.levelsGained, 2);
});

test('已 Lv 100,加 XP 不會超過', () => {
  const r = addExp(100, 0, 999999);
  assert.equal(r.level, 100);
  assert.equal(r.levelsGained, 0);
});

test('expForNextLevel 對齊預期(Lv 1 = 100)', () => {
  assert.equal(expForNextLevel(1), 100);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
