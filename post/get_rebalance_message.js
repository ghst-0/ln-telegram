import asyncAuto from 'async/auto.js';
import { getChannels } from 'ln-service';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { formatTokens, icons } from '../interface/index.js';

const asPercent = (fee, tokens) => (fee / tokens * 100).toFixed(2);
const asPpm = (fee, tokens) => (fee / tokens * 1e6).toFixed(0);
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const mtokensAsTokens = n => Number(n) / 1e3;
const niceName = node => node.alias || (node.id || '').slice(0, 8);

/**
 * Get a rebalance message
 * @param {{}} args
 * @param {number} args.fee_mtokens Payment Fee Tokens
 * @param {{public_key: string}[]} args.hops public_key: Forwarding Node Public Key Hex
 * @param {{}} args.lnd Authenticated LND API Object
 * @param {{in_channel: string}[]} args.payments in_channel: Incoming Payment Through Channel Id
 * @param {number} args.received_mtokens Received Tokens
 * @param {function} cbk Callback function
 * @returns {Promise<{icon: string, message: string}>} via cbk or Promise<{
 *   icon: Message Icon
 *   message: Rebalance Message
 * }>
 */
function getRebalanceMessage(args, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (args.fee_mtokens === undefined) {
            return cbk([400, 'ExpectedPaidFeeToGetRebalanceMessage']);
          }

          if (!isArray(args.hops)) {
            return cbk([400, 'ExpectedArrayOfHopsToGetRebalanceMessage']);
          }

          if (!args.lnd) {
            return cbk([400, 'ExpectedLndToGetRebalanceMessage']);
          }

          if (!isArray(args.payments)) {
            return cbk([400, 'ExpectedPaymentsToGetRebalanceMessage']);
          }

          if (args.received_mtokens === undefined) {
            return cbk([400, 'ExpectedReceivedAmountToGetRebalanceMessage']);
          }

          return cbk();
        },

        // Get channels to figure out who the inbound peer is
        getChannels: ['validate', ({}, cbk) => {
          const [inPayment] = args.payments;

          if (!inPayment) {
            return cbk();
          }

          return getChannels({ lnd: args.lnd }, cbk);
        }],

        // Get outbound peer alias
        getOut: ['validate', ({}, cbk) => {
          const [firstHop] = args.hops;

          if (!firstHop) {
            return cbk(null, {});
          }

          return getNodeAlias({ id: firstHop.public_key, lnd: args.lnd }, cbk);
        }],

        // Get inbound peer alias
        getIn: ['getChannels', ({ getChannels }, cbk) => {
          const [inPayment] = args.payments;

          if (!inPayment) {
            return cbk();
          }

          // Figure out who the channel is with
          const { channels } = getChannels;

          const inChannel = channels.find(n => n.id === inPayment.in_channel);

          // Exit early when the inbound channel is unknown
          if (!inChannel) {
            return cbk();
          }

          return getNodeAlias({
              id: inChannel.partner_public_key,
              lnd: args.lnd
            },
            cbk);
        }],

        // Derive a description of the rebalance
        rebalanceDescription: ['getIn', 'getOut', ({ getIn, getOut }, cbk) => {
          const received = mtokensAsTokens(args.received_mtokens);
          const fee = mtokensAsTokens(args.fee_mtokens);
          const feePercent = asPercent(args.fee_mtokens, args.received_mtokens);
          const feeRate = `(${ asPpm(args.fee_mtokens, args.received_mtokens) })`;
          const separator = escape('. Fee: ');
          const withNode = `${ escape(niceName(getOut)) }`;

          const amount = escape(formatTokens({ tokens: received }).display);
          const niceFee = escape(formatTokens({ tokens: fee }).display);

          const feeInfo = `${ niceFee } ${ escape(feePercent) }% ${ escape(feeRate) }`;
          const increase = `Rebalanced ${ amount } out ${ withNode }`;

          // Exit early when there is no inbound peer info
          if (!getIn) {
            return cbk(null, `${ increase }${ separator }${ feeInfo }`);
          }

          const fromNode = escape(niceName(getIn));

          return cbk(null, `${ increase } *→* ${ fromNode }${ separator }${ feeInfo }`);
        }],

        // Final message result
        message: ['rebalanceDescription', ({ rebalanceDescription }, cbk) => {
          return cbk(null, {
            icon: icons.rebalance,
            message: rebalanceDescription
          });
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default getRebalanceMessage;
