/**
 * 等級曲線。對數型(實際是 power 1.5),確保長期玩家跟新玩家差距是 log 而非 linear。
 *
 * 設計目標:
 * - Lv 1 → 2:約 100 XP(新手 1-2 分鐘)
 * - Lv 10:累積約 3,000 XP(1-2 小時)
 * - Lv 30:累積約 50,000 XP(1-2 週)
 * - Lv 50:累積約 200,000 XP(1-3 個月)
 * - Lv 100:累積約 1,000,000 XP(6 個月 ~ 2 年)
 */

/** 從 level → level+1 所需的 XP */
export function expForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** 從 1 級累積到目標等級總共所需 XP(目前未用,留著之後做進度條/比較) */
export function totalExpToLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += expForNextLevel(i);
  }
  return total;
}

/** 給定目前 (level, exp),回傳進度百分比 (0-100) */
export function levelProgress(level: number, exp: number): number {
  const needed = expForNextLevel(level);
  if (needed === 0) return 100;
  return Math.min(100, Math.floor((exp / needed) * 100));
}

/**
 * 給定累積總 XP,回傳對應的 level 與該等級內已累積的 XP。
 * 用於「加 XP」邏輯:玩家收成 +5 XP,我們把 5 加到累積總量,再算出當前 level + 該等級剩餘 XP。
 */
export function levelFromTotalExp(totalExp: number): { level: number; expInLevel: number } {
  let level = 1;
  let remaining = totalExp;
  while (remaining >= expForNextLevel(level) && level < 100) {
    remaining -= expForNextLevel(level);
    level += 1;
  }
  return { level, expInLevel: remaining };
}
