import invoiceActionType from './invoice_action_type.js';
import tradeActionType from './trade_action_type.js';

/** Determine the type of a reply action, if any

  {
    nodes: [{
      public_key: <Node Public Key Hex String>
    }]
    text: <Message Text String>
  }

  @returns
  {
    [type]: <Type String>
  }
*/
export default ({nodes, text}) => {
  if (!!invoiceActionType({nodes, text}).type) {
    return {type: invoiceActionType({nodes, text}).type};
  }

  if (!!tradeActionType({nodes, text}).type) {
    return {type: tradeActionType({nodes, text}).type};
  }

  return {};
};
