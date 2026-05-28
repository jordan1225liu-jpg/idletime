import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { prisma } from '@idletime/db';
import { POTIONS, brewPotion, maxBrewable } from '../lib/potions.js';
import { COLORS } from '../lib/embeds.js';
import { assetUrl } from '../lib/assets.js';

export const data = new SlashCommandBuilder()
  .setName('brew')
  .setDescription('🧪 藥水鋪 — 用作物 + 金幣合成回血藥')
  .addIntegerOption((o) =>
    o
      .setName('quantity')
      .setDescription('一次做幾個(預設 1,填 0 = 做最多)')
      .setRequired(false)
      .setMinValue(0),
  );

const SELECT_BREW = 'brew:craft';

async function buildBrewUI(userId: string, quantity: number, notification?: string) {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) return null;

  // 抓玩家所有材料庫存
  const allIngredientIds = [
    ...new Set(POTIONS.flatMap((p) => p.ingredients.map((i) => i.itemId))),
  ];
  const invItems = await prisma.inventoryItem.findMany({
    where: { userId, itemId: { in: allIngredientIds } },
  });
  const have = new Map(invItems.map((i) => [i.itemId, i.quantity]));

  const embed = new EmbedBuilder()
    .setColor(COLORS.GREEN)
    .setTitle('🧪 藥水鋪')
    .setDescription(
      `💰 你的金幣:**${character.gold.toLocaleString()}**` +
        (notification ? `\n\n${notification}` : ''),
    );
  // 工坊場景圖 + 藥師賽吉肖像
  const banner = assetUrl('activities/brew');
  if (banner) embed.setImage(banner);
  const npcImg = assetUrl('npcs/sage');
  if (npcImg) embed.setThumbnail(npcImg);

  const craftable: string[] = [];

  for (const p of POTIONS) {
    const ingLines = p.ingredients.map((ing) => {
      const owned = have.get(ing.itemId) ?? 0;
      const ok = owned >= ing.quantity;
      return `${ing.emoji} ${ing.name} ${owned}/${ing.quantity}${ok ? '' : ' ❌'}`;
    });
    const goldOk = character.gold >= p.goldCost;
    const allIngOk = p.ingredients.every(
      (ing) => (have.get(ing.itemId) ?? 0) >= ing.quantity,
    );
    const canCraft = goldOk && allIngOk;
    if (canCraft) craftable.push(p.itemId);

    embed.addFields({
      name: `${p.emoji} ${p.name}(回 ${p.healPercent}%)${canCraft ? ' ✅' : ''}`,
      value: `材料:${ingLines.join(' · ')} · 💰 ${p.goldCost.toLocaleString()}${goldOk ? '' : ' ❌'}`,
      inline: false,
    });
  }

  // select menu: 列出所有藥水(可做的標 ✅,不可做的選了會給錯誤訊息)
  // quantity 編進 customId,讓選藥水後知道要做幾個
  const qtyLabel = quantity === 0 ? '做最多' : `一次做 ${quantity} 個`;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${SELECT_BREW}:${quantity}`)
    .setPlaceholder(`🧪 選藥水 → ${qtyLabel}`);
  for (const p of POTIONS) {
    const can = craftable.includes(p.itemId);
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.name}(回 ${p.healPercent}%)`.slice(0, 100))
        .setValue(p.itemId)
        .setEmoji(p.emoji)
        .setDescription((can ? '✅ 可合成' : '材料/金幣不足').slice(0, 100)),
    );
  }
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  return { embed, components: [row] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const quantity = interaction.options.getInteger('quantity') ?? 1;
  const ui = await buildBrewUI(interaction.user.id, quantity);
  if (!ui) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({ embeds: [ui.embed], components: ui.components });
}

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(SELECT_BREW)) return false;

  // 從 customId 取出批量(brew:craft:<quantity>)
  let quantity = Number.parseInt(interaction.customId.split(':')[2] ?? '1', 10);
  if (Number.isNaN(quantity) || quantity < 0) quantity = 1;

  const potionId = interaction.values[0];
  if (!potionId) {
    await interaction.deferUpdate();
    return true;
  }

  const userId = interaction.user.id;

  // quantity 0 = 做最多
  let qtyToMake = quantity;
  if (quantity === 0) {
    qtyToMake = await maxBrewable(userId, potionId);
    if (qtyToMake < 1) {
      const ui = await buildBrewUI(userId, quantity, '⚠️ 材料 / 金幣不足,一個都做不出來');
      if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
      return true;
    }
  }

  const result = await brewPotion(userId, potionId, qtyToMake);
  const notification = result.ok
    ? `✅ 合成 ${result.potion.emoji} **${result.potion.name}** × ${result.quantity}!剩餘金幣 ${result.goldAfter.toLocaleString()}💰`
    : `⚠️ ${result.reason}`;

  const ui = await buildBrewUI(userId, quantity, notification);
  if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
