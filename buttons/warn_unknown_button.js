import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { failureMessage } from './../messages/index.js';

const message = '🤖 Unexpected button pushed. This button may no longer be supported?';

/**
 * User pressed an unknown button
 * @param {{}} ctx Telegram Context Object
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function warnUnknownButton({ ctx }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToHandleUnknownButton']);
          }

          return cbk();
        },

        // Post a failure message
        failure: ['validate', async ({}) => {
          return await ctx.reply(message, failureMessage({}).actions);
        }],

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default warnUnknownButton;
