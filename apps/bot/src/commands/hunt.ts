import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { getCharacter } from '../lib/character.js';
import { getPotionInventory } from '../lib/potions.js';
import { COLORS, makeProgressBar } from '../lib/embeds.js';
import { REGIONS } from '../lib/monsters.js';
import type { CombatResult } from '../lib/combat.js';
import {
  HUNT_ENERGY_COST,
  HUNT_MONSTER_COUNT,
  acceptHunt,
  applyHeal,
  cancelHunt,
  continueHunt,
  createHuntSession,
  declineHunt,
  finalizeHunt,
  getSession,
  startCombat,
  type HuntSession,
} from '../lib/hunt.js';

export const data = new SlashCommandBuilder()
  .setName('hunt')
  .setDescription('🏹 3 人組隊狩獵(每人 5 體力,隨機遇 10 隻怪)')
  .addUserOption((o) => o.setName('partner1').setDescription('隊友 1').setRequired(true))
  .addUserOption((o) => o.setName('partner2').setDescription('隊友 2').setRequired(true))
  .addStringOption((o) =>
    o
      .setName('region')
      .setDescription('狩獵地區')
      .setRequired(true)
      .addChoices(
        { name: '🌾 新手平原 (Lv 1-20)', value: 'plains' },
        { name: '🌲 暗黑森林 (Lv 21-40)', value: 'forest' },
        { name: '🏚️ 古遺跡 (Lv 41-60)', value: 'ruins' },
        { name: '🐉 龍之巢穴 (Lv 61-80)', value: 'dragonlair' },
        { name: '⚡ 神之領域 (Lv 81-100)', value: 'divine' },
      ),
  );

const HUNT_PREFIX = 'hunt:';

// ─── Embed / component builders ────────────────────────────────

function inviteEmbed(session: HuntSession): EmbedBuilder {
  const r = session.region;
  const accepted = session.memberIds.map((id) =>
    session.accepted.has(id) ? `✅ <@${id}>` : `⌛ <@${id}>`,
  );
  return new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('🏹 狩獵邀請')
    .setDescription(
      `**${r.emoji} ${r.name}** (Lv ${r.minLevel}-${r.maxLevel}, 建議裝備 ${r.recommendedTier})\n\n` +
        `⚠️ 每人消耗 **${HUNT_ENERGY_COST} 體力**,隨機遭遇 ${HUNT_MONSTER_COUNT} 隻怪物。\n` +
        `兩位隊友都按「接受」就開打。\n\n` +
        accepted.join('\n'),
    );
}

function inviteComponents(sid: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${HUNT_PREFIX}accept:${sid}`).setLabel('接受').setEmoji('✨').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${HUNT_PREFIX}decline:${sid}`).setLabel('拒絕').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** 把一場戰鬥壓縮成一行 round 描述 */
function formatRounds(combat: CombatResult): string {
  const rounds = combat.rounds;
  const fmt = (r: CombatResult['rounds'][number]) =>
    `隊-${r.playerDamage.toLocaleString()}${r.monsterDamage > 0 ? `/怪-${r.monsterDamage.toLocaleString()}` : '💀'}`;
  if (rounds.length === 0) return '(秒殺)';
  if (rounds.length <= 4) {
    return rounds.map((r, i) => `R${i + 1} ${fmt(r)}`).join(' | ');
  }
  const first = rounds[0]!;
  const last = rounds[rounds.length - 1]!;
  return `R1 ${fmt(first)} | …${rounds.length - 2} 回合… | R${rounds.length} ${fmt(last)}`;
}

