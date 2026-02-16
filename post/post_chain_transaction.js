import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { formatTokens, icons } from './../interface/index.js';

const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatAmount = tokens => formatTokens({tokens}).display;
const {isArray} = Array;
const joinElements = arr => arr.join(' ');
const markup = {parse_mode: 'MarkdownV2'};

/**
 * Post chain transaction
 * @param {boolean} confirmed Transaction is Confirmed
 * @param {string} from From Node
 * @param {number} id Connected User Id
 * @param {{public_key: string}[]} nodes List of nodes {
 *   public_key: Public Key Hex
 * }
 * @param {function} send Send Message to Telegram User Function
 * @param {{
 *   [chain_fee]: number,
 *   [received]: number,
 *   related_channels: {
 *     action: string,
 *     node?: string,
 *     with?: string
 *   }[],
 *   [sent]: number,
 *   [sent_to]: string[],
 *   [tx]: string
 * }[]} transaction {
 *   [chain_fee]: Paid Transaction Fee Tokens,
 *   [received]: Received Tokens,
 *   related_channels: [{
 *     action: Channel Action,
 *     [node]: Channel Peer Alias,
 *     [with]: Channel Peer Public Key Hex,
 *   }]
 *   [sent]: Sent Tokens,
 *   [sent_to]: [Sent to Address],
 *   [tx]: Transaction Id Hex
 * }[]
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postChainTransaction({ confirmed, from, id, nodes, send, transaction }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromNodeFromToPostChainTransaction']);
          }

          if (!id) {
            return cbk([400, 'ExpectedConnectedUserIdToPostChainTransaction']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToPostChainTransaction']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostChainTransaction']);
          }

          if (!transaction) {
            return cbk([400, 'ExpectedTransactionRecordToPostChainTransaction']);
          }

          if (!transaction.related_channels) {
            return cbk([400, 'ExpectedRelatedChannelsInTransactionToPost']);
          }

          return cbk();
        },

        // Details of message
        details: ['validate', ({}, cbk) => {
          const chainFee = transaction.chain_fee;

          const fee = chainFee ? `Paid ${ formatAmount(chainFee) } fee` : '';

          const related = transaction.related_channels.map(related => {
            const alias = related.node || related.with || String();

            switch (related.action) {
              case 'channel_closing':
                return `Closing channel with ${ alias }`;

              case 'cooperatively_closed_channel':
                return `Cooperatively closed with ${ alias }`;

              case 'force_closed_channel':
                return `Force closed channel with ${ alias }`;

              case 'opened_channel':
                return `Opened channel with ${ alias }`;

              case 'opening_channel':
                return `Opening channel with ${ alias }`;

              case 'peer_force_closed_channel':
                return `${ alias } force closed channel`;

              case 'peer_force_closing_channel':
                return `${ alias } force closing channel`;

              default:
                return String();
            }
          });

          const relatedChannels = related.filter(n => !!n).join('. ');

          // Exit early when the transaction is receiving
          if (transaction.received) {
            const elements = [
              `Received ${ formatAmount(transaction.received) }`,
              fee,
              relatedChannels.length > 0 ? `Related: ${ relatedChannels }` : ''
            ];

            return cbk(null, elements.filter(n => !!n).join('. '));
          }

          // Exit early when the the transaction is sending
          if (transaction.sent) {
            const sentTo = transaction.sent_to;

            const elements = [
              `Sent ${ formatAmount(transaction.sent) }`,
              fee,
              sentTo ? `Sent to ${ sentTo.join(', ') }` : '',
              relatedChannels.length > 0 ? `Related: ${ relatedChannels }` : ''
            ];

            return cbk(null, elements.filter(n => !!n).join('. '));
          }

          return cbk();
        }],

        // Message to post
        message: ['details', ({ details }, cbk) => {
          // Exit early when the chain tx is not sending or receiving
          if (!details) {
            return cbk();
          }

          const [, otherNode] = nodes;
          const pending = confirmed ? details : `(pending) ${ details }`;

          const action = escape(`${ icons.chain } ${ pending.trim() }`);

          // Exit early when there is no multi-node to specify
          if (!otherNode) {
            return cbk(null, action);
          }

          return cbk(null, joinElements([
            action,
            escape('-'),
            `_${ escape(from) }_`
          ]));
        }],

        // Post message to Telegram
        post: ['message', async ({ message }) => {
          // Exit early when there is no message to send
          if (!message) {
            return;
          }

          return await send(id, message, markup);
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default postChainTransaction;
