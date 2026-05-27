/**
 * 回合制戰鬥引擎(純函式,可測試)。
 * 規則:玩家(隊伍)先攻 → 怪物反擊 → 重複,直到一方倒下。
 * 傷害 = max(1, 攻 - 防)。
 */

export interface MonsterStats {
  hp: number;
  attack: number;
  defense: number;
}

export interface CombatRound {
  playerDamage: number;
  monsterHpAfter: number;
  monsterDamage: number; // 0 = 怪物在反擊前就死了
  partyHpAfter: number;
}

export interface CombatResult {
  killed: boolean;
  rounds: CombatRound[];
  partyHpAfter: number;
}

/** 安全上限,避免「雙方都打不死對方」時無限迴圈 */
const MAX_ROUNDS = 500;

export function fightMonster(
  partyAttack: number,
  partyDefense: number,
  partyHp: number,
  monster: MonsterStats,
): CombatResult {
  let monsterHp = monster.hp;
  let hp = partyHp;
  const rounds: CombatRound[] = [];

  const playerDmg = Math.max(1, partyAttack - monster.defense);
  const monsterDmg = Math.max(1, monster.attack - partyDefense);

  for (let r = 0; r < MAX_ROUNDS; r++) {
    // 玩家先攻
    monsterHp = Math.max(0, monsterHp - playerDmg);

    if (monsterHp === 0) {
      rounds.push({ playerDamage: playerDmg, monsterHpAfter: 0, monsterDamage: 0, partyHpAfter: hp });
      return { killed: true, rounds, partyHpAfter: hp };
    }

    // 怪物反擊
    hp = Math.max(0, hp - monsterDmg);
    rounds.push({
      playerDamage: playerDmg,
      monsterHpAfter: monsterHp,
      monsterDamage: monsterDmg,
      partyHpAfter: hp,
    });

    if (hp === 0) {
      return { killed: false, rounds, partyHpAfter: 0 };
    }
  }

  // 達到回合上限還沒打死(怪太肉)→ 視為失敗
  return { killed: false, rounds, partyHpAfter: hp };
}
