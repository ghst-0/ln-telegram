import { InlineKeyboard } from 'grammy';
import { parsePaymentRequest } from 'ln-service';

import { callbackCommands, formatTokens, labels, titles } from './../interface/index.js';

const {cancelInvoice} = callbackCommands;
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const {invoiceMessageCancelButtonLabel} = labels;
const {invoiceMessageDescriptionButtonLabel} = labels;
const {invoiceMessageNodeButtonLabel} = labels;
const {invoiceMessageSetTokensButtonLabel} = labels;
const join = arr => arr.filter(n => !!n).join('\n');
const mode = 'MarkdownV2';
const {setInvoiceDescription} = callbackCommands;
const {setInvoiceNode} = callbackCommands;
const {setInvoiceTokens} = callbackCommands;

/**
 * Create an invoice message
 * @param {string} [from] Invoice From Node
 * @param {string} request BOLT 11 Payment Request
 * @returns {{markup: InlineKeyboard, mode: string, text: string}} {
*    markup: Reply Markup Object,
 *   mode: Message Parse Mode,
 *   text: Message Text
 * }
 */
function createInvoiceMessage({ from, request }) {
  const markup = new InlineKeyboard();

  const { description, tokens } = parsePaymentRequest({ request });

  markup.text(invoiceMessageDescriptionButtonLabel, setInvoiceDescription);
  markup.text(invoiceMessageSetTokensButtonLabel, setInvoiceTokens);

  if (from) {
    markup.text(invoiceMessageNodeButtonLabel, setInvoiceNode);
  }

  markup.text(invoiceMessageCancelButtonLabel, cancelInvoice);

  const memo = description ? `“${ description }”` : '';

  const title = escape(titles.createdInvoicePrefix);
  const amount = escape(formatTokens({ tokens }).display);

  const text = join([
    `${ title }${ amount } ${ escape(memo) }`,
    `\`${ escape(request) }\``,
    `${ escape(from || '') }`
  ]);

  return { markup, mode, text };
}

export default createInvoiceMessage;
