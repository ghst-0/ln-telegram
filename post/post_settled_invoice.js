import asyncAuto from 'async/auto.js';
import asyncDetect from 'async/detect.js';
import asyncMap from 'async/map.js';
import { balancedOpenRequest } from 'paid-services';
import { getChannel, subscribeToPastPayment } from 'ln-service';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import getBalancedOpenMessage from './get_balanced_open_message.js';
import getRebalanceMessage from './get_rebalance_message.js';
import getReceivedMessage from './get_received_message.js';

const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {isArray} = Array;
const minQuizLength = 2;
const maxQuizLength = 10;
const randomIndex = n => Math.floor(Math.random() * n);
const sendOptions = {parse_mode: 'MarkdownV2'};
const uniq = arr => Array.from(new Set(arr));

/**
 * Post settled invoices
 * @param {{}} args
 * @param {string} args.from Invoice From Node
 * @param {string} args.key Node Public Key Id Hex
 * @param {{}} args.invoice
 * @param {string} args.invoice.description Invoice Description
 * @param {string} args.invoice.id Invoice Preimage Hash Hex
 * @param {boolean} args.invoice.is_confirmed Invoice is Settled
 * @param {{}[]} args.invoice.payments
 * @param {string} args.invoice.payments.[confirmed_at] Payment Settled At ISO 8601 Date
 * @param {string} args.invoice.payments.created_at Payment Held Since ISO 860 Date
 * @param {number} args.invoice.payments.created_height<Payment Held Since Block Height
 * @param {string} args.invoice.payments.in_channel Incoming Payment Through Channel Id
 * @param {boolean} args.invoice.payments.is_canceled Payment is Canceled
 * @param {boolean} args.invoice.payments.is_confirmed Payment is Confirmed
 * @param {boolean} args.invoice.payments.is_held Payment is Held
 * @param {{}[]} args.invoice.payments.messages
 * @param {string} args.invoice.payments.messages.type <Message Type Number
 * @param {string} args.invoice.payments.messages.value <Raw Value Hex
 * @param {string} args.invoice.payments.mtokens Incoming Payment Millitokens
 * @param {number} args.invoice.payments.[pending_index] Pending Payment Channel HTLC Index
 * @param {number} args.invoice.payments.tokens Payment Tokens
 * @param {string} args.invoice.payments.[total_mtokens] Total Payment Millitokens
 * @param {number} args.invoice.received Received Tokens
 * @param {{}} args.lnd Authenticated LND API Object
 * @param {number} args.[min_rebalance_tokens] Minimum Rebalance Tokens To Notify
 * @param {{
 *   from: string,
 *   lnd: {},
 *   public_key: string
 * }[]} args.nodes {
 *   from: From Node
 *   lnd: Authenticated LND API Object
 *   public_key: <Node Identity Public Key Hex
 * }
 * @param {({answers: string[], correct: number, question: string}) => {}} args.quiz
 * @param {(id: *, message: *, options: *) => {}} args.send Send Message Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postSettledInvoice(args, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!args.from) {
            return cbk([400, 'ExpectedFromNameToPostSettledInvoice']);
          }

          if (!args.id) {
            return cbk([400, 'ExpectedUserIdNumberToPostSettledInvoice']);
          }

          if (!args.invoice) {
            return cbk([400, 'ExpectedInvoiceToPostSettledInvoice']);
          }

          if (!args.key) {
            return cbk([400, 'ExpectedNodeIdentityKeyToPostSettledInvoice']);
          }

          if (!args.lnd) {
            return cbk([400, 'ExpectedLndObjectToPostSettledInvoice']);
          }

          if (!isArray(args.nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToPostSettledInvoice']);
          }

          if (!args.quiz) {
            return cbk([400, 'ExpectedSendQuizFunctionToPostSettledInvoice']);
          }

          if (!args.send) {
            return cbk([400, 'ExpectedSendFunctionToPostSettledInvoice']);
          }

          return cbk();
        },

        // Parse balanced open request details if present
        balancedOpen: ['validate', ({}, cbk) => {
          // A proposal will be a push payment
          if (!args.invoice.is_confirmed) {
            return cbk();
          }

          const { proposal } = balancedOpenRequest({
            confirmed_at: args.invoice.confirmed_at,
            is_push: args.invoice.is_push,
            payments: args.invoice.payments,
            received_mtokens: args.invoice.received_mtokens
          });

          return cbk(null, proposal);
        }],

        // Get the node aliases that forwarded this
        getNodes: ['validate', ({}, cbk) => {
          const inChannels = uniq(args.invoice.payments.map(n => n.in_channel));

          return asyncMap(inChannels, (id, cbk) => {
              return getChannel({ id, lnd: args.lnd }, (err, res) => {
                if (err) {
                  return cbk(null, { id, alias: id });
                }

                const peer = res.policies.find(n => n.public_key !== args.key);

                return getNodeAlias({ id: peer.public_key, lnd: args.lnd }, cbk);
              });
            },
            cbk);
        }],

        // Find associated payment
        getPayment: ['validate', ({}, cbk) => {
          // Exit early when the invoice has yet to be confirmed
          if (!args.invoice.is_confirmed) {
            return cbk();
          }

          const sub = subscribeToPastPayment({
            id: args.invoice.id,
            lnd: args.lnd
          });

          sub.once('confirmed', payment => cbk(null, { payment }));
          sub.once('error', () => cbk());
          sub.once('failed', () => cbk());
        }],

        // Find associated transfer
        getTransfer: ['validate', ({}, cbk) => {
          // Exit early when the invoice has yet to be confirmed
          if (!args.invoice.is_confirmed) {
            return cbk();
          }

          const otherNodes = args.nodes.filter(n => n.public_key !== args.key);

          return asyncDetect(otherNodes, ({ lnd }, cbk) => {
              const sub = subscribeToPastPayment({ lnd, id: args.invoice.id });

              sub.once('confirmed', payment => cbk(null, true));
              sub.once('error', () => cbk(null, false));
              sub.once('failed', () => cbk(null, false));
            },
            cbk);
        }],

        // Details for message
        details: [
          'balancedOpen',
          'getNodes',
          'getPayment',
          'getTransfer',
          ({ balancedOpen, getNodes, getPayment, getTransfer }, cbk) => {
            // Exit early when the invoice has yet to be confirmed
            if (!args.invoice.is_confirmed) {
              return cbk();
            }

            // Exit early when this is a node to node transfer
            if (getTransfer) {
              return cbk();
            }

            // Exit early when this is a balanced open
            if (balancedOpen) {
              return getBalancedOpenMessage({
                  capacity: balancedOpen.capacity,
                  from: balancedOpen.partner_public_key,
                  lnd: args.lnd,
                  rate: balancedOpen.fee_rate
                },
                cbk);
            }

            const isRebalance = !!getPayment;

            // Exit early with no message when the rebalance amount is too small
            if (isRebalance && args.invoice.received < args.min_rebalance_tokens) {
              return cbk();
            }

            // Exit early when the received invoice is for a rebalance (self-pay)
            if (isRebalance) {
              return getRebalanceMessage({
                  fee_mtokens: getPayment.payment.fee_mtokens,
                  hops: getPayment.payment.hops,
                  lnd: args.lnd,
                  payments: args.invoice.payments,
                  received_mtokens: args.invoice.received_mtokens
                },
                cbk);
            }

            return getReceivedMessage({
                description: args.invoice.description,
                lnd: args.lnd,
                payments: args.invoice.payments,
                received: args.invoice.received,
                via: getNodes
              },
              cbk);
          }],

        // Post invoice
        post: ['details', 'getPayment', async ({ details, getPayment }) => {
          // Exit early when there is nothing to post
          if (!details) {
            return;
          }

          // Determine if node qualifier is necessary
          const isMultiNode = args.nodes.length > [args.key].length;

          const receivedOnNode = isMultiNode ? escape(` - ${ args.from }`) : '';

          const message = `${ details.icon } ${ details.message }${ receivedOnNode }`;

          return await args.send(args.id, message, sendOptions);
        }],

        // Post quiz
        quiz: ['details', 'post', async ({ details, post }) => {
          // Exit early when there is no quiz
          if (!details || !details.quiz || details.quiz.length < minQuizLength) {
            return;
          }

          // Exit early when the quiz has too many answers
          if (details.quiz.length > maxQuizLength) {
            return;
          }

          const [answer] = details.quiz;
          const correct = randomIndex(details.quiz.length);

          const replace = details.quiz[correct];

          // Randomize the position of the correct answer
          const answers = details.quiz.map((n, i) => {
            if (i === correct) {
              return answer;
            }

            if (!i) {
              return replace;
            }

            return n;
          });

          return await args.quiz({ answers, correct, question: details.title });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default postSettledInvoice;
