import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

/**
 * User pressed a remove message button
 * @param {{}} ctx Telegram Context Object
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function removeMessage({ ctx }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToHandleRemoveMessage']);
          }

          return cbk();
        },

        // Remove the referenced message
        remove: ['validate', async ({}) => await ctx.deleteMessage()],

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default removeMessage;
