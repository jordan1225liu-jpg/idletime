import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import * as ping from './ping.js';
import * as start from './start.js';
import * as me from './me.js';
import * as farm from './farm.js';

export interface Command {
  /** Slash command 定義(會被序列化送給 Discord 註冊)*/
  data: SlashCommandBuilder;
  /** Slash command 觸發時執行 */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** (可選)處理 modal submit;回傳 true 表示已處理 */
  handleModalSubmit?: (interaction: ModalSubmitInteraction) => Promise<boolean>;
  /** (可選)處理 button click;回傳 true 表示已處理 */
  handleButton?: (interaction: ButtonInteraction) => Promise<boolean>;
}

export const commands: readonly Command[] = [
  ping as Command,
  start as Command,
  me as Command,
  farm as Command,
];
