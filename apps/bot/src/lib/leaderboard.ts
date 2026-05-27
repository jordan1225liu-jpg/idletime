import { prisma } from '@idletime/db';

export type LbCategory = 'level' | 'gold' | 'farming' | 'fishing';
export type LbScope = 'global' | 'server';

export interface LbEntry {
  rank: number;
  userId: string;
  name: string;
  value: number;
}

export interface LbResult {
  entries: LbEntry[];
  requesterRank: number | null;
  requesterValue: number | null;
  totalPlayers: number;
}

/** scope=global → null(不過濾);scope=server → 該 guild 成員的 userId 陣列 */
async function scopeUserIds(scope: LbScope, guildId?: string): Promise<string[] | null> {
  if (scope === 'global') return null;
  if (!guildId) return [];
  const members = await prisma.guildMembership.findMany({
    where: { guildId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

export async function getLeaderboard(params: {
  category: LbCategory;
  scope: LbScope;
  guildId?: string;
  requesterId: string;
  limit?: number;
}): Promise<LbResult> {
  const limit = params.limit ?? 10;
  const userIds = await scopeUserIds(params.scope, params.guildId);
  const inScope = userIds === null || userIds.includes(params.requesterId);

  if (params.category === 'level' || params.category === 'gold') {
    return characterLeaderboard(params.category, userIds, params.requesterId, inScope, limit);
  }
  const skillId = params.category; // 'farming' | 'fishing'
  return skillLeaderboard(skillId, userIds, params.requesterId, inScope, limit);
}

async function characterLeaderboard(
  category: 'level' | 'gold',
  userIds: string[] | null,
  requesterId: string,
  inScope: boolean,
  limit: number,
): Promise<LbResult> {
  const baseWhere = userIds ? { userId: { in: userIds } } : {};

  const top = await prisma.character.findMany({
    where: baseWhere,
    orderBy:
      category === 'level'
        ? [{ level: 'desc' }, { exp: 'desc' }]
        : [{ gold: 'desc' }],
    take: limit,
  });

  const entries: LbEntry[] = top.map((c, i) => ({
    rank: i + 1,
    userId: c.userId,
    name: c.name,
    value: category === 'level' ? c.level : c.gold,
  }));

  const totalPlayers = await prisma.character.count({ where: baseWhere });

  let requesterRank: number | null = null;
  let requesterValue: number | null = null;
  if (inScope) {
    const me = await prisma.character.findUnique({ where: { userId: requesterId } });
    if (me) {
      if (category === 'level') {
        const higher = await prisma.character.count({
          where: {
            ...baseWhere,
            OR: [{ level: { gt: me.level } }, { level: me.level, exp: { gt: me.exp } }],
          },
        });
        requesterRank = higher + 1;
        requesterValue = me.level;
      } else {
        const higher = await prisma.character.count({
          where: { ...baseWhere, gold: { gt: me.gold } },
        });
        requesterRank = higher + 1;
        requesterValue = me.gold;
      }
    }
  }

  return { entries, requesterRank, requesterValue, totalPlayers };
}

async function skillLeaderboard(
  skillId: string,
  userIds: string[] | null,
  requesterId: string,
  inScope: boolean,
  limit: number,
): Promise<LbResult> {
  const baseWhere = userIds ? { skillId, userId: { in: userIds } } : { skillId };

  const top = await prisma.playerSkill.findMany({
    where: baseWhere,
    orderBy: [{ level: 'desc' }, { exp: 'desc' }],
    take: limit,
    include: { user: { include: { character: true } } },
  });

  const entries: LbEntry[] = top.map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    name: s.user.character?.name ?? s.user.discordUsername,
    value: s.level,
  }));

  const totalPlayers = await prisma.playerSkill.count({ where: baseWhere });

  let requesterRank: number | null = null;
  let requesterValue: number | null = null;
  if (inScope) {
    const me = await prisma.playerSkill.findUnique({
      where: { userId_skillId: { userId: requesterId, skillId } },
    });
    if (me) {
      const higher = await prisma.playerSkill.count({
        where: {
          ...baseWhere,
          OR: [{ level: { gt: me.level } }, { level: me.level, exp: { gt: me.exp } }],
        },
      });
      requesterRank = higher + 1;
      requesterValue = me.level;
    }
  }

  return { entries, requesterRank, requesterValue, totalPlayers };
}
