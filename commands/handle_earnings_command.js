import asyncAuto from 'async/auto.js';
import asyncDetect from 'async/detect.js';
import asyncFilter from 'async/filter.js';
import asyncMap from 'async/map.js';
import asyncUntil from 'async/until.js';
import { table as renderTable, getBorderCharacters } from 'table';
import { getInvoices, getPayment, getForwards } from 'ln-service';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { formatTokens } from './../interface/index.js';

const border = getBorderCharacters('void');
const dayMs = 1000 * 60 * 60 * 24;
const defaultInvoicesLimit = 100;
const earnedTokens = tokens => formatTokens({tokens, none: '-'}).display;
const earnedViaInvoices = 'Invoiced';
const earnedViaRouting = 'Routing';
const formatReport = (from, n) => `💰 Earned on ${from}\n\n\`\`\`${n}\`\`\``;
const formatReports = reports => reports.join('\n');
const header = ['', 'Day', 'Week'];
const {isArray} = Array;
const limit = 999999;
const notFound = 404;
const {now} = Date;
const sumOf = arr => arr.reduce((sum, n) => sum + n, BigInt(Number()));
const tokFromMtok = mtok => Number(BigInt(mtok) / BigInt(1e3));
const weekMs = 1000 * 60 * 60 * 24 * 7;

/**
 * Check node earnings
 * @param {number} from Command From User Id
 * @param {number} id Connected User Id
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: Saved Node Name,
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @param {function} reply Reply to Telegram Context Function
 * @param {function} working Reply Bot is Working Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>}
 */
function handleEarningsCommand({ from, id, nodes, reply, working }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdNumberForEarningsCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionForEarningsCommand']);
          }

          if (!working) {
            return cbk([400, 'ExpectedWorkingFunctionForEarningsCommand']);
          }

          return cbk();
        },

        // Authenticate the command caller is authorized to this command
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Get invoices
        getInvoices: ['checkAccess', ({}, cbk) => {
          working();

          return asyncMap(nodes, (node, cbk) => {
              const after = new Date(now() - weekMs).toISOString();
              const dayStart = new Date(now() - dayMs).toISOString();
              const invoices = [];
              let token;

              // Pull invoices until they are older than the start date
              return asyncUntil(
                cbk => cbk(null, token === false),
                cbk => {
                  return getInvoices({
                      token,
                      limit: token ? undefined : defaultInvoicesLimit,
                      lnd: node.lnd
                    },
                    (err, res) => {
                      if (err) {
                        return cbk(err);
                      }

                      token = res.next || false;

                      // Stop paging when there is an invoice older than the start
                      if (res.invoices.some(n => n.created_at < after)) {
                        token = false;
                      }

                      // Collect invoices that confirmed after the start
                      res.invoices
                        .filter(n => !!n.confirmed_at)
                        .filter(n => n.confirmed_at >= after)
                        .forEach(n => invoices.push(n));

                      return cbk();
                    });
                },
                err => {
                  if (err) {
                    return cbk(err);
                  }

                  // Filter out invoices that are actually self-payments
                  return asyncFilter(invoices, (invoice, cbk) => {
                      return asyncDetect(nodes, (node, cbk) => {
                          return getPayment({
                              id: invoice.id,
                              lnd: node.lnd
                            },
                            (err, res) => {
                              if (isArray(err) && err.shift() === notFound) {
                                return cbk(null, false);
                              }

                              if (err) {
                                return cbk(err);
                              }

                              return cbk(null, !!res.payment);
                            });
                        },
                        (err, payment) => {
                          if (err) {
                            return cbk(err);
                          }

                          // No found payment on any node means it was externally paid
                          return cbk(null, !payment);
                        });
                    },
                    (err, received) => {
                      if (err) {
                        return cbk(err);
                      }

                      const day = received.filter(n => n.confirmed_at >= dayStart);

                      return cbk(null, {
                        day: sumOf(day.map(n => BigInt(n.received_mtokens))),
                        public_key: node.public_key,
                        week: sumOf(received.map(n => BigInt(n.received_mtokens)))
                      });
                    });
                }
              );
            },
            cbk);
        }],

        // Get forwards
        getForwards: ['checkAccess', ({}, cbk) => {
          const after = new Date(now() - weekMs).toISOString();
          const before = new Date().toISOString();
          const dayStart = new Date(now() - dayMs).toISOString();

          return asyncMap(nodes, (node, cbk) => {
              const { lnd } = node;

              return getForwards({ after, before, limit, lnd }, (err, res) => {
                if (err) {
                  return cbk(err);
                }

                const day = res.forwards.filter(n => n.created_at >= dayStart);

                return cbk(null, {
                  day: sumOf(day.map(n => BigInt(n.fee_mtokens))),
                  public_key: node.public_key,
                  week: sumOf(res.forwards.map(n => BigInt(n.fee_mtokens)))
                });
              });
            },
            cbk);
        }],

        // Determine the reply to send to Telegram
        response: [
          'getForwards',
          'getInvoices',
          ({ getForwards, getInvoices }, cbk) => {
            const reports = getForwards.map(node => {
              const key = node.public_key;

              const { from } = nodes.find(n => n.public_key === key);
              const got = getInvoices.find(n => n.public_key === key);

              // Exit early when there are no earnings
              if (!got.week && !node.week) {
                return formatReport(from, '- No earnings in the past week');
              }

              const rows = [
                [
                  earnedViaRouting,
                  earnedTokens(tokFromMtok(node.day)),
                  earnedTokens(tokFromMtok(node.week))
                ],
                [
                  earnedViaInvoices,
                  earnedTokens(tokFromMtok(got.day)),
                  earnedTokens(tokFromMtok(got.week))
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

export default handleEarningsCommand;