function combatEmbed(session: HuntSession): EmbedBuilder {
  const r = session.region;
  const hpPct = Math.floor((session.partyHp / session.partyMaxHp) * 100);
  const hpBar = makeProgressBar(hpPct, 12);

  // 全部 encounter 摘要(一行一隻)
  const summary = session.encounters
    .map((e, i) => {
      const rounds = e.combat.rounds.length || 1;
      return e.killed
        ? `[${i + 1}] ${e.monster.emoji} ${e.monster.name} ✅ ${rounds} 回合`
        : `[${i + 1}] ${e.monster.emoji} ${e.monster.name} ☠️ 戰敗`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(session.status === 'defeated' ? COLORS.RED : COLORS.GREEN)
    .setTitle(`🏹 ${r.emoji} ${r.name} 狩獵中 (${session.currentIndex}/${HUNT_MONSTER_COUNT})`)
    .setDescription(
      `⚔️ ATK ${session.partyAttack.toLocaleString()} · 🛡️ DEF ${session.partyDefense.toLocaleString()}\n` +
        `❤️ ${hpBar} ${session.partyHp.toLocaleString()}/${session.partyMaxHp.toLocaleString()}`,
    );

  // 剛打的那隻的回合明細
  const last = session.encounters[session.encounters.length - 1];
  if (last) {
    embed.addFields({
      name: `${last.killed ? '🗡️ 剛擊殺' : '☠️ 被擊倒於'}:${last.monster.emoji} ${last.monster.name}`,
      value: formatRounds(last.combat),
      inline: false,
    });
  }

  if (summary) {
    embed.addFields({ name: '📜 戰況', value: summary.slice(0, 1024), inline: false });
  }

  // 下一隻預告
  if (session.status === 'in_progress' && session.currentIndex < session.monsters.length) {
    const next = session.monsters[session.currentIndex]!;
    embed.addFields({
      name: '🎯 下一隻',
      value: `${next.emoji} **${next.name}** — HP ${next.hp.toLocaleString()} · ATK ${next.attack.toLocaleString()} · DEF ${next.defense.toLocaleString()}`,
      inline: false,
    });
  }

  return embed;
}

function combatComponents(sid: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${HUNT_PREFIX}continue:${sid}`).setLabel('繼續').setEmoji('▶️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${HUNT_PREFIX}heal:${sid}`).setLabel('喝藥水').setEmoji('💊').setStyle(ButtonStyle.Success),
    ),
  ];
}

