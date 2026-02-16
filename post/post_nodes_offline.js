import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { icons } from './../interface/index.js';

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};
const shortId = id => id.slice(0, 8);

/**
 * Post that nodes have gone offline
 * @param {{}} bot Telegram Bot Object
 * @param {number} [connected] Connected User Id
 * @param {{
 *  alias: string,
 *  id: string
 * }[]} offline
 *  alias: Node Alias,
 *  id: Node Identity Public Key Hex
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postNodesOffline({ bot, connected, offline }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!bot) {
            return cbk([400, 'ExpectedTelegramBotToPostNodesOffline']);
          }

          if (!isArray(offline)) {
            return cbk([400, 'ExpectedArrayOfOfflineNodesToPostNodesOffline']);
          }

          return cbk();
        },

        // Setup the message to send notifying that nodes are offline
        message: ['validate', ({}, cbk) => {
          // Exit early when there is no connected user to message
          if (!connected) {
            return cbk();
          }

          // Exit early when no nodes went offline
          if (!offline.length) {
            return cbk();
          }

          const aliases = offline.map(n => `${ n.alias } ${ shortId(n.id) }`.trim());
          const event = `${ icons.disconnected } Lost connection!`

          const details = `Cannot connect to ${ aliases }.`;

          return cbk(null, `_${ escape(event) } ${ escape(details) }_`);
        }],

        // Send the message
        send: ['message', async ({ message }) => {
          if (!message) {
            return;
          }

          return await bot.api.sendMessage(connected, message, markup);
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postNodesOffline;
