import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { prisma } from '@idletime/db';
import {
  initiateVisit,
  acceptVisit,
  declineVisit,
  getExpectedAccepter,
  VISIT_ENERGY_GAIN,
} from '../lib/visit.js';
import { getCharacter } from '../lib/character.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('visit')
  .setDescription('🤝 拜訪好友,接受後雙方各得 +20⚡ 體力(同一位玩家每天 1 次)')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('要拜訪的玩家').setRequired(true),
  );

const VISIT_PREFIX = 'visit:';
const BTN_ACCEPT_PREFIX = 'visit:accept:';
const BTN_DECLINE_PREFIX = 'visit:decline:';

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: '⚠️ 請在 Discord 伺服器中使用此指令(不能在 DM)。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = interaction.options.getUser('user', true);

  if (target.bot) {
    await interaction.reply({
      content: '🤖 不能拜訪 bot 啦',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 確認 visitor 有角色
  const visitorChar = await getCharacter(interaction.user.id);
  if (!visitorChar) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 確認 target 在這個伺服器
  const member =
    interaction.guild.members.cache.get(target.id) ??
    (await interaction.guild.members.fetch(target.id).catch(() => null));
  if (!member) {
    await interaction.reply({
      content: `⚠️ <@${target.id}> 不在這個伺服器,沒辦法拜訪。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = await initiateVisit(interaction.user.id, target.id);
  if (!result.ok) {
    await interaction.reply({
      content: `⚠️ ${result.reason}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('🌿 拜訪邀請')
    .setDescription(
      `<@${interaction.user.id}> 想要拜訪 <@${target.id}>!\n\n` +
        `✨ 接受後雙方各得 **+${VISIT_ENERGY_GAIN}⚡ 體力**\n` +
        `⏳ 邀請 30 分鐘內有效 · 同一位玩家每天只能拜訪 1 次(其他玩家不限)`,
    );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BTN_ACCEPT_PREFIX}${result.visitId}`)
      .setLabel('接受拜訪')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${BTN_DECLINE_PREFIX}${result.visitId}`)
      .setLabel('婉拒')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
  );

  // ping target 讓他收到通知
  await interaction.reply({
    content: `<@${target.id}>`,
    embeds: [embed],
    components: [buttons],
    allowedMentions: { users: [target.id] },
  });
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(VISIT_PREFIX)) return false;

  // ─── 接受 ───
  if (interaction.customId.startsWith(BTN_ACCEPT_PREFIX)) {
    const visitId = parseInt(interaction.customId.slice(BTN_ACCEPT_PREFIX.length), 10);

    // 預先檢查:點按鈕的人必須是被邀請的對象
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) {
      await interaction.reply({
        content: '⚠️ 找不到此拜訪',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    const expectedAccepter = getExpectedAccepter(visit.userIdA, visit.userIdB, visit.initiatorId);
    if (interaction.user.id !== expectedAccepter) {
      await interaction.reply({
        content: `這個拜訪邀請是給 <@${expectedAccepter}> 的,不關你的事 😄`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const result = await acceptVisit(visitId, interaction.user.id);
    if (!result.ok) {
      await interaction.reply({
        content: `⚠️ ${result.reason}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const { visitor, visitee, visitorGain, visiteeGain } = result;
    const fmtChange = (
      name: string,
      userId: string,
      before: number,
      after: number,
      max: number,
      gained: number,
    ) =>
      gained > 0
        ? `• **${name}** (<@${userId}>): ${before} → **${after}** /${max} ⚡ +${gained}`
        : `• **${name}** (<@${userId}>): ${after}/${max} ⚡ (已滿,沒加到)`;

    const embed = new EmbedBuilder()
      .setColor(COLORS.GREEN)
      .setTitle('✨ 拜訪完成!')
      .setDescription(
        `<@${visitor.userId}> 拜訪了 <@${visitee.userId}> 🌿\n\n` +
          fmtChange(
            visitor.name,
            visitor.userId,
            visitor.energy - visitorGain,
            visitor.energy,
            visitor.energyMax,
            visitorGain,
          ) +
          '\n' +
          fmtChange(
            visitee.name,
            visitee.userId,
            visitee.energy - visiteeGain,
            visitee.energy,
            visitee.energyMax,
            visiteeGain,
          ) +
          `\n\n⏳ 這兩位玩家明天才能再互相拜訪(每天 1 次)`,
      );

    await interaction.update({ content: '', embeds: [embed], components: [] });
    return true;
  }

  // ─── 婉拒 ───
  if (interaction.customId.startsWith(BTN_DECLINE_PREFIX)) {
    const visitId = parseInt(interaction.customId.slice(BTN_DECLINE_PREFIX.length), 10);
    const result = await declineVisit(visitId, interaction.user.id);
    if (!result.ok) {
      await interaction.reply({
        content: `⚠️ ${result.reason}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    await interaction.update({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.RED)
          .setTitle('❌ 拜訪被婉拒')
          .setDescription(`<@${interaction.user.id}> 婉拒了這次拜訪。`),
      ],
      components: [],
    });
    return true;
  }

  return false;
}
