import { InlineKeyboard } from 'grammy';

const makeKeyboard = () => new InlineKeyboard();
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

/** Make a remove message button

  {}

  @returns
  {
    markup: <Reply Markup Object>
  }
*/
export default ({}) => {
  return {markup: removeMessageKeyboard(makeKeyboard())};
};