function rewardEmbed(session: HuntSession, reward: NonNullable<Awaited<ReturnType<typeof finalizeHunt>>>): EmbedBuilder {
  const r = session.region;
  const win = session.status === 'completed';

  // 統計擊殺種類
  const killCount = new Map<string, { emoji: string; name: string; n: number }>();
  for (const e of session.encounters) {
    if (!e.killed) continue;
    const key = e.monster.id;
    const cur = killCount.get(key);
    if (cur) cur.n += 1;
    else killCount.set(key, { emoji: e.monster.emoji, name: e.monster.name, n: 1 });
  }
  const killLine =
    [...killCount.values()].map((k) => `${k.emoji}${k.name}×${k.n}`).join(' · ') || '無';

  const embed = new EmbedBuilder()
    .setColor(win ? COLORS.GOLD : COLORS.RED)
    .setTitle(win ? `🏆 ${r.emoji} ${r.name} 狩獵完成!` : `☠️ ${r.emoji} ${r.name} 全軍覆沒`)
    .setDescription(
      `擊殺 **${reward.killedCount}/${HUNT_MONSTER_COUNT}**\n${killLine}`,
    )
    .addFields(
      {
        name: '🎁 戰利品(每人均分)',
        value: `+${reward.xpEach.toLocaleString()} XP(主等級)\n+${reward.goldEach.toLocaleString()}💰`,
        inline: false,
      },
    );

  if (reward.levelUps.length > 0) {
    embed.addFields({
      name: '🎊 升級!',
      value: reward.levelUps.map((l) => `<@${l.userId}> → Lv ${l.newLevel}`).join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: '各自體力恢復後可再次組隊' });
  return embed;
}

// ─── Command handlers ──────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '⚠️ 請在伺服器中使用', flags: MessageFlags.Ephemeral });
    return;
  }

  const p1 = interaction.options.getUser('partner1', true);
  const p2 = interaction.options.getUser('partner2', true);
  const regionId = interaction.options.getString('region', true);

  if (p1.bot || p2.bot) {
    await interaction.reply({ content: '🤖 不能找 bot 組隊', flags: MessageFlags.Ephemeral });
    return;
  }

  const leaderChar = await getCharacter(interaction.user.id);
  if (!leaderChar) {
    await interaction.reply({ content: '你還沒建立角色!用 `/start`', flags: MessageFlags.Ephemeral });
    return;
  }

  const created = createHuntSession({
    leaderId: interaction.user.id,
    partnerIds: [p1.id, p2.id],
    regionId,
  });
  if (!created.ok) {
    await interaction.reply({ content: `⚠️ ${created.reason}`, flags: MessageFlags.Ephemeral });
    return;
  }

  const session = created.session;
  await interaction.reply({
    content: `<@${p1.id}> <@${p2.id}>`,
    embeds: [inviteEmbed(session)],
    components: inviteComponents(session.id),
    allowedMentions: { users: [p1.id, p2.id] },
  });
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(HUNT_PREFIX)) return false;

  const rest = interaction.customId.slice(HUNT_PREFIX.length);
  const [action, sid] = rest.split(':');
  if (!sid) return false;
  const userId = interaction.user.id;

  // ── 接受 ──
  if (action === 'accept') {
    const result = acceptHunt(sid, userId);
    if (!result.ok) {
      await interaction.reply({ content: `⚠️ ${result.reason}`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!result.allAccepted) {
      await interaction.update({ embeds: [inviteEmbed(result.session)], components: inviteComponents(sid) });
      return true;
    }
    // 全員接受 → 開戰
    const combat = await startCombat(sid);
    if (!combat.ok) {
      cancelHunt(sid);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(COLORS.RED).setTitle('🏹 狩獵取消').setDescription(`⚠️ ${combat.reason}`)],
        components: [],
      });
      return true;
    }
    await showAfterFight(interaction, combat.session, sid);
    return true;
  }

  // ── 拒絕 ──
  if (action === 'decline') {
    const result = declineHunt(sid, userId);
    if (!result.ok) {
      await interaction.reply({ content: `⚠️ ${result.reason}`, flags: MessageFlags.Ephemeral });
      return true;
    }
    cancelHunt(sid);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(COLORS.RED).setTitle('🏹 狩獵取消').setDescription(`<@${userId}> 拒絕了邀請。`)],
      components: [],
    });
    return true;
  }

  // 以下 action 需要是隊員
  const session = getSession(sid);
  if (!session) {
    await interaction.reply({ content: '⚠️ 找不到此狩獵(可能已過期)', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (!session.memberIds.includes(userId)) {
    await interaction.reply({ content: '⚠️ 你不在這個隊伍裡', flags: MessageFlags.Ephemeral });
    return true;
  }

  // ── 繼續 ──
  if (action === 'continue') {
    const result = continueHunt(sid);
    if (!result.ok) {
      await interaction.reply({ content: `⚠️ ${result.reason}`, flags: MessageFlags.Ephemeral });
      return true;
    }
    await showAfterFight(interaction, result.session, sid);
    return true;
  }

  // ── 喝藥水(打開選單)──
  if (action === 'heal') {
    const potions = await getPotionInventory(userId);
    if (potions.length === 0) {
      await interaction.reply({ content: '💊 你沒有任何藥水(去 `/brew` 合成)', flags: MessageFlags.Ephemeral });
      return true;
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${HUNT_PREFIX}healpick:${sid}:${userId}`)
      .setPlaceholder('💊 選擇藥水(用你自己的)');
    for (const p of potions) {
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${p.recipe.name}(回 ${p.recipe.healPercent}%)`.slice(0, 100))
          .setValue(p.recipe.itemId)
          .setEmoji('🧪')
          .setDescription(`持有 ${p.quantity} 瓶`.slice(0, 100)),
      );
    }
    await interaction.update({
      embeds: [combatEmbed(session)],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${HUNT_PREFIX}healcancel:${sid}`).setLabel('取消').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return true;
  }

  // ── 取消補血 ──
  if (action === 'healcancel') {
    await interaction.update({ embeds: [combatEmbed(session)], components: combatComponents(sid) });
    return true;
  }

  return false;
}

export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(`${HUNT_PREFIX}healpick:`)) return false;

  const parts = interaction.customId.split(':'); // hunt healpick sid clickerId
  const sid = parts[2];
  const clickerId = parts[3];
  if (!sid || !clickerId) return false;

  if (interaction.user.id !== clickerId) {
    await interaction.reply({ content: '⚠️ 這是別人開的藥水選單', flags: MessageFlags.Ephemeral });
    return true;
  }

  const potionId = interaction.values[0];
  if (!potionId) {
    await interaction.deferUpdate();
    return true;
  }

  const result = await applyHeal(sid, clickerId, potionId);
  const session = getSession(sid);
  if (!result.ok || !session) {
    await interaction.reply({ content: `⚠️ ${result.ok ? '找不到狩獵' : result.reason}`, flags: MessageFlags.Ephemeral });
    return true;
  }

  const embed = combatEmbed(session);
  embed.addFields({
    name: '💊 補血',
    value: `<@${clickerId}> 使用 **${result.potionName}** → 隊伍 HP +${result.healed.toLocaleString()}`,
    inline: false,
  });
  await interaction.update({ embeds: [embed], components: combatComponents(sid) });
  return true;
}

/** 打完一隻後:還在打就顯示戰況+按鈕;結束就結算+顯示獎勵 */
async function showAfterFight(
  interaction: ButtonInteraction,
  session: HuntSession,
  sid: string,
) {
  if (session.status === 'in_progress') {
    await interaction.update({ embeds: [combatEmbed(session)], components: combatComponents(sid) });
    return;
  }
  // completed 或 defeated → 結算
  const reward = await finalizeHunt(sid);
  if (!reward) {
    await interaction.update({ embeds: [combatEmbed(session)], components: [] });
    return;
  }
  await interaction.update({ embeds: [rewardEmbed(session, reward)], components: [] });
}
