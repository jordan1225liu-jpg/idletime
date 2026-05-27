/**
 * 5 個 hunt 地區 × 10 隻怪 = 50 隻。
 *
 * 數值基準 = **solo 玩家**(1 人):用「該區頂級等級 + 建議裝備」的 solo 玩家設計,
 * 目標是「需要該等級 + 對應裝備才能 100% 通關,且過程中藥水有用」。
 *   R1: Lv20 + T2 (ATK25/DEF25/HP700)
 *   R2: Lv40 + T4 (ATK130/DEF130/HP1300)
 *   R3: Lv60 + T6 (ATK710/DEF710/HP1900)
 *   R4: Lv80 + T8 (ATK3010/DEF3010/HP2500)
 *   R5: Lv100 + T10 (ATK10010/DEF10010/HP3100)
 *
 * 多人:hunt.ts 只把「怪物 HP」依人數放大(2人×1.8, 3人×2.5),ATK/DEF 維持基礎值
 * (因為 party ATK/HP 隨人數疊加,但 DEF 取平均;只放大 HP 才不會讓多人被秒)。
 *
 * 跨區單調:下一區最弱怪的 HP 與 DEF 都 > 上一區最強怪(測試有檢查)。
 */

export interface Monster {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  attack: number;
  defense: number;
  xpReward: number;
  goldReward: number;
}

export interface HuntRegion {
  id: string;
  name: string;
  emoji: string;
  minLevel: number;
  maxLevel: number;
  recommendedTier: string;
  monsters: Monster[];
}

