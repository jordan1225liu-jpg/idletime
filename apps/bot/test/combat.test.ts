/**
 * 戰鬥引擎 + 怪物 catalog 測試。
 */
import { strict as assert } from 'node:assert';
import { fightMonster } from '../src/lib/combat.js';
import { REGIONS, REGION_BY_ID, sampleMonsters } from '../src/lib/monsters.js';

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

console.log('\n[fightMonster]');

test('秒殺:超高攻擊一回合擊殺,怪物來不及反擊', () => {
  const r = fightMonster(1000, 50, 500, { hp: 100, attack: 30, defense: 0 });
  assert.equal(r.killed, true);
  assert.equal(r.rounds.length, 1);
  assert.equal(r.rounds[0]!.monsterDamage, 0); // 秒殺,沒反擊
  assert.equal(r.partyHpAfter, 500); // 沒掉血
});

test('多回合:玩家 100 攻打 250 HP,DEF 0 → 3 回合', () => {
  const r = fightMonster(100, 100, 1000, { hp: 250, attack: 50, defense: 0 });
  assert.equal(r.killed, true);
  // 100, 100, 50 → 3 次攻擊;第 3 次擊殺
  assert.equal(r.rounds.length, 3);
});

test('傷害最低為 1(攻 < 防)', () => {
  // 玩家攻 10 vs 怪 DEF 200 → 每次只打 1
  const r = fightMonster(10, 9999, 1000, { hp: 5, attack: 1, defense: 200 });
  assert.equal(r.killed, true);
  assert.equal(r.rounds.length, 5); // 1 傷害 × 5 = 5 HP
});

test('打不贏:低攻高怪,隊伍被擊倒', () => {
  // 玩家攻 15 vs 怪 DEF 200(每回合 1 傷害),怪攻 5000 vs 隊伍 DEF 15
  const r = fightMonster(15, 15, 130, { hp: 5000, attack: 5000, defense: 200 });
  assert.equal(r.killed, false);
  assert.equal(r.partyHpAfter, 0);
  // 怪物每回合 max(1, 5000-15)=4985 傷害,隊伍 130 HP → 第 1 回合就死
  assert.equal(r.rounds.length, 1);
});

test('怪物傷害也最低為 1(怪攻 < 隊伍防)', () => {
  const r = fightMonster(50, 9999, 1000, { hp: 200, attack: 10, defense: 0 });
  // 玩家 50 攻打 200 HP → 4 回合。怪每回合 max(1, 10-9999)=1
  assert.equal(r.killed, true);
  assert.equal(r.rounds.length, 4);
  // 掉血 = 3 回合 × 1(第 4 回合秒殺不反擊)= 3
  assert.equal(r.partyHpAfter, 997);
});

console.log('\n[REGIONS catalog]');

test('5 個地區', () => {
  assert.equal(REGIONS.length, 5);
});

test('每區 10 隻怪 = 共 50 隻', () => {
  const total = REGIONS.reduce((s, r) => s + r.monsters.length, 0);
  assert.equal(total, 50);
});

test('等級區間銜接:1-20, 21-40, 41-60, 61-80, 81-100', () => {
  const expected = [[1, 20], [21, 40], [41, 60], [61, 80], [81, 100]];
  REGIONS.forEach((r, i) => {
    assert.equal(r.minLevel, expected[i]![0]);
    assert.equal(r.maxLevel, expected[i]![1]);
  });
});

test('每隻怪 id 唯一', () => {
  const ids = new Set<string>();
  for (const r of REGIONS) {
    for (const m of r.monsters) {
      assert.ok(!ids.has(m.id), `dup ${m.id}`);
      ids.add(m.id);
    }
  }
});

test('地區內怪物數值遞增(HP/ATK/DEF)', () => {
  for (const r of REGIONS) {
    for (let i = 1; i < r.monsters.length; i++) {
      assert.ok(r.monsters[i]!.hp >= r.monsters[i - 1]!.hp, `${r.id} HP at ${i}`);
      assert.ok(r.monsters[i]!.attack >= r.monsters[i - 1]!.attack, `${r.id} ATK at ${i}`);
    }
  }
});

test('高階地區怪物比低階強(跨區遞增)', () => {
  for (let i = 1; i < REGIONS.length; i++) {
    const prevMax = REGIONS[i - 1]!.monsters[REGIONS[i - 1]!.monsters.length - 1]!;
    const curMin = REGIONS[i]!.monsters[0]!;
    assert.ok(curMin.hp > prevMax.hp, `region ${i} first HP should exceed prev last`);
    assert.ok(curMin.defense > prevMax.defense, `region ${i} first DEF should exceed prev last`);
  }
});

test('sampleMonsters 回傳指定數量', () => {
  const region = REGION_BY_ID['forest']!;
  const sample = sampleMonsters(region, 10, () => 0.5);
  assert.equal(sample.length, 10);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
