import invoiceActionType from './invoice_action_type.js';
import tradeActionType from './trade_action_type.js';

/**
 * Determine the type of a reply action, if any
 * @param {{public_key: string}[]} nodes List of nodes {
 *   public_key: Public Key Hex
 * }
 * @param {string} text Message Text
 * @returns {{type?: string}}
 */
function replyActionType({ nodes, text }) {
  if (!!invoiceActionType({ nodes, text }).type) {
    return { type: invoiceActionType({ nodes, text }).type };
  }

  if (!!tradeActionType({ nodes, text }).type) {
    return { type: tradeActionType({ nodes, text }).type };
  }

  return {};
}

export default replyActionType;
