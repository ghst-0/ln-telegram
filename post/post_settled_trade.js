import asyncAuto from 'async/auto.js';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { settleTradeMessage } from '../messages/index.js';

const {isArray} = Array;

/**
 * Post a settled trade message
 * @param {{}} args
 * @param {{}} args.api Telegram API Object
 * @param {string} args.description Trade Description
 * @param {string} args.destination Trade Invoice Creator Public Key Hex
 * @param {{}} args.lnd Authenticated LND API Object
 * @param {{
 *   from: string,
 *   public_key: string
 * }[]} args.nodes {
 *   from: Saved Node Name,
 *   public_key: <Public Key Hex
 * }
 * @param {number} args.tokens Trade Price Tokens
 * @param {number} args.user Telegram User Id
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postSettledTrade(args, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!args.api) {
            return cbk([400, 'ExpectedTelegramApiObjectToPostSettledTrade']);
          }

          if (args.description === undefined) {
            return cbk([400, 'ExpectedTradeDescriptionToPostSettledTrade']);
          }

          if (!args.destination) {
            return cbk([400, 'ExpectedDestinationPublicKeyToPostSettledTrade']);
          }

          if (!args.lnd) {
            return cbk([400, 'ExpectedAuthenticatedLndToPostSettledTrade']);
          }

          if (!isArray(args.nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToPostSettledTrade']);
          }

          if (args.tokens === undefined) {
            return cbk([400, 'ExpectedTradePriceTokensToPostSettledTrade']);
          }

          if (!args.user) {
            return cbk([400, 'ExpectedConnectedUserIdToPostSettledTrade']);
          }

          return cbk();
        },

        // Get sold to alias
        getAlias: ['validate', ({}, cbk) => {
          return getNodeAlias({ id: args.to, lnd: args.lnd }, cbk);
        }],

        // Post the settled trade to the user
        post: ['getAlias', async ({ getAlias }) => {
          const node = args.nodes.find(n => n.public_key === args.destination);

          const [, other] = args.nodes;

          // Make the settled message text
          const message = settleTradeMessage({
            alias: getAlias.alias,
            description: args.description,
            from: other ? node.from : undefined,
            to: args.to,
            tokens: args.tokens
          });

          // Post the new invoice as a message
          return await args.api.sendMessage(args.user, message.text, {
            parse_mode: message.mode
          });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default postSettledTrade;
