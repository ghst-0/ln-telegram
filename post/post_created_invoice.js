import asyncAuto from 'async/auto.js';
import asyncReflect from 'async/reflect.js';
import { createInvoice } from 'ln-service';
import { InlineKeyboard } from 'grammy';
import { returnResult } from 'asyncjs-util';

import { createInvoiceMessage } from './../messages/index.js';

const createFailedMessage = msg => `⚠️ *Failed to create invoice: ${msg}*`
const expiry = () => new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString();
const {isArray} = Array;
const makeKeyboard = () => new InlineKeyboard();
const parseMode = 'Markdown';
const removeMessageKeyboard = kb => kb.text('OK', 'remove-message');

/**
 * Create and post an invoice
 * @param {{}} ctx Telegram Context Object
 * @param {string} description Invoice Description
 * @param {string} destination Invoice Destination Public Key Hex
 * @param {{lnd: {}, public_key: string}[]} nodes List of nodes {
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @param {number} [tokens] Invoice Tokens
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postCreatedInvoice({ ctx, description, destination, nodes, tokens }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToPostCreatedInvoice']);
          }

          if (!destination) {
            return cbk([400, 'ExpectedInvoiceDestinationToPostCreatedInvoice']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedArrayOfNodesToPostCreatedInvoice']);
          }

          return cbk();
        },

        // Find the node associated with creating this invoice
        node: ['validate', ({}, cbk) => {
          const node = nodes.find(n => n.public_key === destination);

          return cbk(null, node);
        }],

        // Create the new invoice
        create: ['node', asyncReflect(({ node }, cbk) => {
          return createInvoice({
              description,
              tokens,
              expires_at: expiry(),
              is_including_private_channels: true,
              lnd: node.lnd
            },
            cbk);
        })],

        // Post about a create invoice failure
        failed: ['create', async ({ create }) => {
          // Exit early when create succeeded
          if (!create.error) {
            return;
          }

          const [, message] = create.error;

          try {
            return await ctx.reply(createFailedMessage(message), {
              parse_mode: parseMode,
              reply_markup: removeMessageKeyboard(makeKeyboard())
            });
          } catch (err) {
            // Ignore errors
            return;
          }
        }],

        // Post the invoice as a reply
        post: ['create', 'node', async ({ create, node }) => {
          // Exit early when there is no created invoice
          if (!create.value) {
            return;
          }

          const [, other] = nodes;

          // Make the invoice message text
          const message = createInvoiceMessage({
            from: !!other ? node.from : undefined,
            request: create.value.request
          });

          // Post the new invoice as a message
          return await ctx.reply(message.text, {
            parse_mode: message.mode,
            reply_markup: message.markup
          });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default postCreatedInvoice;
