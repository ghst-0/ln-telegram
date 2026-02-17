import asyncAuto from 'async/auto.js';
import asyncDetect from 'async/detect.js';
import asyncReflect from 'async/reflect.js';
import { cancelHodlInvoice, getInvoice } from 'ln-service';
import { decodeTrade } from 'paid-services';
import { returnResult } from 'asyncjs-util';

import { failureMessage } from './../messages/index.js';

const failure = msg => `⚠️ Unexpected error \`${msg}\`. Try again?`;
const {isArray} = Array;
const split = n => n.split('\n');

/**
 * Cancel an open trade
 * @param {{}} ctx Telegram Context Object
 * @param {{lnd: object}[]} nodes List of nodes {
 *   lnd: Authenticated LND API Object
 * }
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function cancelTrade({ ctx, nodes }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToCancelTrade']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToCancelTrade']);
          }

          return cbk();
        },

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

        // Derive the anchor invoice id
        trade: ['validate', asyncReflect(({}, cbk) => {
          const [, trade] = split(ctx.update.callback_query.message.text);

          // Check that there is a trade
          try {
            decodeTrade({ trade });
          } catch (err) {
            return cbk([503, 'FailedToDecodeTradeToCancel', { err }]);
          }

          const { connect } = decodeTrade({ trade });

          if (!connect) {
            return cbk([503, 'ExpectedOpenTradeToCancel']);
          }

          if (!connect.id) {
            return cbk([503, 'ExpectedOpenTradeIdToCancel']);
          }

          return cbk(null, { id: connect.id });
        })],

        // Find the node that has the anchor invoice
        getNode: ['trade', ({ trade }, cbk) => {
          // Exit early if there is no trade id
          if (!trade.value) {
            return cbk();
          }

          return asyncDetect(nodes, ({ lnd }, cbk) => {
              return getInvoice({ lnd, id: trade.value.id }, err => cbk(null, !err));
            },
            cbk);
        }],

        // Cancel the anchor invoice
        cancel: ['getNode', 'trade', asyncReflect(({ getNode, trade }, cbk) => {
          // Exit early when there is no way to cancel
          if (!getNode) {
            return cbk();
          }

          return cancelHodlInvoice({ id: trade.value.id, lnd: getNode.lnd }, cbk);
        })],

        // Post when there is a failure to cancel the anchor invoice
        postFailure: ['cancel', 'trade', async ({ cancel, trade }) => {
          // Exit early when there was no failure
          if (!cancel.error && !trade.error) {
            return await ctx.deleteMessage();
          }

          const [, message] = cancel.error || trade.error;

          return await ctx.reply(failure(message), failureMessage({}).actions);
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default cancelTrade;
