import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { icons, formatTokens } from './../interface/index.js';

const display = tokens => formatTokens({tokens}).display;
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const join = arr => arr.join(', ');
const markup = {parse_mode: 'MarkdownV2'};
const niceName = node => node.alias || node.id.slice(0, 8);

/**
 * Post settled payment
 * @param {string} from Payment From Node
 * @param {number} id Connected User Id
 * @param {{}} lnd Authenticated LND API Object
 * @param {string[]} nodes List of nodes [Node Id Public Key Hex]
 * @param {function} send Send Message to Telegram User Function
 * @param {{}} payment
 * @param {string} payment.destination Payment Destination Public Key Hex
 * @param {string} payment.id Payment Hash Hex
 * @param {{hops: {public_key: string}[]}[]} payment.[paths]
 * @param {string} payment.[request] Payment BOLT11 Request
 * @param {number} payment.safe_fee Safe Paid Fee Tokens
 * @param {number} payment.safe_tokens Safe Paid Tokens
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise<text>: Settled Payment Message Text
 */
function postSettledPayment({ from, id, lnd, nodes, payment, send }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedPaymentFromNameStringToPostPayment']);
          }

          if (!id) {
            return cbk([400, 'ExpectedUserIdToPostSettledPayment']);
          }

          if (!lnd) {
            return cbk([400, 'ExpectedLndToPostSettledPayment']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToPostSettledPayment']);
          }

          if (!payment) {
            return cbk([400, 'ExpectedPaymentToPostSettledPayment']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostSettledPayment']);
          }

          return cbk();
        },

        // Find the node that was paid to
        getNode: ['validate', ({}, cbk) => {
          return getNodeAlias({ lnd, id: payment.destination }, cbk);
        }],

        // Get the aliases for relays
        getRelays: ['validate', ({}, cbk) => {
          return asyncMap(payment.paths || [], (path, cbk) => {
              const [hop] = path.hops;

              if (!hop) {
                return cbk();
              }

              return getNodeAlias({ lnd, id: hop.public_key }, cbk);
            },
            cbk);
        }],

        // Create the message details
        message: ['getNode', 'getRelays', ({ getNode, getRelays }, cbk) => {
          const isTransfer = nodes.includes(payment.destination);
          const routingFee = `. Paid routing fee: ${ display(payment.safe_fee) }`;
          const sent = display(payment.safe_tokens - payment.safe_fee);
          const toNode = niceName(getNode);
          const via = ` out ${ join(getRelays.filter(n => !!n).map(niceName)) }`;

          const action = isTransfer ? 'Transferred' : 'Sent';
          const fee = payment.safe_fee ? routingFee : '';

          const details = escape(`${ action } ${ sent } to ${ toNode }${ via }${ fee } -`);

          return cbk(null, `${ icons.spent } ${ details } _${ escape(from) }_`);
        }],

        // Post message summarizing the payment
        post: ['message', async ({ message }) => {
          return await send(id, message, markup);
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postSettledPayment;
