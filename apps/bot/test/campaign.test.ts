/**
 * 主線劇情內容(catalog)結構測試 —— 防止之後改 campaign.ts 時打錯。
 * 注意:不連 DB,只驗證靜態內容的一致性。
 */
import { strict as assert } from 'node:assert';
import { CAMPAIGN_STEPS } from '../src/lib/campaign.js';
import { NPCS } from '../src/lib/npcs.js';

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

console.log('\n[CAMPAIGN_STEPS catalog]');

test('至少有 1 章', () => {
  assert.ok(CAMPAIGN_STEPS.length >= 1);
});

test('step 編號從 1 開始連續遞增', () => {
  CAMPAIGN_STEPS.forEach((s, i) => {
    assert.equal(s.step, i + 1, `第 ${i} 個 step 應為 ${i + 1},實際 ${s.step}`);
  });
});

test('每章的 npc 都是有效的 NPC', () => {
  for (const s of CAMPAIGN_STEPS) {
    assert.ok(s.npc in NPCS, `未知 NPC: ${s.npc}(第 ${s.step} 章)`);
  }
});

test('每章都有非空的標題、旁白、目標說明', () => {
  for (const s of CAMPAIGN_STEPS) {
    assert.ok(s.title.trim().length > 0, `第 ${s.step} 章標題空白`);
    assert.ok(s.narrative.trim().length > 0, `第 ${s.step} 章旁白空白`);
    assert.ok(s.objective.label.trim().length > 0, `第 ${s.step} 章目標說明空白`);
  }
});

test('skill_level 目標只用已知技能(farming/fishing)', () => {
  const known = new Set(['farming', 'fishing', 'gathering', 'cooking', 'smithing', 'brewing']);
  for (const s of CAMPAIGN_STEPS) {
    if (s.objective.type === 'skill_level') {
      assert.ok(known.has(s.objective.skillId), `第 ${s.step} 章未知技能 ${s.objective.skillId}`);
    }
  }
});

test('有 target 的目標其 target 為正整數', () => {
  for (const s of CAMPAIGN_STEPS) {
    const o = s.objective;
    if ('target' in o) {
      assert.ok(Number.isInteger(o.target) && o.target > 0, `第 ${s.step} 章 target 非正整數`);
    }
  }
});

test('獎勵合理:gold >= 0、物品數量 > 0', () => {
  for (const s of CAMPAIGN_STEPS) {
    if (s.reward.gold !== undefined) {
      assert.ok(s.reward.gold >= 0, `第 ${s.step} 章 gold 為負`);
    }
    for (const it of s.reward.items ?? []) {
      assert.ok(it.itemId.length > 0, `第 ${s.step} 章獎勵 itemId 空白`);
      assert.ok(Number.isInteger(it.quantity) && it.quantity > 0, `第 ${s.step} 章獎勵數量非正整數`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
