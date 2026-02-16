import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { tradeEditButtons } from './../messages/index.js';

const {isArray} = Array;

/**
 * User pressed a set trade node button
 * @param {{}} ctx Telegram Context Object
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: Saved Node Name,
 *   public_key: Public Key Hex
 * }
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function setTradeNode({ ctx, nodes }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToHandleTradeNodePress']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfSavedNodesToHandleSetTradeNode']);
          }

          return cbk();
        },

        // Add the saved nodes to the message
        edit: ['validate', async ({}) => {
          const { markup } = tradeEditButtons({ nodes, is_selecting: true });

          // Post the original message but with updated buttons
          return await ctx.editMessageText(
            ctx.update.callback_query.message.text,
            {
              entities: ctx.update.callback_query.message.entities,
              reply_markup: markup
            }
          );
        }],

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default setTradeNode;
