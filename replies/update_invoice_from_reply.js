import asyncAuto from 'async/auto.js';
import asyncReflect from 'async/reflect.js';
import { parsePaymentRequest } from 'ln-service';
import { returnResult } from 'asyncjs-util';

import { callbackCommands, getAmountAsTokens } from './../interface/index.js';
import { checkAccess } from './../authentication/index.js';
import { failureMessage } from './../messages/index.js';
import invoiceActionType from './invoice_action_type.js';
import { postCreatedInvoice } from './../post/index.js';

const {isArray} = Array;
const split = n => n.split('\n');

/**
 * Update the details of a created invoice from reply input
 * @param {{}} api Bot API Object
 * @param {{}} ctx Telegram Context Object
 * @param {number} id Connected User Id
 * @param {{lnd: {}, public_key: string}[]} nodes List of nodes {
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @param {function} request Request Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function updateInvoiceFromReply({ api, ctx, id, nodes, request }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!api) {
            return cbk([400, 'ExpectedTelegramApiToUpdateInvoice']);
          }

          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToUpdateInvoice']);
          }

          if (!id) {
            return cbk([400, 'ExpectedConnectedUserIdToUpdateInvoice']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToUpdateInvoice']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionToUpdateInvoice']);
          }

          return cbk();
        },

        // Confirm access authorization
        checkAccess: ['validate', ({}, cbk) => {
          return checkAccess({ id, from: ctx.message.from.id }, cbk);
        }],

        // Parse the referenced payment request
        details: ['checkAccess', ({}, cbk) => {
          // The payment request is the 2nd line
          const [, request] = split(ctx.update.message.reply_to_message.text);

          const details = parsePaymentRequest({ request });

          return cbk(null, details);
        }],

        // Determine what type of edit message this is
        type: ['checkAccess', ({}, cbk) => {
          const { text } = ctx.update.message.reply_to_message;

          const { type } = invoiceActionType({ nodes, text });

          return cbk(null, type);
        }],

        // Delete the answer message the user just entered
        deleteAnswer: ['type', async ({ type }) => {
          try {
            return type ? await ctx.deleteMessage() : null;
          } catch {
            // Ignore errors when deleting
          }
        }],

        // Delete the edit message that had the question
        deleteQuestion: ['type', async ({ type }) => {
          if (!type) {
            return;
          }

          try {
            await api.deleteMessage(
              ctx.update.message.reply_to_message.chat.id,
              ctx.update.message.reply_to_message.message_id
            );
          } catch {
            // Ignore errors when deleting
          }
        }],

        // Get the amount as tokens for the invoice
        getTokens: ['details', 'type', asyncReflect(({ details, type }, cbk) => {
          // Exit early when not updating the invoice amount
          if (type !== callbackCommands.setInvoiceTokens) {
            return cbk();
          }

          // Find the node that this invoice belongs to
          const node = nodes.find(n => n.public_key === details.destination);

          // Exit early when the invoicing node is unknown
          if (!node) {
            return cbk([400, 'InvoicingNodeNotFound']);
          }

          return getAmountAsTokens({
              request,
              amount: ctx.update.message.text,
              lnd: node.lnd
            },
            cbk);
        })],

        // Details for the updated new invoice
        updated: [
          'details',
          'getTokens',
          'type',
          ({ details, getTokens, type }, cbk) => {
            // Exit early when the type of update is not known
            if (!type) {
              return cbk();
            }

            const { description } = details;
            const { text } = ctx.update.message;
            const { tokens } = details;

            switch (type) {
              // Updating the invoice description
              case callbackCommands.setInvoiceDescription:
                return cbk(null, { tokens, description: text });

              // Updating the invoice amount
              case callbackCommands.setInvoiceTokens:
                // Revert back to the last good tokens when there is a parse fail
                return cbk(null, {
                  description,
                  tokens: getTokens.value ? getTokens.value.tokens : tokens
                });

              default:
                return cbk();
            }
          }],

        // Post the invoice
        postInvoice: ['details', 'updated', ({ details, updated }, cbk) => {
          // Exit early when there is no update
          if (!updated) {
            return cbk();
          }

          // Recreate the invoice with the updated details
          return postCreatedInvoice({
              ctx,
              nodes,
              description: updated.description,
              destination: details.destination,
              tokens: updated.tokens
            },
            cbk);
        }],

        // Post a failure message if necessary
        postFailure: ['getTokens', async ({ getTokens }) => {
          // Exit early when there is no failure
          if (!getTokens.error) {
            return;
          }

          const [, message] = getTokens.error;

          const failure = failureMessage({});

          try {
            await ctx.reply(message, failure.actions);
          } catch {
            // Ignore errors
          }
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default updateInvoiceFromReply;
