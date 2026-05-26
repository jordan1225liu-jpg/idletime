/**
 * 作物生長計算 + 升級數學的單元測試。
 * 跑法:pnpm --filter @idletime/bot test
 */
import { strict as assert } from 'node:assert';
import {
  computeCropProgress,
  CROPS,
  unlockedCrops,
  nextLockedCrops,
  allCropsByLevel,
} from '../src/lib/crops.js';
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
  const r = computeCropProgress(base, 15 * 60, new Date(base.getTime() + 14 * MIN + 59 * 1000));
  assert.equal(r.ready, false);
  assert.equal(r.progress, 99);
});

console.log('\n[CROPS 設定一致性 — 16 種作物]');

test('共 16 種作物', () => {
  assert.equal(Object.keys(CROPS).length, 16);
});

test('每個 CROP 的 seedId 都有 _seed 後綴', () => {
  for (const crop of Object.values(CROPS)) {
    assert.ok(crop.seedId.endsWith('_seed'), `${crop.id}.seedId 應該以 _seed 結尾`);
  }
});

test('解鎖等級嚴格遞增(依 allCropsByLevel 排序)', () => {
  const sorted = allCropsByLevel();
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      sorted[i]!.unlockLevel > sorted[i - 1]!.unlockLevel,
      `${sorted[i]!.id} (Lv ${sorted[i]!.unlockLevel}) 應該 > ${sorted[i - 1]!.id} (Lv ${sorted[i - 1]!.unlockLevel})`,
    );
  }
});

test('成熟時間遞增(高級 = 久)', () => {
  const sorted = allCropsByLevel();
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i]!.growSeconds > sorted[i - 1]!.growSeconds);
  }
});

test('XP 報酬遞增,但 XP/分鐘 嚴格遞減(diminishing returns)', () => {
  const sorted = allCropsByLevel();
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i]!.xpReward > sorted[i - 1]!.xpReward, 'XP 應遞增');
    const xpPerMinNow = sorted[i]!.xpReward / (sorted[i]!.growSeconds / 60);
    const xpPerMinPrev = sorted[i - 1]!.xpReward / (sorted[i - 1]!.growSeconds / 60);
    assert.ok(
      xpPerMinNow < xpPerMinPrev,
      `${sorted[i]!.id} XP/分 (${xpPerMinNow.toFixed(3)}) 應 < ${sorted[i - 1]!.id} (${xpPerMinPrev.toFixed(3)})`,
    );
  }
});

test('金幣/分鐘 嚴格遞增(長作物回報補償)', () => {
  const sorted = allCropsByLevel();
  for (let i = 1; i < sorted.length; i++) {
    const goldPerMinNow = sorted[i]!.sellPrice / (sorted[i]!.growSeconds / 60);
    const goldPerMinPrev = sorted[i - 1]!.sellPrice / (sorted[i - 1]!.growSeconds / 60);
    assert.ok(
      goldPerMinNow > goldPerMinPrev,
      `${sorted[i]!.id} 金/分 (${goldPerMinNow.toFixed(3)}) 應 > ${sorted[i - 1]!.id} (${goldPerMinPrev.toFixed(3)})`,
    );
  }
});

test('體力消耗也漸增', () => {
  const sorted = allCropsByLevel();
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(
      sorted[i]!.energyCost >= sorted[i - 1]!.energyCost,
      `${sorted[i]!.id} 體力 (${sorted[i]!.energyCost}) 應 >= ${sorted[i - 1]!.id} (${sorted[i - 1]!.energyCost})`,
    );
  }
});

console.log('\n[unlockedCrops / nextLockedCrops]');

test('Lv 1 → 只有小麥解鎖', () => {
  const u = unlockedCrops(1);
  assert.equal(u.length, 1);
  assert.equal(u[0]!.id, 'wheat');
});

test('Lv 5 → 解鎖 3 個(wheat, carrot, potato)', () => {
  const u = unlockedCrops(5);
  assert.equal(u.length, 3);
  assert.deepEqual(u.map((c) => c.id), ['wheat', 'carrot', 'potato']);
});

test('Lv 100 → 全部 16 個解鎖', () => {
  assert.equal(unlockedCrops(100).length, 16);
});

test('Lv 1 的下個解鎖目標是 carrot (Lv 3)', () => {
  const n = nextLockedCrops(1, 2);
  assert.equal(n.length, 2);
  assert.equal(n[0]!.id, 'carrot');
  assert.equal(n[1]!.id, 'potato');
});

test('Lv 100 沒有下個解鎖', () => {
  assert.equal(nextLockedCrops(100, 2).length, 0);
});

console.log('\n[addExp — 升級邏輯]');

test('Lv 1 + 50 XP (不夠升)→ 還在 Lv 1', () => {
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
