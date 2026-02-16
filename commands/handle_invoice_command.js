import asyncAuto from 'async/auto.js';
import asyncReflect from 'async/reflect.js';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { failureMessage } from './../messages/index.js';
import { getAmountAsTokens } from './../interface/index.js';
import { postCreatedInvoice } from './../post/index.js';

const defaultAmount = '';
const defaultDescription = '';
const {isArray} = Array;
const join = n => n.join(' ');
const splitArguments = n => n.split(' ');

/**
 * Create invoice
 * @param {{}} ctx Telegram Context Object
 * @param {string} id Connected Id
 * @param {{from: string, lnd: {}}} nodes List of nodes {
 *   from: Saved Node Name,
 *   lnd: Authenticated LND API Object
 * }
 * @param {function} request Request Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function handleInvoiceCommand({ ctx, id, nodes, request }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!ctx) {
            return cbk([400, 'ExpectedTelegramMessageContextToCreateInvoice']);
          }

          if (!isArray(nodes) || nodes.length === 0) {
            return cbk([400, 'ExpectedArrayOfNodesToCreateInvoice']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionToCreateInvoice']);
          }

          return cbk();
        },

        // Confirm access authorization
        checkAccess: ['validate', ({}, cbk) => {
          return checkAccess({ id, from: ctx.message.from.id }, cbk);
        }],

        // Decode passed command arguments
        decodeCommand: ['checkAccess', ({}, cbk) => {
          // Use the first node as the default
          const [node] = nodes;

          // Exit early when there are no arguments
          if (!ctx.match) {
            return cbk(null, {
              amount: defaultAmount,
              description: defaultDescription,
              destination: node.public_key,
              lnd: node.lnd
            });
          }

          // The command can be called as /invoice <amount> <memo>
          const [amount, ...description] = splitArguments(ctx.match.trim());

          return cbk(null, {
            amount,
            description: join(description),
            destination: node.public_key,
            lnd: node.lnd
          });
        }],

        // Remove the command message
        removeMessage: ['checkAccess', async ({}) => {
          try {
            return await ctx.deleteMessage();
          } catch {
            // Do nothing on delete message errors
          }
        }],

        // Get the amount as tokens for the invoice
        getTokens: ['decodeCommand', asyncReflect(({ decodeCommand }, cbk) => {
          return getAmountAsTokens({
              request,
              amount: decodeCommand.amount,
              lnd: decodeCommand.lnd
            },
            cbk);
        })],

        // Try to create the invoice
        create: [
          'decodeCommand',
          'getTokens',
          asyncReflect(({ decodeCommand, getTokens }, cbk) => {
            // Exit early when there was a problem getting the tokens value
            if (getTokens.error) {
              return cbk(getTokens.error);
            }

            return postCreatedInvoice({
                ctx,
                nodes,
                description: decodeCommand.description,
                destination: decodeCommand.destination,
                tokens: getTokens.value.tokens
              },
              cbk);
          })],

        // Post a failure message when something went wrong
        postFailureMessage: ['create', async ({ create }) => {
          // Exit early when there is no failure
          if (!create.error) {
            return;
          }

          const [, message] = create.error;

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

export default handleInvoiceCommand;
