/**
 * 釣魚資料 + 隨機抽選邏輯。純函式,可測試。
 *
 * 設計(GDD §5.x 釣魚補充):
 * - 30 種「漁獲」分 7 個 tier(雜物/小/中/大/海洋珍寶/傳說/神話)
 * - 每個 tier 有 weightAtLv1 → weightAtLv100,線性內插
 * - Tier 內每種等機率(例如 Lv 1 大型魚 tier = 8%,5 種魚各 1.6%)
 * - 抽到的東西「不進背包」—— XP/金幣直接加到 character/skill,結束
 */

export interface Fish {
  id: string;
  name: string;
  emoji: string;
}

export interface FishTier {
  id: string;
  name: string;
  /** Lv 1 時這個 tier 的權重(總和 = 100)*/
  weightAtLv1: number;
  /** Lv 100 時這個 tier 的權重(總和 = 100)*/
  weightAtLv100: number;
  /** 抽到此 tier 任一魚的 XP 獎勵 */
  xpReward: number;
  /** 抽到此 tier 任一魚的金幣獎勵 */
  goldReward: number;
  fish: Fish[];
}

export const FISH_TIERS: FishTier[] = [
  {
    id: 'junk',
    name: '雜物',
    weightAtLv1: 30,
    weightAtLv100: 2,
    xpReward: 0,
    goldReward: 0,
    fish: [
      { id: 'fish_old_boot', name: '老靴子', emoji: '🥾' },
      { id: 'fish_seaweed', name: '雜草', emoji: '🌿' },
      { id: 'fish_empty_hook', name: '空釣鉤', emoji: '🪝' },
      { id: 'fish_broken_bottle', name: '破瓶子', emoji: '🧪' },
    ],
  },
  {
    id: 'common',
    name: '小魚',
    weightAtLv1: 40,
    weightAtLv100: 8,
    xpReward: 2,
    goldReward: 2,
    fish: [
      { id: 'fish_crucian', name: '鯽魚', emoji: '🐟' },
      { id: 'fish_river_shrimp', name: '河蝦', emoji: '🦐' },
      { id: 'fish_small_carp', name: '小鯉', emoji: '🐠' },
      { id: 'fish_clam', name: '蛤蜊', emoji: '🐚' },
      { id: 'fish_goby', name: '蝦虎魚', emoji: '🐟' },
    ],
  },
  {
    id: 'uncommon',
    name: '中型魚',
    weightAtLv1: 20,
    weightAtLv100: 15,
    xpReward: 6,
    goldReward: 10,
    fish: [
      { id: 'fish_carp', name: '鯉魚', emoji: '🎏' },
      { id: 'fish_trout', name: '鱒魚', emoji: '🐟' },
      { id: 'fish_catfish', name: '鯰魚', emoji: '🐟' },
      { id: 'fish_eel', name: '鰻魚', emoji: '🐍' },
      { id: 'fish_squid', name: '烏賊', emoji: '🦑' },
    ],
  },
  {
    id: 'rare',
    name: '大型魚',
    weightAtLv1: 8,
    weightAtLv100: 25,
    xpReward: 20,
    goldReward: 50,
    fish: [
      { id: 'fish_salmon', name: '鮭魚', emoji: '🍣' },
      { id: 'fish_snapper', name: '鯛魚', emoji: '🐟' },
      { id: 'fish_flounder', name: '比目魚', emoji: '🐟' },
      { id: 'fish_octopus', name: '章魚', emoji: '🐙' },
      { id: 'fish_pufferfish', name: '河豚', emoji: '🐡' },
    ],
  },
  {
    id: 'very_rare',
    name: '海洋珍寶',
    weightAtLv1: 1.5,
    weightAtLv100: 25,
    xpReward: 60,
    goldReward: 200,
    fish: [
      { id: 'fish_swordfish', name: '旗魚', emoji: '🗡️' },
      { id: 'fish_shark', name: '鯊魚', emoji: '🦈' },
      { id: 'fish_lobster', name: '龍蝦', emoji: '🦞' },
      { id: 'fish_crab', name: '螃蟹', emoji: '🦀' },
    ],
  },
  {
    id: 'epic',
    name: '傳說生物',
    weightAtLv1: 0.49,
    weightAtLv100: 20,
    xpReward: 150,
    goldReward: 800,
    fish: [
      { id: 'fish_golden_koi', name: '金色錦鯉', emoji: '🪙' },
      { id: 'fish_sea_beast', name: '深海巨獸', emoji: '🐉' },
      { id: 'fish_ancient_fish', name: '古代魚', emoji: '🦴' },
      { id: 'fish_ghost_fish', name: '鬼魚', emoji: '👻' },
    ],
  },
  {
    id: 'mythical',
    name: '神話',
    weightAtLv1: 0.01,
    weightAtLv100: 5,
    xpReward: 500,
    goldReward: 3000,
    fish: [
      { id: 'fish_mermaid', name: '人魚', emoji: '🧜' },
      { id: 'fish_dragon_king', name: '龍王', emoji: '🐲' },
      { id: 'fish_meteor', name: '流星魚', emoji: '🌟' },
    ],
  },
];

/** 1-minute fishing cooldown */
export const FISHING_COOLDOWN_MS = 60 * 1000;

/** 給定當前釣魚等級,回傳每個 tier 的內插權重(線性 Lv 1 → Lv 100)。 */
export function tierWeightsAtLevel(level: number): number[] {
  const clamped = Math.max(1, Math.min(100, level));
  const t = (clamped - 1) / 99;
  return FISH_TIERS.map((tier) => tier.weightAtLv1 + (tier.weightAtLv100 - tier.weightAtLv1) * t);
}

export interface CatchResult {
  tier: FishTier;
  fish: Fish;
}

/**
 * 抽一次魚。注入 rng 讓測試可決定性。
 * 第一次 rng() 決定 tier,第二次 rng() 決定 tier 內的哪一隻魚。
 */
export function rollFish(level: number, rng: () => number = Math.random): CatchResult {
  const weights = tierWeightsAtLevel(level);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < FISH_TIERS.length; i++) {
    r -= weights[i]!;
    if (r <= 0) {
      const tier = FISH_TIERS[i]!;
      const fish = tier.fish[Math.floor(rng() * tier.fish.length)]!;
      return { tier, fish };
    }
  }
  // 極端浮點誤差兜底
  const last = FISH_TIERS[FISH_TIERS.length - 1]!;
  return { tier: last, fish: last.fish[0]! };
}
