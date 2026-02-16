import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { icons } from './../interface/index.js';

const commaJoin = arr => arr.join(', ');
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};

/**
 * Post that nodes are now online
 * @param {number} id Connected User Id
 * @param {{alias: {}, public_key: string}[]} nodes List of nodes {
 *   alias: Node Alias,
 *   public_key: Public Key Hex
 * }
 * @param {function} send Send Message to Telegram User Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postNodesOnline({ id, nodes, send }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!id) {
            return cbk([400, 'ExpectedConnectedUserIdToPostOnlineNotification']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedNodesToPostOnlineNotification']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostOnlineNotification']);
          }

          return cbk();
        },

        // Message to send
        message: ['validate', ({}, cbk) => {
          const names = nodes.map(node => (node.alias || node.id).trim());

          const text = `${ icons.bot } Connected to ${ commaJoin(names) }`;

          return cbk(null, `_${ escape(text) }_`);
        }],

        // Send the connected message
        send: ['message', async ({ message }) => await send(id, message, markup)]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postNodesOnline;
