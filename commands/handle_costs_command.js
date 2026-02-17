import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { table as renderTable, getBorderCharacters } from 'table';
import { getChainTransactions } from 'ln-accounting';
import { getRebalancePayments } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { formatTokens } from './../interface/index.js';

const border = getBorderCharacters('void');
const dayMs = 1000 * 60 * 60 * 24;
const formatReport = (from, n) => `⚡️ Spent on ${from}\n\n\`\`\`${n}\`\`\``;
const formatReports = reports => reports.join('\n');
const header = ['', 'Day', 'Week'];
const {now} = Date;
const paidAmount = tokens => formatTokens({tokens, none: '-'}).display;
const sumOf = arr => arr.reduce((sum, n) => sum + n, BigInt(Number()));
const tokFromMtok = mtok => Number(BigInt(mtok) / BigInt(1e3));
const weekMs = 1000 * 60 * 60 * 24 * 7;

/**
 * Check node costs
 * @param {number} from Command From User Id
 * @param {number} id Connected User Id
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: Saved Node Name,
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @param {function} reply Reply to Telegram Context Function
 * @param {function} request Request Function
 * @param {function} working Working Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>}
 */
function handleCostsCommand({ from, id, nodes, reply, request, working }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdNumberForCostsCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionForCostsCommand']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionForCostsCommand']);
          }

          if (!working) {
            return cbk([400, 'ExpectedWorkingFunctionForCostsCommand']);
          }

          return cbk();
        },

        // Authenticate the command caller is authorized to this command
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Get rebalance payments
        getRebalances: ['checkAccess', ({}, cbk) => {
          const after = new Date(now() - weekMs).toISOString();
          const dayStart = new Date(now() - dayMs).toISOString();
          const lnds = nodes.map(n => n.lnd);

          return getRebalancePayments({ after, lnds }, (err, res) => {
            if (err) {
              return cbk(err);
            }

            return asyncMap(nodes, (node, cbk) => {
                const key = node.public_key;

                const payments = res.payments.filter(n => n.destination === key);

                const day = payments.filter(n => n.confirmed_at > dayStart);

                return cbk(null, {
                  day: sumOf(day.map(n => BigInt(n.fee_mtokens))),
                  public_key: node.public_key,
                  week: sumOf(payments.map(n => BigInt(n.fee_mtokens)))
                });
              },
              cbk);
          });
        }],

        // Get chain transactions
        getTransactions: ['checkAccess', ({}, cbk) => {
          working();

          const after = new Date(now() - weekMs).toISOString();
          const dayStart = new Date(now() - dayMs).toISOString();

          return asyncMap(nodes, (node, cbk) => {
              const { lnd } = node;

              return getChainTransactions({ after, lnd, request }, (err, res) => {
                if (err) {
                  return cbk(err);
                }

                const transactions = res.transactions
                  .filter(n => !!n.fee)
                  .filter(n => !!n.is_confirmed)
                  .filter(n => n.created_at >= after);

                const day = transactions.filter(n => n.created_at >= dayStart);

                return cbk(null, {
                  day: Number(sumOf(day.map(n => BigInt(n.fee)))),
                  public_key: node.public_key,
                  week: Number(sumOf(transactions.map(n => BigInt(n.fee))))
                })
              });
            },
            cbk);
        }],

        // Determine the reply to send to Telegram
        response: [
          'getRebalances',
          'getTransactions',
          ({ getRebalances, getTransactions }, cbk) => {
            const reports = getTransactions.map(node => {
              const key = node.public_key;

              const { from } = nodes.find(n => n.public_key === key);
              const paid = getRebalances.find(n => n.public_key === key);

              // Exit early when there were no costs in the week
              if (!node.week && !paid.week) {
                return formatReport(from, '- No fees paid in the past week');
              }

              const rows = [
                [
                  'Rebalances',
                  paidAmount(tokFromMtok(paid.day)),
                  paidAmount(tokFromMtok(paid.week))
                ],
                [
                  'Chain Fees',
                  paidAmount(node.day),
                  paidAmount(node.week)
                ]
              ];

              const chart = renderTable([header].concat(rows), {
                border,
                singleLine: true
              });

              return formatReport(from, chart);
            });

            return cbk(null, formatReports(reports));
          }],

        // Send response to telegram
        reply: ['response', ({ response }, cbk) => {
          reply(response);

          return cbk();
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleCostsCommand;
