import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { getCharacter } from '../lib/character.js';
import { getInventory, type InventoryEntry } from '../lib/inventory.js';
import { COLORS } from '../lib/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('🎒 查看你的背包');

const CATEGORY_LABEL: Record<string, string> = {
  seed: '🌱 種子',
  crop: '🌾 作物',
  food: '🍞 料理',
  material: '🪵 材料',
  tool: '🔧 工具',
  consumable: '🧪 消耗品',
};

const CATEGORY_ORDER = ['crop', 'seed', 'food', 'material', 'tool', 'consumable'];

function categoryRank(cat: string): number {
  const i = CATEGORY_ORDER.indexOf(cat);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const character = await getCharacter(interaction.user.id);
  if (!character) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const inv = await getInventory(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🎒 ${character.name} 的背包`)
    .setDescription(`💰 持有金幣:**${character.gold.toLocaleString()}**`);

  if (inv.length === 0) {
    embed.addFields({
      name: '_',
      value: '_背包是空的。試試 `/farm` 種點作物!_',
      inline: false,
    });
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // 依 category 分組
  const byCategory = new Map<string, InventoryEntry[]>();
  for (const entry of inv) {
    const cat = entry.item.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  // 排序 + 加 field
  const sortedCategories = [...byCategory.keys()].sort((a, b) => categoryRank(a) - categoryRank(b));
  let totalValue = 0;

  for (const cat of sortedCategories) {
    const entries = byCategory.get(cat)!;
    const label = CATEGORY_LABEL[cat] ?? `📦 ${cat}`;
    const lines = entries.map((e) => {
      const sell = e.item.sellPrice > 0 ? `  ·  售 ${e.item.sellPrice}💰` : '';
      totalValue += e.quantity * e.item.sellPrice;
      return `${e.item.emoji ?? '📦'} **${e.item.name}** × ${e.quantity}${sell}`;
    });
    embed.addFields({ name: label, value: lines.join('\n'), inline: false });
  }

  if (totalValue > 0) {
    embed.setFooter({ text: `全部賣掉可得 ${totalValue.toLocaleString()}💰  ·  用 /sell 賣物` });
  }

  await interaction.reply({ embeds: [embed] });
}
