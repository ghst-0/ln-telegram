import { InlineKeyboard } from 'grammy';

import { callbackCommands, icons, labels } from './../interface/index.js';

const {removeMessage} = callbackCommands;
const {terminateBot} = callbackCommands;
const {stopBotCancelButtonLabel} = labels;
const {stopBotConfirmButtonLabel} = labels;
const mode = 'MarkdownV2';

/**
 * Create a stop bot message
 * @returns {{markup: InlineKeyboard, mode: string, text: string}} {
 *   markup: Reply Markup Object,
 *   mode: Message Parse Mode,
 *   text: Message Text
 * }
 */
function stopBotMessage() {
  const markup = new InlineKeyboard();

  markup.text(stopBotCancelButtonLabel, terminateBot);
  markup.text(stopBotConfirmButtonLabel, removeMessage);

  const text = `${ icons.bot } Are you sure that you want to stop the bot?`;

  return { markup, mode, text };
}

export default stopBotMessage;
