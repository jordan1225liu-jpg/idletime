import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { settleEnergy } from '../lib/energy.js';
import { getFarmState, plantCropAll, harvestAll, clearFarm, getFarmingSkill } from '../lib/farm.js';
import { buildFarmEmbed } from '../lib/embeds.js';
import { unlockedCrops } from '../lib/crops.js';

export const data = new SlashCommandBuilder()
  .setName('farm')
  .setDescription('🌾 查看與管理你的農場');

const SELECT_PLANT = 'farm:plant-select';
const BUTTON_HARVEST = 'farm:harvest';
const BUTTON_CLEAR = 'farm:clear';
const BUTTON_REFRESH = 'farm:refresh';
const FARM_PREFIX = 'farm:';

function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}天`;
}

/** 組裝完整的 farm UI(embed + select menu + buttons),共用於 /farm 跟所有 button/select 回應 */
async function buildFarmUI(userId: string, notification?: string) {
  const character = await settleEnergy(userId);
  if (!character) return null;

  const [plots, farmingSkill] = await Promise.all([
    getFarmState(userId),
    getFarmingSkill(userId),
  ]);

  const embed = buildFarmEmbed({ character, farmingSkill, plots, notification });

  const hasEmpty = plots.some((p) => p.status === 'empty');
  const hasReady = plots.some((p) => p.status === 'ready');
  const hasGrowing = plots.some((p) => p.status === 'growing');

  // ─── Plant select menu ──────────────────────────────────────
  const unlocked = unlockedCrops(farmingSkill.level);
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(SELECT_PLANT)
    .setPlaceholder(hasEmpty ? '🌱 選作物 → 一鍵種滿所有空田' : '🚫 沒有空田,先收成')
    .setDisabled(!hasEmpty || unlocked.length === 0);

  if (unlocked.length > 0) {
    for (const crop of unlocked) {
      const label = `${crop.name} (${formatDurationShort(crop.growSeconds)})`;
      const desc = `+${crop.xpReward} XP · 售 ${crop.sellPrice}💰`;
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label.slice(0, 100))
          .setValue(crop.id)
          .setEmoji(crop.emoji)
          .setDescription(desc.slice(0, 100)),
      );
    }
  } else {
    // Discord 不允許 select menu 沒選項。沒解鎖任何作物時加 placeholder
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('暫無可種作物')
        .setValue('__none__')
        .setDescription('提升農場技能後解鎖'),
    );
    selectMenu.setDisabled(true);
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // ─── Action buttons ─────────────────────────────────────────
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_HARVEST)
      .setLabel('收成全部')
      .setEmoji('🚜')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasReady),
    new ButtonBuilder()
      .setCustomId(BUTTON_CLEAR)
      .setLabel('剷除生長中')
      .setEmoji('🧹')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasGrowing),
    new ButtonBuilder()
      .setCustomId(BUTTON_REFRESH)
      .setLabel('刷新')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [selectRow, buttonRow] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const ui = await buildFarmUI(interaction.user.id);
  if (!ui) {
    await interaction.reply({
      content: '你還沒建立角色!用 `/start` 開始遊戲。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({ embeds: [ui.embed], components: ui.components });
}

/** Button handler:處理 farm:harvest 與 farm:refresh */
export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(FARM_PREFIX)) return false;
  const userId = interaction.user.id;

  if (interaction.customId === BUTTON_HARVEST) {
    const result = await harvestAll(userId);

    let notification: string;
    if (result.harvested.length === 0) {
      notification = '⚠️ 沒有可收成的作物';
    } else {
      const items = result.harvested
        .map((h) => `${h.crop.emoji} ${h.crop.name} ×${h.quantity}`)
        .join('、');
      notification = `🎉 收成!獲得 ${items}\n📈 農場 +${result.xpGained} XP`;
      if (result.levelsGained > 0) {
        notification += `\n🎊 **農場技能升級! Lv ${result.oldLevel} → Lv ${result.newLevel}**`;
      }
    }

    const ui = await buildFarmUI(userId, notification);
    if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
    return true;
  }

  if (interaction.customId === BUTTON_CLEAR) {
    const cleared = await clearFarm(userId);
    const notification =
      cleared > 0
        ? `🧹 已剷除 ${cleared} 塊生長中的作物(無獎勵,可重新種植)`
        : '⚠️ 沒有生長中的作物可剷除(已成熟的請用收成)';
    const ui = await buildFarmUI(userId, notification);
    if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
    return true;
  }

  if (interaction.customId === BUTTON_REFRESH) {
    const ui = await buildFarmUI(userId);
    if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
    return true;
  }

  return false;
}

/** Select menu handler:處理 farm:plant-select(種植) */
export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (interaction.customId !== SELECT_PLANT) return false;
  const userId = interaction.user.id;
  const cropId = interaction.values[0];

  if (!cropId || cropId === '__none__') {
    await interaction.deferUpdate();
    return true;
  }

  const result = await plantCropAll(userId, cropId);

  let notification: string;
  if (!result.ok) {
    notification = `⚠️ ${result.reason}`;
  } else {
    notification = `🌱 種下了 ${result.crop.emoji} **${result.crop.name}** × ${result.planted}(種滿 ${result.planted} 塊空田)`;
  }

  const ui = await buildFarmUI(userId, notification);
  if (ui) await interaction.update({ embeds: [ui.embed], components: ui.components });
  return true;
}