export const REGIONS: HuntRegion[] = [
  {
    id: 'plains',
    name: '新手平原',
    emoji: '🌾',
    minLevel: 1,
    maxLevel: 20,
    recommendedTier: 'T1-T2',
    monsters: [
      { id: 'm_fieldmouse', name: '田鼠', emoji: '🐀', hp: 30, attack: 10, defense: 0, xpReward: 5, goldReward: 2 },
      { id: 'm_hare', name: '野兔', emoji: '🐰', hp: 45, attack: 14, defense: 1, xpReward: 6, goldReward: 3 },
      { id: 'm_smallsnake', name: '小蛇', emoji: '🐍', hp: 60, attack: 18, defense: 2, xpReward: 8, goldReward: 4 },
      { id: 'm_crow', name: '烏鴉', emoji: '🐦', hp: 75, attack: 22, defense: 3, xpReward: 9, goldReward: 5 },
      { id: 'm_raccoon', name: '浣熊', emoji: '🦝', hp: 90, attack: 26, defense: 4, xpReward: 11, goldReward: 6 },
      { id: 'm_piglet', name: '野豬幼崽', emoji: '🐗', hp: 105, attack: 29, defense: 5, xpReward: 13, goldReward: 8 },
      { id: 'm_scorpion', name: '蠍子', emoji: '🦂', hp: 120, attack: 32, defense: 6, xpReward: 14, goldReward: 9 },
      { id: 'm_wolfpup', name: '狼崽', emoji: '🐺', hp: 140, attack: 35, defense: 7, xpReward: 16, goldReward: 10 },
      { id: 'm_viper', name: '毒蛇', emoji: '🐍', hp: 160, attack: 38, defense: 8, xpReward: 18, goldReward: 12 },
      { id: 'm_boar', name: '成年野豬', emoji: '🐗', hp: 185, attack: 42, defense: 9, xpReward: 20, goldReward: 15 },
    ],
  },
  {
    id: 'forest',
    name: '暗黑森林',
    emoji: '🌲',
    minLevel: 21,
    maxLevel: 40,
    recommendedTier: 'T3-T4',
    monsters: [
      { id: 'm_greywolf', name: '灰狼', emoji: '🐺', hp: 220, attack: 95, defense: 10, xpReward: 25, goldReward: 15 },
      { id: 'm_eagle', name: '大鷹', emoji: '🦅', hp: 300, attack: 105, defense: 14, xpReward: 30, goldReward: 20 },
      { id: 'm_mountainboar', name: '山豬', emoji: '🐗', hp: 390, attack: 115, defense: 18, xpReward: 38, goldReward: 28 },
      { id: 'm_giantspider', name: '巨蛛', emoji: '🕷️', hp: 480, attack: 123, defense: 22, xpReward: 45, goldReward: 35 },
      { id: 'm_owl', name: '夜梟', emoji: '🦉', hp: 570, attack: 130, defense: 26, xpReward: 52, goldReward: 42 },
      { id: 'm_mushroom', name: '毒菇精', emoji: '🍄', hp: 670, attack: 136, defense: 30, xpReward: 58, goldReward: 50 },
      { id: 'm_blackbear', name: '黑熊', emoji: '🐻', hp: 770, attack: 140, defense: 34, xpReward: 65, goldReward: 58 },
      { id: 'm_treant', name: '樹妖', emoji: '🌳', hp: 880, attack: 144, defense: 38, xpReward: 72, goldReward: 66 },
      { id: 'm_sandscorpion', name: '沙地巨蠍', emoji: '🦂', hp: 1000, attack: 146, defense: 42, xpReward: 78, goldReward: 72 },
      { id: 'm_python', name: '森蟒', emoji: '🐍', hp: 1150, attack: 148, defense: 45, xpReward: 80, goldReward: 80 },
    ],
  },
  {
    id: 'ruins',
    name: '古遺跡',
    emoji: '🏚️',
    minLevel: 41,
    maxLevel: 60,
    recommendedTier: 'T5-T6',
    monsters: [
      { id: 'm_skeleton', name: '骷髏兵', emoji: '💀', hp: 1300, attack: 560, defense: 50, xpReward: 80, goldReward: 60 },
      { id: 'm_zombie', name: '殭屍', emoji: '🧟', hp: 1800, attack: 590, defense: 68, xpReward: 100, goldReward: 90 },
      { id: 'm_giantbat', name: '巨蝙蝠', emoji: '🦇', hp: 2300, attack: 620, defense: 86, xpReward: 120, goldReward: 120 },
      { id: 'm_skellarcher', name: '骷髏弓手', emoji: '🏹', hp: 2800, attack: 650, defense: 104, xpReward: 150, goldReward: 160 },
      { id: 'm_ghost', name: '幽靈', emoji: '👻', hp: 3300, attack: 680, defense: 122, xpReward: 180, goldReward: 200 },
      { id: 'm_swampcroc', name: '沼澤鱷', emoji: '🐊', hp: 3900, attack: 705, defense: 140, xpReward: 200, goldReward: 250 },
      { id: 'm_spiderqueen', name: '蛛后', emoji: '🕷️', hp: 4500, attack: 722, defense: 158, xpReward: 220, goldReward: 300 },
      { id: 'm_vampire', name: '吸血鬼', emoji: '🩸', hp: 5000, attack: 732, defense: 176, xpReward: 240, goldReward: 340 },
      { id: 'm_shadowmage', name: '暗影法師', emoji: '🧙', hp: 5500, attack: 738, defense: 194, xpReward: 250, goldReward: 380 },
      { id: 'm_guardian', name: '古遺跡守衛', emoji: '🗿', hp: 6000, attack: 741, defense: 210, xpReward: 250, goldReward: 400 },
    ],
  },
  {
    id: 'dragonlair',
    name: '龍之巢穴',
    emoji: '🐉',
    minLevel: 61,
    maxLevel: 80,
    recommendedTier: 'T7-T8',
    monsters: [
      { id: 'm_younddragon', name: '幼龍', emoji: '🐲', hp: 6500, attack: 2600, defense: 220, xpReward: 250, goldReward: 300 },
      { id: 'm_nightmare', name: '噩夢馬', emoji: '🐎', hp: 9000, attack: 2700, defense: 295, xpReward: 320, goldReward: 450 },
      { id: 'm_rhino', name: '巨犀', emoji: '🦏', hp: 11500, attack: 2800, defense: 370, xpReward: 400, goldReward: 600 },
      { id: 'm_warbull', name: '戰牛', emoji: '🐂', hp: 14000, attack: 2880, defense: 445, xpReward: 480, goldReward: 800 },
      { id: 'm_minotaur', name: '米諾陶', emoji: '🦬', hp: 16500, attack: 2940, defense: 520, xpReward: 550, goldReward: 1000 },
      { id: 'm_seaserpent', name: '海蛇', emoji: '🐍', hp: 19500, attack: 2985, defense: 595, xpReward: 600, goldReward: 1150 },
      { id: 'm_firedragon', name: '火龍', emoji: '🔥', hp: 22500, attack: 3015, defense: 670, xpReward: 650, goldReward: 1300 },
      { id: 'm_icedragon', name: '冰龍', emoji: '❄️', hp: 25500, attack: 3030, defense: 745, xpReward: 680, goldReward: 1400 },
      { id: 'm_winddragon', name: '風龍', emoji: '🌪️', hp: 28000, attack: 3038, defense: 820, xpReward: 690, goldReward: 1450 },
      { id: 'm_dragonlord', name: '龍王', emoji: '🐉', hp: 30000, attack: 3042, defense: 900, xpReward: 700, goldReward: 1500 },
    ],
  },
  {
    id: 'divine',
    name: '神之領域',
    emoji: '⚡',
    minLevel: 81,
    maxLevel: 100,
    recommendedTier: 'T9-T10',
    monsters: [
      { id: 'm_fallenangel', name: '墮天使', emoji: '🦇', hp: 32000, attack: 9600, defense: 1000, xpReward: 700, goldReward: 1500 },
      { id: 'm_demon', name: '惡魔', emoji: '👹', hp: 42000, attack: 9720, defense: 1220, xpReward: 900, goldReward: 2200 },
      { id: 'm_lavagiant', name: '熔岩巨人', emoji: '🗿', hp: 52000, attack: 9820, defense: 1440, xpReward: 1100, goldReward: 3000 },
      { id: 'm_stormgiant', name: '風暴巨人', emoji: '🌪️', hp: 64000, attack: 9900, defense: 1670, xpReward: 1300, goldReward: 3800 },
      { id: 'm_reaper', name: '死神', emoji: '💀', hp: 76000, attack: 9960, defense: 1890, xpReward: 1500, goldReward: 4600 },
      { id: 'm_watcher', name: '觀察者', emoji: '👁️', hp: 90000, attack: 10000, defense: 2110, xpReward: 1650, goldReward: 5400 },
      { id: 'm_ancientdragon', name: '古龍王', emoji: '🐲', hp: 104000, attack: 10020, defense: 2330, xpReward: 1800, goldReward: 6200 },
      { id: 'm_starguardian', name: '星辰守護者', emoji: '🌌', hp: 116000, attack: 10032, defense: 2550, xpReward: 1900, goldReward: 7000 },
      { id: 'm_thunderbeast', name: '雷霆神獸', emoji: '⚡', hp: 124000, attack: 10038, defense: 2780, xpReward: 1950, goldReward: 7600 },
      { id: 'm_demonking', name: '魔神王', emoji: '👑', hp: 130000, attack: 10041, defense: 3000, xpReward: 2000, goldReward: 8000 },
    ],
  },
];

export const REGION_BY_ID: Record<string, HuntRegion> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
);

/** 從地區隨機抽 n 隻怪(可重複)*/
export function sampleMonsters(
  region: HuntRegion,
  n: number,
  rng: () => number = Math.random,
): Monster[] {
  const result: Monster[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * region.monsters.length);
    result.push(region.monsters[idx]!);
  }
  return result;
}
