import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import { prisma } from '@idletime/db';
import { COLORS } from '../lib/embeds.js';
import { isAdmin } from '../lib/admin.js';
import { MAIL_EXPIRY_DAYS, sendBroadcastMail, type MailAttachment } from '../lib/mail.js';

// 信件最多帶 3 種物品(item1~3 / qty1~3)。要更多就改這裡 + 加對應 option。
export const data = new SlashCommandBuilder()
  .setName('mailsend')
  .setDescription('📨 [管理員] 發送信件給全體玩家(文字 + 金幣 + 物品)')
  // 不綁 Discord 伺服器權限 —— 真正權限以 DISCORD_OWNER_ID 為準(見 execute 的 isAdmin)。
  // 別人看得到也沒關係,按了會被擋下並提示「只有遊戲管理員可以發送信件」。
  .addStringOption((o) =>
    o.setName('title').setDescription('信件標題').setRequired(true).setMaxLength(200),
  )
  .addStringOption((o) =>
    o.setName('message').setDescription('信件內容').setRequired(true).setMaxLength(1500),
  )
  .addIntegerOption((o) =>
    o.setName('gold').setDescription('附贈金幣(可選)').setRequired(false).setMinValue(0),
  )
  .addStringOption((o) =>
    o.setName('item1').setDescription('附贈物品 1(從清單選)').setRequired(false).setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    o.setName('qty1').setDescription('物品 1 數量(預設 1)').setRequired(false).setMinValue(1),
  )
  .addStringOption((o) =>
    o.setName('item2').setDescription('附贈物品 2(從清單選)').setRequired(false).setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    o.setName('qty2').setDescription('物品 2 數量(預設 1)').setRequired(false).setMinValue(1),
  )
  .addStringOption((o) =>
    o.setName('item3').setDescription('附贈物品 3(從清單選)').setRequired(false).setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    o.setName('qty3').setDescription('物品 3 數量(預設 1)').setRequired(false).setMinValue(1),
  );

function rewardsSummary(gold: number, attachments: { emoji: string; name: string; quantity: number }[]): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`💰 ${gold.toLocaleString()}`);
  for (const a of attachments) parts.push(`${a.emoji}${a.name} ×${a.quantity}`);
  return parts.length > 0 ? parts.join(' · ') : '(純文字公告,無附件)';
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: '⚠️ 只有遊戲管理員可以發送信件', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title = interaction.options.getString('title', true);
  const message = interaction.options.getString('message', true);
  const gold = interaction.options.getInteger('gold') ?? 0;

  const slots = [
    { item: interaction.options.getString('item1'), qty: interaction.options.getInteger('qty1') },
    { item: interaction.options.getString('item2'), qty: interaction.options.getInteger('qty2') },
    { item: interaction.options.getString('item3'), qty: interaction.options.getInteger('qty3') },
  ];
  const attachments: MailAttachment[] = slots
    .filter((s): s is { item: string; qty: number | null } => !!s.item)
    .map((s) => ({ itemId: s.item, quantity: s.qty ?? 1 }));

  const result = await sendBroadcastMail({
    title,
    body: message,
    gold,
    attachments,
    senderId: interaction.user.id,
  });

  if (!result.ok) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.RED).setTitle('❌ 發送失敗').setDescription(result.reason)],
    });
    return;
  }

  const expiresStr = result.expiresAt.toLocaleDateString('zh-TW');
  const embed = new EmbedBuilder()
    .setColor(COLORS.GREEN)
    .setTitle('📨 信件已發送給全體玩家')
    .setDescription(`**${title}**\n${message}`.slice(0, 4000))
    .addFields(
      { name: '🎁 附件', value: rewardsSummary(result.gold, result.attachments), inline: false },
      { name: '⏳ 有效期限', value: `${expiresStr} 前(${MAIL_EXPIRY_DAYS} 天)未領取就消失`, inline: false },
    )
    .setFooter({ text: `信件 #${result.mailId} · 所有現有與新加入的玩家都能用 /mail 領取` });

  await interaction.editReply({ embeds: [embed] });
}

/** Autocomplete:列出道具型錄(種子 / 作物 / 藥水)供 admin 選擇 */
export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<boolean> {
  // 非管理員不給清單(也沒必要)
  if (!isAdmin(interaction.user.id)) {
    await interaction.respond([]);
    return true;
  }

  const focused = interaction.options.getFocused().trim();
  const items = await prisma.item.findMany({
    where: focused
      ? {
          OR: [
            { name: { contains: focused, mode: 'insensitive' } },
            { id: { contains: focused, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
    take: 25,
  });

  await interaction.respond(
    items.map((it) => ({
      name: `${it.emoji ?? '📦'} ${it.name} (${it.id})`.slice(0, 100),
      value: it.id,
    })),
  );
  return true;
}
