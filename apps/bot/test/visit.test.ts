/**
 * /visit 純邏輯測試 — 不碰 DB,只測 canonicalPair 與 getExpectedAccepter。
 */
import { strict as assert } from 'node:assert';
import { canonicalPair, getExpectedAccepter } from '../src/lib/visit.js';

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

console.log('\n[canonicalPair]');

test('a < b → [a, b]', () => {
  assert.deepEqual(canonicalPair('alice', 'bob'), ['alice', 'bob']);
});

test('b < a → [a, b](反向呼叫也應該得到相同排序)', () => {
  assert.deepEqual(canonicalPair('bob', 'alice'), ['alice', 'bob']);
});

test('同一個 id', () => {
  assert.deepEqual(canonicalPair('same', 'same'), ['same', 'same']);
});

test('Discord ID(數字字串)— lex 排序', () => {
  // Discord ID 是 snowflake (數字字串),用 lex 排序就好
  // "100" < "20" lex 但 100 > 20 數值。對 CD pair 來說只要一致即可,不需要數值正確
  assert.deepEqual(canonicalPair('100', '20'), ['100', '20']);
  // 但同一對玩家正反呼叫結果一致是重點
  const [a1, b1] = canonicalPair('100', '20');
  const [a2, b2] = canonicalPair('20', '100');
  assert.equal(a1, a2);
  assert.equal(b1, b2);
});

console.log('\n[getExpectedAccepter]');

test('initiator = userIdA → accepter = userIdB', () => {
  assert.equal(getExpectedAccepter('alice', 'bob', 'alice'), 'bob');
});

test('initiator = userIdB → accepter = userIdA', () => {
  assert.equal(getExpectedAccepter('alice', 'bob', 'bob'), 'alice');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
