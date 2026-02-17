import asyncAuto from 'async/auto.js';
import { getPeerLiquidity } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { formatTokens } from './../interface/index.js';

const detailsJoiner = ' ';
const displayTokens = tokens => formatTokens({tokens}).display;
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const textJoiner = '\n';

/**
 * Post a channel closed message for Telegram
 * @param {{}} args
 * @param {number} args.capacity Closed Channel Capacity Tokens
 * @param {string} args.from Node From
 * @param {string} args.id Connected Telegram User Id
 * @param {boolean} args.is_breach_close Is Breach Close
 * @param {boolean} args.is_cooperative_close Is Cooperative Close
 * @param {boolean} args.is_local_force_close Is Local Force Close
 * @param {boolean} args.is_remote_force_close Is Remote Force Close
 * @param {{}} args.lnd Authenticated LND API Object
 * @param {string} args.partner_public_key Partner Public Key Hex
 * @param {function} args.send Send Message to Telegram User Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise<string> Channel Close Message Text
 */
function postClosedMessage(args, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (args.capacity === undefined) {
            return cbk([400, 'ExpectedChannelCapacityToPostClosedMessage']);
          }

          if (!args.from) {
            return cbk([400, 'ExpectedFromNodeToPostClosedMessage']);
          }

          if (!args.id) {
            return cbk([400, 'ExpectedConnectedUserIdToPostClosedMessage'])
          }

          if (args.is_breach_close === undefined) {
            return cbk([400, 'ExpectedBreachCloseBoolToPostClosedMessage']);
          }

          if (args.is_cooperative_close === undefined) {
            return cbk([400, 'ExpectedCooperativeCloseBoolToPostClosedMessage']);
          }

          if (args.is_local_force_close === undefined) {
            return cbk([400, 'ExpectedLocalForceCloseStatusToPostCloseMessage']);
          }

          if (args.is_remote_force_close === undefined) {
            return cbk([400, 'ExpectedRemoteForceCloseToPostCloseMessage']);
          }

          if (!args.lnd) {
            return cbk([400, 'ExpectedAuthenticatedLndToPostCloseMessage']);
          }

          if (!args.partner_public_key) {
            return cbk([400, 'ExpectedPartnerPublicKeyToPostCloseMessage']);
          }

          if (!args.send) {
            return cbk([400, 'ExpectedSendFunctionToPostCloseMessage']);
          }

          return cbk();
        },

        // Event prefix
        event: ['validate', async ({}, cbk) => {
          const capacity = displayTokens(args.capacity);

          if (args.is_breach_close) {
            return `Breach countered on ${ capacity } channel with`;
          } else if (args.is_cooperative_close) {
            return `Cooperatively closed ${ capacity } channel with`;
          } else if (args.is_local_force_close) {
            return `Force-closed ${ capacity } channel with`;
          } else if (args.is_remote_force_close) {
            return `${ capacity } channel was force closed by`;
          }
          return `${ capacity } channel closed with`;
        }],

        // Get peer liquidity rundown
        getLiquidity: ['validate', ({}, cbk) => {
          return getPeerLiquidity({
              lnd: args.lnd,
              public_key: args.partner_public_key
            },
            cbk);
        }],

        // Update text
        message: ['event', 'getLiquidity', ({ event, getLiquidity }, cbk) => {
          const details = [
            `${ event } ${ getLiquidity.alias } ${ args.partner_public_key }.`,
            `Inbound liquidity now: ${ displayTokens(getLiquidity.inbound) }.`,
            `Outbound liquidity now: ${ displayTokens(getLiquidity.outbound) }.`
          ];

          const text = [`🥀 ${ details.join(detailsJoiner) }`, args.from];

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

export default postClosedMessage;
