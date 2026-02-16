import { InlineKeyboard } from 'grammy';

const makeKeyboard = () => new InlineKeyboard();
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

/**
 * Make a remove message button
 * @returns {{markup: {}}} markup: Reply Markup Object
 */
function makeRemoveButton({}) {
  return { markup: removeMessageKeyboard(makeKeyboard()) };
}

export default makeRemoveButton;
