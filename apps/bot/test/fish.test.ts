/**
 * 釣魚邏輯純函式測試。不碰 DB,只測 fish.ts 的 tier 內插與抽選。
 */
import { strict as assert } from 'node:assert';
import { FISH_TIERS, rollFish, tierWeightsAtLevel } from '../src/lib/fish.js';

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

console.log('\n[FISH_TIERS 一致性]');

test('共 7 個 tier', () => {
  assert.equal(FISH_TIERS.length, 7);
});

test('Tier 名稱依設計', () => {
  const names = FISH_TIERS.map((t) => t.name);
  assert.deepEqual(names, ['雜物', '小魚', '中型魚', '大型魚', '海洋珍寶', '傳說生物', '神話']);
});

test('總共 30 種漁獲', () => {
  const total = FISH_TIERS.reduce((sum, t) => sum + t.fish.length, 0);
  assert.equal(total, 30);
});

test('每隻魚 id 唯一', () => {
  const ids = new Set<string>();
  for (const tier of FISH_TIERS) {
    for (const f of tier.fish) {
      assert.ok(!ids.has(f.id), `duplicate id: ${f.id}`);
      ids.add(f.id);
    }
  }
});

test('Lv 1 的 tier 權重總和 = 100', () => {
  const sum = FISH_TIERS.reduce((s, t) => s + t.weightAtLv1, 0);
  // 允許 0.01 的 floating-point 容差(神話 tier 是 0.01,可能對齊不完美)
  assert.ok(Math.abs(sum - 100) < 0.01, `sum=${sum}`);
});

test('Lv 100 的 tier 權重總和 = 100', () => {
  const sum = FISH_TIERS.reduce((s, t) => s + t.weightAtLv100, 0);
  assert.ok(Math.abs(sum - 100) < 0.01, `sum=${sum}`);
});

test('xpReward 遞增,goldReward 也遞增(雜物 = 0,後面遞增)', () => {
  for (let i = 1; i < FISH_TIERS.length; i++) {
    assert.ok(FISH_TIERS[i]!.xpReward > FISH_TIERS[i - 1]!.xpReward, `xp at tier ${i}`);
    assert.ok(FISH_TIERS[i]!.goldReward > FISH_TIERS[i - 1]!.goldReward, `gold at tier ${i}`);
  }
});

console.log('\n[tierWeightsAtLevel — 線性內插]');

test('Lv 1 回 weightAtLv1', () => {
  const w = tierWeightsAtLevel(1);
  for (let i = 0; i < FISH_TIERS.length; i++) {
    assert.ok(Math.abs(w[i]! - FISH_TIERS[i]!.weightAtLv1) < 0.0001);
  }
});

test('Lv 100 回 weightAtLv100', () => {
  const w = tierWeightsAtLevel(100);
  for (let i = 0; i < FISH_TIERS.length; i++) {
    assert.ok(Math.abs(w[i]! - FISH_TIERS[i]!.weightAtLv100) < 0.0001);
  }
});

test('Lv 50 大約是中間值', () => {
  const w = tierWeightsAtLevel(50);
  for (let i = 0; i < FISH_TIERS.length; i++) {
    const mid = (FISH_TIERS[i]!.weightAtLv1 + FISH_TIERS[i]!.weightAtLv100) / 2;
    // Lv 50 用 t = 49/99 ≈ 0.495,非完美中間,但接近
    assert.ok(Math.abs(w[i]! - mid) < 1, `tier ${i}: ${w[i]} vs mid ${mid}`);
  }
});

test('Lv 超出 100 → clamp', () => {
  const w200 = tierWeightsAtLevel(200);
  const w100 = tierWeightsAtLevel(100);
  for (let i = 0; i < w100.length; i++) {
    assert.ok(Math.abs(w200[i]! - w100[i]!) < 0.0001);
  }
});

test('Lv 0/負數 → clamp 到 1', () => {
  const w0 = tierWeightsAtLevel(0);
  const w1 = tierWeightsAtLevel(1);
  for (let i = 0; i < w1.length; i++) {
    assert.ok(Math.abs(w0[i]! - w1[i]!) < 0.0001);
  }
});

console.log('\n[rollFish — 抽選]');

test('rng 永遠回 0 → 一定抽 Tier 1 第一隻(雜物 老靴子)', () => {
  const r = rollFish(1, () => 0);
  assert.equal(r.tier.id, 'junk');
  assert.equal(r.fish.id, 'fish_old_boot');
});

test('rng 接近 1(0.99999)→ 落入最後一個 tier(神話)', () => {
  // Lv 1 神話權重 0.01,要 rng > 99.99% 才會落到神話
  // 用 0.99999 確保踩到最後一個 tier
  const r = rollFish(1, () => 0.99999);
  assert.equal(r.tier.id, 'mythical');
});

test('Lv 1 1000 次抽選 → 神話 < 10 次(probability ≈ 0.01%)', () => {
  let seed = 1;
  const lcg = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  let mythicalCount = 0;
  for (let i = 0; i < 1000; i++) {
    const r = rollFish(1, lcg);
    if (r.tier.id === 'mythical') mythicalCount++;
  }
  assert.ok(mythicalCount < 10, `mythical count at Lv 1: ${mythicalCount}`);
});

test('Lv 100 1000 次抽選 → 雜物 < 100 次(probability ≈ 2%)', () => {
  let seed = 1;
  const lcg = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  let junkCount = 0;
  for (let i = 0; i < 1000; i++) {
    const r = rollFish(100, lcg);
    if (r.tier.id === 'junk') junkCount++;
  }
  assert.ok(junkCount < 100, `junk count at Lv 100: ${junkCount}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
