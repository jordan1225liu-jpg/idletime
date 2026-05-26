import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import { getInventory, sellItem } from '../lib/inventory.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('💰 賣物品給 NPC 商人')
  .addStringOption((o) =>
    o
      .setName('item')
      .setDescription('要賣的物品(從清單選)')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    o
      .setName('quantity')
      .setDescription('賣幾個(預設 1;填 0 = 全賣)')
      .setRequired(false)
      .setMinValue(0),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const itemId = interaction.options.getString('item', true);
  const quantity = interaction.options.getInteger('quantity') ?? 1;

  const result = await sellItem(interaction.user.id, itemId, quantity);

  if (!result.ok) {
    await interaction.reply({
      content: `⚠️ ${result.reason}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('💰 賣出成功')
    .setDescription(
      `${result.itemEmoji} **${result.itemName}** × ${result.sold}\n` +
        `(${result.unitPrice}💰/個)`,
    )
    .addFields(
      {
        name: '+ 收入',
        value: `**${result.goldGained.toLocaleString()}** 💰`,
        inline: true,
      },
      {
        name: '💰 你的金幣',
        value: `${result.goldBefore.toLocaleString()} → **${result.goldAfter.toLocaleString()}**`,
        inline: true,
      },
    );

  if (result.remaining > 0) {
    embed.setFooter({ text: `背包還剩 ${result.remaining} 個` });
  } else {
    embed.setFooter({ text: '已經賣完這個物品' });
  }

  await interaction.reply({ embeds: [embed] });
}

/** Autocomplete:列出此使用者可賣的物品(sellPrice > 0 且 quantity > 0)*/
export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<boolean> {
  const focused = interaction.options.getFocused();
  const focusedLower = focused.toLowerCase();
  const inv = await getInventory(interaction.user.id);
  const sellable = inv.filter((e) => e.item.sellPrice > 0);

  const filtered = focused
    ? sellable.filter(
        (e) =>
          e.item.name.toLowerCase().includes(focusedLower) ||
          e.item.id.toLowerCase().includes(focusedLower),
      )
    : sellable;

  const choices = filtered.slice(0, 25).map((e) => ({
    name: `${e.item.emoji ?? ''} ${e.item.name} × ${e.quantity} (售 ${e.item.sellPrice}💰)`.slice(
      0,
      100,
    ),
    value: e.item.id,
  }));

  await interaction.respond(choices);
  return true;
}
