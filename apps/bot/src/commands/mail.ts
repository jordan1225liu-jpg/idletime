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
import { COLORS } from '../lib/embeds.js';
import {
  claimAllMails,
  claimMail,
  countInboxMails,
  getInboxMails,
  type InboxMail,
  type ResolvedAttachment,
} from '../lib/mail.js';

export const data = new SlashCommandBuilder()
  .setName('mail')
  .setDescription('📬 打開信箱,領取系統 / 管理員寄來的金幣與物品');

const MAIL_PREFIX = 'mail:';

// ─── 顯示工具 ──────────────────────────────────────────────────

/** 把金幣 + 附件物品壓成一行獎勵描述 */
function rewardsLine(gold: number, attachments: ResolvedAttachment[]): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`💰 ${gold.toLocaleString()}`);
  for (const a of attachments) parts.push(`${a.emoji}${a.name} ×${a.quantity}`);
  return parts.length > 0 ? parts.join(' · ') : '(純文字,無附件)';
}

function buildInboxEmbed(mails: InboxMail[], totalCount: number): EmbedBuilder {
  if (mails.length === 0) {
    return new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle('📭 你的信箱')
      .setDescription('目前沒有未領取的信件。\n收到新信件時這裡會出現,記得回來領獎勵!');
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('📬 你的信箱')
    .setDescription(`你有 **${totalCount}** 封未領取的信件:`);

  for (const m of mails) {
    const body = m.body.length > 200 ? `${m.body.slice(0, 200)}…` : m.body;
    const value = `${body}\n🎁 ${rewardsLine(m.gold, m.attachments)}`;
    embed.addFields({ name: `✉️ #${m.id} ${m.title}`.slice(0, 256), value: value.slice(0, 1024), inline: false });
  }

  if (totalCount > mails.length) {
    embed.setFooter({ text: `只顯示最新 ${mails.length} 封,「領取全部」會一次領完所有信件` });
  } else {
    embed.setFooter({ text: '點「領取全部」一次收齊,或逐封領取' });
  }
  return embed;
}

function inboxComponents(mails: InboxMail[]): ActionRowBuilder<ButtonBuilder>[] {
  if (mails.length === 0) return [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // 第一排:領取全部
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MAIL_PREFIX}claimall`)
        .setLabel('領取全部')
        .setEmoji('📥')
        .setStyle(ButtonStyle.Success),
    ),
  );

  // 後續排:每封信一顆領取鈕(每排 5 顆,最多再 4 排)
  let current = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;
  for (const m of mails) {
    if (count > 0 && count % 5 === 0) {
      rows.push(current);
      current = new ActionRowBuilder<ButtonBuilder>();
    }
    current.addComponents(
      new ButtonBuilder()
        .setCustomId(`${MAIL_PREFIX}claim:${m.id}`)
        .setLabel(`領取 #${m.id}`)
        .setStyle(ButtonStyle.Secondary),
    );
    count += 1;
    if (rows.length >= 4) break; // 安全上限:1(全部)+ 4 排個別 = 5 排
  }
  if (count > 0) rows.push(current);
  return rows;
}

/** 領取成功後,顯示在信箱上方的綠色摘要 embed */
function claimResultEmbed(title: string, gold: number, attachments: ResolvedAttachment[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.GREEN)
    .setTitle(`✅ ${title}`)
    .setDescription(`已放入你的角色:\n🎁 ${rewardsLine(gold, attachments)}`);
}

// ─── 指令 ──────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  // 信箱是私人的 → ephemeral;讀 DB 前先 defer 避免冷連線逾時
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [mails, total] = await Promise.all([
    getInboxMails(interaction.user.id),
    countInboxMails(interaction.user.id),
  ]);
  await interaction.editReply({
    embeds: [buildInboxEmbed(mails, total)],
    components: inboxComponents(mails),
  });
}

export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(MAIL_PREFIX)) return false;

  const rest = interaction.customId.slice(MAIL_PREFIX.length);
  const [action, idStr] = rest.split(':');
  const userId = interaction.user.id;

  // 領取會寫 DB(可能多筆),先 deferUpdate 取得 ack,避免互動逾時
  await interaction.deferUpdate();

  // ── 領取全部 ──
  if (action === 'claimall') {
    const result = await claimAllMails(userId);
    if (result.noCharacter) {
      await interaction.followUp({ content: '⚠️ 你還沒建立角色,先用 `/start`', flags: MessageFlags.Ephemeral });
      return true;
    }
    const [mails, total] = await Promise.all([getInboxMails(userId), countInboxMails(userId)]);
    const embeds: EmbedBuilder[] = [];
    if (result.claimedCount > 0) {
      embeds.push(
        claimResultEmbed(`領取了 ${result.claimedCount} 封信`, result.gold, result.attachments),
      );
    } else {
      embeds.push(new EmbedBuilder().setColor(COLORS.RED).setDescription('沒有可領取的信件(可能已過期或被領走)'));
    }
    embeds.push(buildInboxEmbed(mails, total));
    await interaction.editReply({ embeds, components: inboxComponents(mails) });
    return true;
  }

  // ── 領取單封 ──
  if (action === 'claim') {
    const mailId = Number(idStr);
    if (!Number.isInteger(mailId)) {
      await interaction.followUp({ content: '⚠️ 信件編號無效', flags: MessageFlags.Ephemeral });
      return true;
    }
    const result = await claimMail(userId, mailId);
    const [mails, total] = await Promise.all([getInboxMails(userId), countInboxMails(userId)]);
    const embeds: EmbedBuilder[] = [];
    if (result.ok) {
      embeds.push(claimResultEmbed(result.title, result.gold, result.attachments));
    } else {
      embeds.push(new EmbedBuilder().setColor(COLORS.RED).setDescription(`⚠️ ${result.reason}`));
    }
    embeds.push(buildInboxEmbed(mails, total));
    await interaction.editReply({ embeds, components: inboxComponents(mails) });
    return true;
  }

  return false;
}
