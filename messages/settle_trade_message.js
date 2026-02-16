import { formatTokens } from './../interface/index.js';

const join = arr => arr.filter(n => !!n).join('\n');
const markup = undefined;
const mode = 'MarkdownV2';
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');

/**
 * Settle trade message
 * @param {{}} args
 * @param {string} args.alias Sold to Node with Alias
 * @param {string} args.description Trade Description
 * @param {string} args.[from] Invoice From Node
 * @param {string} args.to Sold to Node with Identity Public Key Hex
 * @param {number} args.tokens Trade Price
 * @returns {{markup: {}, mode: string, text: string}}
 *   markup: Reply Markup Object
 *   mode: Message Parse Mode
 *   text: Message Text
 */
function settleTradeMessage(args) {
  const memo = !args.description ? '' : `“${ escape(args.description) }”`;
  const to = `${ escape(args.alias) } \`${ args.to }\``.trim();

  const text = join([
    `😎 Sold: ${ escape(formatTokens({ tokens: args.tokens }).display) } ${ memo }`,
    `to ${ to }`,
    `${ escape(args.from || '') }`
  ]);

  return { markup, mode, text };
}

export default settleTradeMessage;
