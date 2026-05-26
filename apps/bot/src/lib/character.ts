import { prisma, type Character, type Guild } from '@idletime/db';

/**
 * 8 個生活技能 ID,跟 GDD §5.1 一致。
 * 新角色建立時會自動建 8 筆 PlayerSkill 記錄,各 Lv 1。
 */
export const LIFE_SKILLS = [
  'farming',
  'fishing',
  'gathering',
  'cooking',
  'smithing',
  'tailoring',
  'brewing',
  'shopkeep',
] as const;

export type LifeSkillId = (typeof LIFE_SKILLS)[number];

/** Character + 預先載好的 activeGuild,給 embed 用 */
export type CharacterWithGuild = Character & {
  activeGuild: Guild | null;
};

/**
 * 建立新角色(transactional)。
 * 步驟:upsert Guild → 建 User → 建 Character → 建 GuildMembership → 建 Farm → 建 8 個 PlayerSkill
 */
export async function createCharacter(params: {
  userId: string;
  discordUsername: string;
  characterName: string;
  guildId: string;
  guildName: string;
}): Promise<CharacterWithGuild> {
  return prisma.$transaction(async (tx) => {
    // 1. Upsert Guild (Discord 伺服器)
    const guild = await tx.guild.upsert({
      where: { id: params.guildId },
      create: { id: params.guildId, name: params.guildName },
      update: { name: params.guildName },
    });

    // 2. 建 User
    await tx.user.create({
      data: {
        id: params.userId,
        discordUsername: params.discordUsername,
      },
    });

    // 3. 建 Character (1-1 with User)
    const character = await tx.character.create({
      data: {
        userId: params.userId,
        name: params.characterName,
        activeGuildId: params.guildId,
      },
    });

    // 4. 公會成員資格
    await tx.guildMembership.create({
      data: {
        userId: params.userId,
        guildId: params.guildId,
      },
    });

    // 5. 農場(初始 5 個田,plot 紀錄延後到玩家第一次種田時建立)
    await tx.farm.create({
      data: { userId: params.userId },
    });

    // 6. 8 個生活技能,全部從 Lv 1 開始
    await tx.playerSkill.createMany({
      data: LIFE_SKILLS.map((skillId) => ({
        userId: params.userId,
        skillId,
      })),
    });

    return { ...character, activeGuild: guild };
  });
}

/** 拿角色資料 + 當前所在的公會(可能為 null) */
export async function getCharacter(userId: string): Promise<CharacterWithGuild | null> {
  return prisma.character.findUnique({
    where: { userId },
    include: { activeGuild: true },
  });
}

/**
 * 確保玩家在當前 Discord 伺服器有 GuildMembership,並更新 activeGuildId。
 * 用於每次 slash command 觸發時刷新「上下文公會」。
 */
export async function ensureGuildContext(params: {
  userId: string;
  guildId: string;
  guildName: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.guild.upsert({
      where: { id: params.guildId },
      create: { id: params.guildId, name: params.guildName },
      update: { name: params.guildName },
    });

    await tx.guildMembership.upsert({
      where: {
        userId_guildId: {
          userId: params.userId,
          guildId: params.guildId,
        },
      },
      create: { userId: params.userId, guildId: params.guildId },
      update: {}, // already exists, no-op
    });

    await tx.character.update({
      where: { userId: params.userId },
      data: { activeGuildId: params.guildId },
    });
  });
}
