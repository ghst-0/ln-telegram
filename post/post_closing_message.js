import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { formatTokens, icons } from './../interface/index.js';

const channelPoint = n => `${n.transaction_id}:${n.transaction_vout}`;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const joinLines = lines => lines.filter(n => !!n).join('\n');
const markup = {parse_mode: 'MarkdownV2'};
const uniq = arr => Array.from(new Set(arr));

/**
 * Send channel closing message to telegram
 * @param {{}} closing
 * @param {number} closing.capacity Channel Token Capacity
 * @param {string} closing.partner_public_key Channel Partner Public Key
 * @param {string} closing.transaction_id Channel Transaction Id Hex
 * @param {number} closing.transaction_vout Channel Transaction Output Index
 * @param {string} from Node From Name
 * @param {string} id Connected Telegram User Id
 * @param {{}} lnd Authenticated LND API Object
 * @param {{}} nodes List of nodes
 * @param {{public_key: string}[]} nodes List of nodes {
 *   public_key: Public Key Hex
 * }
 * @param {function} send Send Message to Telegram User Id Function
 * @param {function} cbk Callback function
 * @returns {Promise<string>} via cbk or Promise<string> Posted Channel Closing Message String
 */
function postClosingMessage({ closing, from, id, lnd, nodes, send }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!isArray(closing)) {
            return cbk([400, 'ExpectedClosingChannelsToPostClosingMessage']);
          }

          if (!from) {
            return cbk([400, 'ExpectedFromNameToPostChannelClosingMessage']);
          }

          if (!id) {
            return cbk([400, 'ExpectedUserIdToPostChannelClosingMessage']);
          }

          if (!lnd) {
            return cbk([400, 'ExpectedLndToPostChannelClosingMessage']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfSavedNodesToPostClosingMessage']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostChanClosingMessage']);
          }

          return cbk();
        },

        // Get peer aliases
        getAliases: ['validate', ({}, cbk) => {
          const ids = uniq(closing.map(n => n.partner_public_key));

          return asyncMap(ids, (id, cbk) => getNodeAlias({ id, lnd }, cbk), cbk);
        }],

        // Put together the message to summarize the channels closing
        message: ['getAliases', ({ getAliases }, cbk) => {
          const [, otherNode] = nodes;

          const details = closing.map(chan => {
            const amount = formatTokens({ tokens: chan.capacity }).display;
            const node = getAliases.find(n => n.id === chan.partner_public_key);

            const peer = escape(`${ node.alias } ${ node.id }`.trim());

            const details = [
              `${ icons.closing } Closing ${ escape(amount) } channel with ${ peer }`,
              `*Funding Outpoint:* \`${ channelPoint(chan) }\``
            ];

            return joinLines(details);
          });

          const lines = [
            joinLines(details),
            !!otherNode ? `_${ escape(from) }_` : ''
          ];

          return cbk(null, joinLines(lines));
        }],

        // Send the channel closing message
        send: ['message', async ({ message }) => await send(id, message, markup)]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postClosingMessage;
