import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@idletime/db';
import { getUnreadSummary } from './mail.js';

/**
 * 任何「動作」指令執行完後呼叫一次。若玩家有未讀信件:
 *  1. 在頻道補一則 ephemeral 提示(只有本人看得到)—— 每次動作都提示,直到領完。
 *  2. 私訊提醒,但「同一波信只私訊一次」:用 Character.mailNotifiedAt 當高水位,
 *     只有當最新一封未讀信比上次通知時間還新,才會再私訊。
 *
 * 重要:本函式絕不向外丟例外(全包在 try/catch),避免破壞原指令已完成的回覆。
 */
export async function notifyUnreadMail(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userId = interaction.user.id;
    const { count, newestAt } = await getUnreadSummary(userId);
    if (count === 0) return;

    // ① 頻道 ephemeral 提示(每次動作都提示)
    if (interaction.replied || interaction.deferred) {
      try {
        await interaction.followUp({
          content: `📬 你有 **${count}** 封未讀信件!用 \`/mail\` 領取金幣與物品 🎁`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (e) {
        // followUp 可能因互動過期而失敗 — 不影響主流程
        console.error('mail notice followUp failed:', e);
      }
    }

    // ② 私訊(同一波只一次)。需要角色才記得住「上次通知時間」,
    //    沒角色(還沒 /start)就不私訊,避免每次動作都重撈 DM。
    if (!newestAt) return;
    const character = await prisma.character.findUnique({
      where: { userId },
      select: { mailNotifiedAt: true },
    });
    if (!character) return;

    const alreadyNotified = character.mailNotifiedAt !== null && character.mailNotifiedAt >= newestAt;
    if (alreadyNotified) return;

    // 先更新高水位再送 DM:就算對方關閉私訊導致送信失敗,也不會每次動作都重試洗版。
    await prisma.character.update({
      where: { userId },
      data: { mailNotifiedAt: new Date() },
    });

    try {
      await interaction.user.send(
        `📬 你在 **idletime** 有 **${count}** 封未讀信件!\n` +
          `回到遊戲打 \`/mail\` 打開信箱,領取金幣與物品 🎁`,
      );
    } catch {
      // 對方關閉了私訊 → 略過(頻道提示已經給過了)
    }
  } catch (e) {
    console.error('notifyUnreadMail failed:', e);
  }
}
