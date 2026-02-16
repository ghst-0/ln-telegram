import { encodeTrade } from 'paid-services';
import { DateTime } from 'luxon';

import { formatTokens, titles } from './../interface/index.js';
import tradeEditButtons from './trade_edit_buttons.js';

const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {fromISO} = DateTime;
const join = arr => arr.filter(n => !!n).join('\n');
const mode = 'MarkdownV2';
const titlePrefix = titles.createdTradePrefix;

/**
 * Created trade message
 * @param {{}} args
 * @param {string} args.from Invoice From Node
 * @param {string} args.description Trade Description
 * @param {string} args.expires_at Trade Expires at ISO 8601 Date
 * @param {string} args.id Trade Id Hex
 * @param {string} args.destination Trade Destination Public Key Hex
 * @param {string} args.network Network Name
 * @param {{from: string, public_key: string}[]} args.nodes {
 *   from: Saved Node Name,
 *   public_key: Public Key Hex
 * }
 * @param {number} args.tokens Trade Price
 * @returns {{markup: {}, mode: string, text: string}} {
 *     markup: Reply Markup Object,
 *     mode: Message Parse Mode,
 *     text: Message Text
 *   }
 */
function createTradeMessage(args) {
  const expiry = escape(fromISO(args.expires_at).toLocaleString());
  const { markup } = tradeEditButtons({ nodes: args.nodes });
  const memo = !args.description ? '' : `“${ escape(args.description) }” `;
  const price = escape(formatTokens({ tokens: args.tokens }).display);

  const { trade } = encodeTrade({
    connect: {
      id: args.id,
      network: args.network,
      nodes: [{ channels: [], id: args.destination, sockets: [] }]
    }
  });

  const text = join([
    `${ escape(titlePrefix) }${ price } ${ memo }expires ${ expiry }`,
    `\`${ trade }\``,
    `${ escape(args.from || '') }`
  ]);

  return { markup, mode, text };
}

export default createTradeMessage;
