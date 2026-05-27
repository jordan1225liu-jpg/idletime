/**
 * 5 個 hunt 地區 × 10 隻怪 = 50 隻。
 * 數值依地區等級設計,對應建議裝備 tier,確保沒對應裝備打不動(杜絕越級)。
 * 3 人組隊,party ATK = 三人總和;party DEF = 三人平均。
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
      { id: 'm_fieldmouse', name: '田鼠', emoji: '🐀', hp: 30, attack: 5, defense: 0, xpReward: 5, goldReward: 2 },
      { id: 'm_hare', name: '野兔', emoji: '🐰', hp: 40, attack: 6, defense: 1, xpReward: 6, goldReward: 3 },
      { id: 'm_smallsnake', name: '小蛇', emoji: '🐍', hp: 50, attack: 8, defense: 2, xpReward: 8, goldReward: 4 },
      { id: 'm_crow', name: '烏鴉', emoji: '🐦', hp: 55, attack: 10, defense: 2, xpReward: 9, goldReward: 5 },
      { id: 'm_raccoon', name: '浣熊', emoji: '🦝', hp: 65, attack: 12, defense: 3, xpReward: 11, goldReward: 6 },
      { id: 'm_piglet', name: '野豬幼崽', emoji: '🐗', hp: 75, attack: 14, defense: 4, xpReward: 13, goldReward: 8 },
      { id: 'm_scorpion', name: '蠍子', emoji: '🦂', hp: 80, attack: 16, defense: 5, xpReward: 14, goldReward: 9 },
      { id: 'm_wolfpup', name: '狼崽', emoji: '🐺', hp: 90, attack: 18, defense: 6, xpReward: 16, goldReward: 10 },
      { id: 'm_viper', name: '毒蛇', emoji: '🐍', hp: 100, attack: 21, defense: 8, xpReward: 18, goldReward: 12 },
      { id: 'm_boar', name: '成年野豬', emoji: '🐗', hp: 120, attack: 25, defense: 10, xpReward: 20, goldReward: 15 },
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
      { id: 'm_greywolf', name: '灰狼', emoji: '🐺', hp: 200, attack: 30, defense: 20, xpReward: 25, goldReward: 15 },
      { id: 'm_eagle', name: '大鷹', emoji: '🦅', hp: 250, attack: 35, defense: 22, xpReward: 30, goldReward: 20 },
      { id: 'm_mountainboar', name: '山豬', emoji: '🐗', hp: 320, attack: 40, defense: 28, xpReward: 38, goldReward: 28 },
      { id: 'm_giantspider', name: '巨蛛', emoji: '🕷️', hp: 400, attack: 48, defense: 32, xpReward: 45, goldReward: 35 },
      { id: 'm_owl', name: '夜梟', emoji: '🦉', hp: 450, attack: 52, defense: 38, xpReward: 52, goldReward: 42 },
      { id: 'm_mushroom', name: '毒菇精', emoji: '🍄', hp: 520, attack: 58, defense: 42, xpReward: 58, goldReward: 50 },
      { id: 'm_blackbear', name: '黑熊', emoji: '🐻', hp: 600, attack: 65, defense: 48, xpReward: 65, goldReward: 58 },
      { id: 'm_treant', name: '樹妖', emoji: '🌳', hp: 680, attack: 70, defense: 52, xpReward: 72, goldReward: 66 },
      { id: 'm_sandscorpion', name: '沙地巨蠍', emoji: '🦂', hp: 750, attack: 76, defense: 56, xpReward: 78, goldReward: 72 },
      { id: 'm_python', name: '森蟒', emoji: '🐍', hp: 800, attack: 80, defense: 60, xpReward: 80, goldReward: 80 },
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
      { id: 'm_skeleton', name: '骷髏兵', emoji: '💀', hp: 1500, attack: 150, defense: 100, xpReward: 80, goldReward: 60 },
      { id: 'm_zombie', name: '殭屍', emoji: '🧟', hp: 1900, attack: 175, defense: 120, xpReward: 100, goldReward: 90 },
      { id: 'm_giantbat', name: '巨蝙蝠', emoji: '🦇', hp: 2300, attack: 200, defense: 140, xpReward: 120, goldReward: 120 },
      { id: 'm_skellarcher', name: '骷髏弓手', emoji: '🏹', hp: 2700, attack: 240, defense: 160, xpReward: 150, goldReward: 160 },
      { id: 'm_ghost', name: '幽靈', emoji: '👻', hp: 3100, attack: 270, defense: 180, xpReward: 180, goldReward: 200 },
      { id: 'm_swampcroc', name: '沼澤鱷', emoji: '🐊', hp: 3500, attack: 300, defense: 200, xpReward: 200, goldReward: 250 },
      { id: 'm_spiderqueen', name: '蛛后', emoji: '🕷️', hp: 3900, attack: 330, defense: 220, xpReward: 220, goldReward: 300 },
      { id: 'm_vampire', name: '吸血鬼', emoji: '🩸', hp: 4300, attack: 360, defense: 250, xpReward: 240, goldReward: 340 },
      { id: 'm_shadowmage', name: '暗影法師', emoji: '🧙', hp: 4700, attack: 390, defense: 280, xpReward: 250, goldReward: 380 },
      { id: 'm_guardian', name: '古遺跡守衛', emoji: '🗿', hp: 5000, attack: 400, defense: 300, xpReward: 250, goldReward: 400 },
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
      { id: 'm_younddragon', name: '幼龍', emoji: '🐲', hp: 10000, attack: 700, defense: 400, xpReward: 250, goldReward: 300 },
      { id: 'm_nightmare', name: '噩夢馬', emoji: '🐎', hp: 14000, attack: 850, defense: 480, xpReward: 320, goldReward: 450 },
      { id: 'm_rhino', name: '巨犀', emoji: '🦏', hp: 18000, attack: 1000, defense: 560, xpReward: 400, goldReward: 600 },
      { id: 'm_warbull', name: '戰牛', emoji: '🐂', hp: 22000, attack: 1150, defense: 640, xpReward: 480, goldReward: 800 },
      { id: 'm_minotaur', name: '米諾陶', emoji: '🦬', hp: 26000, attack: 1300, defense: 720, xpReward: 550, goldReward: 1000 },
      { id: 'm_seaserpent', name: '海蛇', emoji: '🐍', hp: 30000, attack: 1450, defense: 800, xpReward: 600, goldReward: 1150 },
      { id: 'm_firedragon', name: '火龍', emoji: '🔥', hp: 34000, attack: 1600, defense: 900, xpReward: 650, goldReward: 1300 },
      { id: 'm_icedragon', name: '冰龍', emoji: '❄️', hp: 37000, attack: 1750, defense: 1000, xpReward: 680, goldReward: 1400 },
      { id: 'm_winddragon', name: '風龍', emoji: '🌪️', hp: 39000, attack: 1900, defense: 1100, xpReward: 690, goldReward: 1450 },
      { id: 'm_dragonlord', name: '龍王', emoji: '🐉', hp: 40000, attack: 2000, defense: 1200, xpReward: 700, goldReward: 1500 },
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
      { id: 'm_fallenangel', name: '墮天使', emoji: '🦇', hp: 80000, attack: 2500, defense: 1500, xpReward: 700, goldReward: 1500 },
      { id: 'm_demon', name: '惡魔', emoji: '👹', hp: 110000, attack: 3000, defense: 1900, xpReward: 900, goldReward: 2200 },
      { id: 'm_lavagiant', name: '熔岩巨人', emoji: '🗿', hp: 140000, attack: 3500, defense: 2300, xpReward: 1100, goldReward: 3000 },
      { id: 'm_stormgiant', name: '風暴巨人', emoji: '🌪️', hp: 170000, attack: 4000, defense: 2700, xpReward: 1300, goldReward: 3800 },
      { id: 'm_reaper', name: '死神', emoji: '💀', hp: 200000, attack: 4500, defense: 3100, xpReward: 1500, goldReward: 4600 },
      { id: 'm_watcher', name: '觀察者', emoji: '👁️', hp: 230000, attack: 5000, defense: 3500, xpReward: 1650, goldReward: 5400 },
      { id: 'm_ancientdragon', name: '古龍王', emoji: '🐲', hp: 260000, attack: 5500, defense: 3900, xpReward: 1800, goldReward: 6200 },
      { id: 'm_starguardian', name: '星辰守護者', emoji: '🌌', hp: 280000, attack: 6000, defense: 4300, xpReward: 1900, goldReward: 7000 },
      { id: 'm_thunderbeast', name: '雷霆神獸', emoji: '⚡', hp: 290000, attack: 6500, defense: 4700, xpReward: 1950, goldReward: 7600 },
      { id: 'm_demonking', name: '魔神王', emoji: '👑', hp: 300000, attack: 7000, defense: 5000, xpReward: 2000, goldReward: 8000 },
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
