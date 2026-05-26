import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { settleEnergy } from '../lib/energy.js';
import { getFarmState, plantCrop, harvestAll, getFarmingSkill } from '../lib/farm.js';
import { buildFarmEmbed } from '../lib/embeds.js';
import { CROPS } from '../lib/crops.js';

export const data = new SlashCommandBuilder()
  .setName('farm')
  .setDescription('🌾 查看與管理你的農場');

const BUTTON_PREFIX = 'farm:';
const BUTTON_PLANT_PREFIX = 'farm:plant:';
const BUTTON_HARVEST = 'farm:harvest';
const BUTTON_REFRESH = 'farm:refresh';

/** 組裝完整的 farm UI(embed + buttons),共用於 /farm 跟所有 button 回應 */
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

  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const crop of Object.values(CROPS)) {
    const locked = crop.unlockLevel > farmingSkill.level;
    const noEnergy = character.energy < crop.energyCost;
    const disabled = locked || noEnergy || !hasEmpty;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${BUTTON_PLANT_PREFIX}${crop.id}`)
        .setLabel(crop.name)
        .setEmoji(crop.emoji)
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_HARVEST)
      .setLabel('收成')
      .setEmoji('🚜')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasReady),
    new ButtonBuilder()
      .setCustomId(BUTTON_REFRESH)
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [row] };
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

/** Button handler:處理 farm: 開頭的所有 button */
export async function handleButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith(BUTTON_PREFIX)) return false;

  const userId = interaction.user.id;

  // 種植
  if (interaction.customId.startsWith(BUTTON_PLANT_PREFIX)) {
    const cropId = interaction.customId.slice(BUTTON_PLANT_PREFIX.length);
    const result = await plantCrop(userId, cropId);

    if (!result.ok) {
      const ui = await buildFarmUI(userId, `⚠️ ${result.reason}`);
      if (ui) {
        await interaction.update({ embeds: [ui.embed], components: ui.components });
      }
      return true;
    }

    const ui = await buildFarmUI(
      userId,
      `🌱 種下了 ${result.crop.emoji} **${result.crop.name}** 在 ${result.plotIndex + 1} 號田`,
    );
    if (ui) {
      await interaction.update({ embeds: [ui.embed], components: ui.components });
    }
    return true;
  }

  // 收成
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
    if (ui) {
      await interaction.update({ embeds: [ui.embed], components: ui.components });
    }
    return true;
  }

  // 刷新
  if (interaction.customId === BUTTON_REFRESH) {
    const ui = await buildFarmUI(userId);
    if (ui) {
      await interaction.update({ embeds: [ui.embed], components: ui.components });
    }
    return true;
  }

  return false;
}
