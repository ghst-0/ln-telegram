import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

/**
 * User pressed a cancel invoice button
 * @param {{}} ctx Telegram Context Object
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function cancelInvoice({ ctx }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToHandleCancelInvoice']);
          }

          return cbk();
        },

        // Remove the referenced invoice message
        remove: ['validate', async ({}) => await ctx.deleteMessage()],

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default cancelInvoice;
