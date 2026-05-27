import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import * as ping from './ping.js';
import * as help from './help.js';
import * as start from './start.js';
import * as me from './me.js';
import * as farm from './farm.js';
import * as visit from './visit.js';
import * as inventory from './inventory.js';
import * as sell from './sell.js';
import * as fish from './fish.js';
import * as shop from './shop.js';
import * as equipment from './equipment.js';
import * as brew from './brew.js';
import * as hunt from './hunt.js';

export interface Command {
  /** Slash command 定義(會被序列化送給 Discord 註冊)*/
  data: SlashCommandBuilder;
  /** Slash command 觸發時執行 */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** (可選)處理 modal submit;回傳 true 表示已處理 */
  handleModalSubmit?: (interaction: ModalSubmitInteraction) => Promise<boolean>;
  /** (可選)處理 button click;回傳 true 表示已處理 */
  handleButton?: (interaction: ButtonInteraction) => Promise<boolean>;
  /** (可選)處理 string select menu;回傳 true 表示已處理 */
  handleSelectMenu?: (interaction: StringSelectMenuInteraction) => Promise<boolean>;
  /** (可選)處理 autocomplete;回傳 true 表示已處理 */
  handleAutocomplete?: (interaction: AutocompleteInteraction) => Promise<boolean>;
}

export const commands: readonly Command[] = [
  ping as Command,
  help as Command,
  start as Command,
  me as Command,
  farm as Command,
  visit as Command,
  inventory as Command,
  sell as Command,
  fish as Command,
  shop as Command,
  equipment as Command,
  brew as Command,
  hunt as Command,
];
