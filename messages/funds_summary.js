import { table as renderTable, getBorderCharacters } from 'table';

import { formatTokens, icons } from './../interface/index.js';

const border = getBorderCharacters('void');
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatCoins = tokens => formatTokens({tokens, none: ''}).display;
const formatReport = (from, n) => `${from}\`\`\`\n${n}\`\`\``;
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());

/**
 * Message summarizing liquidity
 * @param {{}} balances
 * @param {number} balances.closing_balance Balance of Tokens Moving Out Of Channels Tokens
 * @param {number} balances.conflicted_pending Conflicting Pending Balance Tokens
 * @param {number} balances.invalid_pending Invalid Pending Balance Tokens
 * @param {number} balances.offchain_balance Balance of Owned Tokens In Channels Tokens
 * @param {number} balances.offchain_pending Total Pending Local Balance Tokens
 * @param {number} balances.onchain_balance Balance of Transaction Outputs
 * @param {number} balances.onchain_vbytes Estimated Virtual Bytes to Spend On-Chain Funds
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: From Name,
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @returns {{message: string}} Message Text
 */
function fundsSummary({ balances, nodes }) {
  const [, otherNode] = nodes;

  const total = sumOf(nodes.map((_, i) => {
    return sumOf([
      balances[i].closing_balance,
      balances[i].offchain_balance,
      balances[i].offchain_pending,
      balances[i].onchain_confirmed,
      balances[i].onchain_pending
    ]);
  }));

  const overallTotal = escape(formatTokens({ tokens: total }).display);

  const table = nodes
    .map((node, i) => {
      const total = sumOf([
        balances[i].closing_balance,
        balances[i].offchain_balance,
        balances[i].offchain_pending,
        balances[i].onchain_confirmed,
        balances[i].onchain_pending
      ]);

      const displayTotal = escape(formatCoins(total));
      const icon = otherNode ? `${ icons.funds } ` : '';

      const from = `_${ icon }${ escape(node.from) }_: ${ displayTotal }\n`;

      // Exit early when there are no individual balances
      if (!total) {
        const zeroTotal = escape(formatTokens({ tokens: total }).display);

        return `${ escape(from) }: ${ zeroTotal }\n`;
      }

      const rows = [
        [
          'Channel Balance',
          formatCoins(balances[i].offchain_balance)
        ],
        [
          'Channel Pending',
          formatCoins(balances[i].offchain_pending)
        ],
        [
          'Closing Out',
          formatCoins(balances[i].closing_balance)
        ],
        [
          'Chain Confirmed',
          formatCoins(balances[i].onchain_confirmed)
        ],
        [
          'Chain Pending',
          formatCoins(balances[i].onchain_pending)
        ]
      ];

      return formatReport(
        from,
        renderTable(rows.filter(([, n]) => !!n), { border, singleLine: true })
      );
    });

  const header = `*Funds:* ${ overallTotal }\n\n`;
  const icon = otherNode ? '' : `${ icons.funds } `;

  return { message: `${ icon }${ header }${ table.join('') }` };
}

export default fundsSummary;
