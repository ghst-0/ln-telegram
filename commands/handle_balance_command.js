import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { getNodeFunds } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { fundsSummary } from './../messages/index.js';

const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};

/**
 * See the balance of funds
 *
 *  Syntax of command:
 *
 *   /balance
 *
 *   {
 *     from: <Command From User Id Number>
 *     id: <Connected User Id Number>
 *     nodes: [{
 *       from: <From Name String>
 *       lnd: <Authenticated LND API Object>
 *       public_key: <Public Key Hex String>
 *     }]
 *     reply: <Reply Function>
 *     working: <Working Function>
 *   }
 *
 * @param {{
 *   from: string,
 *   id: string,
 *   nodes: [{
 *     from: string,
 *     lnd: {},
 *     public_key: string
 *   }],
 *   reply: function,
 *   working: function}
 * } args
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>}
 */
function handleBalanceCommand(args, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!args.from) {
            return cbk([400, 'ExpectedFromUserIdNumberForBalanceCommand']);
          }

          if (!args.id) {
            return cbk([400, 'ExpectedConnectedIdNumberForBalanceCommand']);
          }

          if (!isArray(args.nodes)) {
            return cbk([400, 'ExpectedListOfConnectedNodesForBalanceCommand']);
          }

          if (!args.reply) {
            return cbk([400, 'ExpectedReplyFunctionForFundsCommand']);
          }

          if (!args.working) {
            return cbk([400, 'ExpectedWorkingFunctionForFundsCommand']);
          }

          return cbk();
        },

        // Authenticate the command caller is authorized to this command
        checkAccess: ['validate', ({}, cbk) => {
          return checkAccess({ from: args.from, id: args.id }, cbk);
        }],

        // Notify of record lookup time
        working: ['checkAccess', async ({}) => {
          try {
            return await args.working();
          } catch {
            // Ignore errors notifying working
          }
        }],

        // Fetch balance information
        getBalances: ['checkAccess', ({}, cbk) => {
          return asyncMap(args.nodes, (node, cbk) => {
              return getNodeFunds({ is_confirmed: true, lnd: node.lnd }, cbk);
            },
            cbk);
        }],

        // Put together funds report
        message: ['getBalances', async ({ getBalances }, cbk) => {
          const { message } = fundsSummary({
            balances: getBalances,
            nodes: args.nodes
          });

          return await args.reply(message, markup);
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleBalanceCommand;
