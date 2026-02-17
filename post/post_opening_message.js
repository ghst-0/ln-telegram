import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { icons, formatTokens } from './../interface/index.js';

const elementJoiner = ' ';
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';
const {unannounced} = icons;

/**
 * Send channel opening message to telegram
 * @param {string} from Node From Name
 * @param {string} id Connected Telegram User Id
 * @param {{}} lnd Authenticated LND API Object
 * @param opening
 * @param {function} send Send Message to Telegram User Id Function
 * @param {function} cbk Callback function
 * @returns {Promise<{text:string}>} via cbk or Promise<text:string> text: Posted Channel Open Message
 */
function postOpeningMessage({ from, id, lnd, opening, send }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromNameToPostChannelOpeningMessage']);
          }

          if (!id) {
            return cbk([400, 'ExpectedUserIdToPostChannelOpeningMessage']);
          }

          if (!lnd) {
            return cbk([400, 'ExpectedLndToPostChannelOpeningMessage']);
          }

          if (!isArray(opening)) {
            return cbk([400, 'ExpectedOpeningChannelsToPostChannelOpening']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostChanOpeningMessage']);
          }

          return cbk();
        },

        // Get peer aliases
        getAliases: ['validate', ({}, cbk) => {
          return asyncMap(opening, (channel, cbk) => {
              return getNodeAlias({ lnd, id: channel.partner_public_key }, cbk);
            },
            cbk);
        }],

        // Put together the message to summarize the channels opening
        message: ['getAliases', ({ getAliases }, cbk) => {
          const lines = opening.map(chan => {
            const node = getAliases.find(n => n.id === chan.partner_public_key);

            const action = chan.is_partner_initiated ? 'Accepting' : 'Opening';
            const announce = chan.is_private ? `${ unannounced } private` : '';
            const direction = chan.is_partner_initiated ? 'from' : 'to';
            const moniker = `${ escape(node.alias) } \`${ node.id }\``.trim();

            const elements = [
              `${ icons.opening } ${ action } new`,
              escape(formatTokens({ tokens: chan.capacity }).display),
              `${ announce } channel ${ direction } ${ moniker }${ escape('.') }`.trim()
            ];

            return elements.join(elementJoiner);
          });

          const text = [lines.join(textJoiner), `_${ escape(from) }_`];

          return cbk(null, { text: text.join(textJoiner) });
        }],

        // Send channel open message
        send: ['message', async ({ message }) => {
          return await send(id, message.text, markup);
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postOpeningMessage;
