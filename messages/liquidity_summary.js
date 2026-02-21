import { table as renderTable, getBorderCharacters } from 'table';

import { formatTokens, icons } from '../interface/index.js';

const border = getBorderCharacters('void');
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatFee = n => n === undefined ? '' : `${(n/1e4).toFixed(2)}% (${n})`;
const formatLiquidity = tokens => formatTokens({tokens, none: '-'}).display;
const formatReport = (from, n) => `${from}\`\`\`\n${n}\`\`\``;
const head = `*Liquidity:*\n\n`;
const noFrom = '';
const peerTitle = (query, k) => `*Liquidity with ${query} ${k}:*\n\n`;
const shortId = key => key.slice(0, 8);

/**
 * Message summarizing liquidity
 * @param {string} alias Alias
 * @param {{
 *   balance: number,
 *   [fee_rate]: number,
 *   public_key: string
 * }[]} inbound {
 *   balance: Balance Tokens,
 *   fee_rate: Fee Rate,
 *   public_key: Public Key Hex
 * }
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: From Name,
 *   lnd: Authenticated LND API Object,
 *   public_key: Public Key Hex
 * }
 * @param {{
 *   balance: number,
 *   [fee_rate]: number,
 *   public_key: string
 * }[]} outbound {
 *   balance: Balance Tokens,
 *   fee_rate: Fee Rate,
 *   public_key: Public Key Hex
 * }
 * @param {string} peer Peer Public Key Hex
 * @returns {{message: string}} Message Text
 */
function liquiditySummary({ alias, inbound, nodes, outbound, peer }) {
  const [, otherNode] = nodes;

  const header = peer ? peerTitle(escape(alias), shortId(peer)) : head;
  const icon = otherNode ? '' : `${ icons.liquidity } `;

  const table = nodes
    .filter(node => {
      const local = outbound.find(n => n.public_key === node.public_key);
      const remote = inbound.find(n => n.public_key === node.public_key);

      return !!local.balance || !!remote.balance;
    })
    .map(node => {
      const local = outbound.find(n => n.public_key === node.public_key);
      const named = escape(node.from).trim();
      const remote = inbound.find(n => n.public_key === node.public_key);

      const from = otherNode ? `_${ icons.liquidity } ${ named }_:\n` : noFrom;

      const rows = [
        [
          'Inbound',
          formatLiquidity(remote.balance),
          formatFee(remote.fee_rate)
        ],
        [
          'Outbound',
          formatLiquidity(local.balance),
          formatFee(local.fee_rate)
        ]
      ];

      return formatReport(from, renderTable(rows, { border, singleLine: true }));
    });

  return { message: `${ icon }${ header }${ table.join('') }` };
}

export default liquiditySummary;
