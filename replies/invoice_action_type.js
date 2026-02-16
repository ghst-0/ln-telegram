import { parsePaymentRequest } from 'ln-service';

import { callbackCommands, editQuestions, titles } from './../interface/index.js';

const expectedSpacer = '';
const hasInvoicePrefix = n => n.startsWith(titles.createdInvoicePrefix);
const split = n => n.split('\n');

/**
 * Is the message a reply to a created invoice
 * @param {{public_key: string}[]} nodes List of nodes {
 *   public_key: Public Key Hex
 * }
 * @param {string} text Message Text
 * @returns {{type: string}|{}} type: Invoice Action Type
 */
function invoiceActionType({ nodes, text }) {
  // Invoice messages have a specific structure
  if (!text || !hasInvoicePrefix(text)) {
    return {};
  }

  const [, request, spacer, question, other] = split(text);

  if (!request || spacer !== expectedSpacer || !!other) {
    return {};
  }

  if (!invoiceQuestions.includes(question)) {
    return {};
  }

  // The second line of an invoice should be a payment request
  try {
    parsePaymentRequest({ request });
  } catch {
    return {};
  }

  const { destination } = parsePaymentRequest({ request });

  // The invoice destination must match a node
  if (!nodes.some(n => n.public_key === destination)) {
    return {};
  }

  switch (question) {
    case editQuestions.editInvoiceDescription:
      return { type: callbackCommands.setInvoiceDescription };

    case editQuestions.editInvoiceTokens:
      return { type: callbackCommands.setInvoiceTokens };

    default:
      return {};
  }
}

export default invoiceActionType;
