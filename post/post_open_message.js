import asyncAuto from 'async/auto.js';
import { getPeerLiquidity } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { formatTokens } from './../interface/index.js';

const detailsJoiner = ' ';
const displayAmount = tokens => formatTokens({tokens}).display;
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';

/**
 * Send channel open message to telegram
 * @param {{}} args
 * @param {number} args.capacityChannel Token Capacity
 * @param {string} args.fromNode From Name
 * @param {string} args.idConnected Telegram User Id
 * @param {*} args.[is_partner_initiated] Channel Partner Opened Channel
 * @param {boolean} args.is_privateChannel Is Private
 * @param {{}} args.lndAuthenticated LND API Object
 * @param {string} args.partner_public_keyChannel Partner Public Key
 * @param {function} args.send Send Message to Telegram User Id Function
 * @param {function} cbk Callback function
 * @returns {Promise<text: string>} via cbk or Promise<text: string> text: Posted Channel Open Message String
 */
function postOpenMessage(args, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (args.capacity === undefined) {
            return cbk([400, 'ExpectedCapacityToPostChannelOpenMessage']);
          }

          if (!args.from) {
            return cbk([400, 'ExpectedFromNameToPostChannelOpenMessage']);
          }

          if (!args.id) {
            return cbk([400, 'ExpectedTelegramUserIdToPostChannelOpenMessage']);
          }

          if (args.is_private === undefined) {
            return cbk([400, 'ExpectedPrivateStatusToPostChannelOpenMessage']);
          }

          if (!args.lnd) {
            return cbk([400, 'ExpectedLndToPostChannelOpenMessage']);
          }

          if (!args.partner_public_key) {
            return cbk([400, 'ExpectedPartnerPublicKeyToPostChanOpenMessage']);
          }

          if (!args.send) {
            return cbk([400, 'ExpectedSendFunctionToPostChanOpenMessage']);
          }

          return cbk();
        },

        // Get peer liquidity rundown
        getLiquidity: ['validate', ({}, cbk) => {
          return getPeerLiquidity({
              lnd: args.lnd,
              public_key: args.partner_public_key
            },
            cbk);
        }],

        // Message text
        message: ['getLiquidity', ({ getLiquidity }, cbk) => {
          const action = args.is_partner_initiated ? 'Accepted' : 'Opened';
          const capacity = displayAmount(args.capacity);
          const channel = args.is_private ? 'private channel' : 'channel';
          const direction = args.is_partner_initiated ? 'from' : 'to';
          const moniker = `${ getLiquidity.alias } ${ args.partner_public_key }`;

          const event = `${ action } new ${ capacity } ${ channel }`;

          const details = [
            `${ event } ${ direction } ${ moniker }.`,
            `Inbound liquidity now: ${ displayAmount(getLiquidity.inbound) }.`,
            `Outbound liquidity now: ${ displayAmount(getLiquidity.outbound) }.`
          ];

          const text = [`🌹 ${ details.join(detailsJoiner) }`, args.from];

          return cbk(null, { text: escape(text.join(textJoiner)) });
        }],

        // Send channel open message
        send: ['message', async ({ message }) => {
          return await args.send(args.id, message.text, markup);
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postOpenMessage;
