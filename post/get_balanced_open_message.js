import asyncAuto from 'async/auto.js';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { icons, formatTokens } from './../interface/index.js';

const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const formatCapacity = tokens => formatTokens({tokens}).display;
const fromName = res => res.alias || res.id.slice(0, 8);
const join = arr => arr.join('\n');

/**
 * Get a message representing a balanced open proposal
 * @param {number} capacity Channel Size Tokens
 * @param {string} from Proposal From Identity Public Key Hex
 * @param {{}} lnd Authenticated LND API Object
 * @param {number} rate Chain Tokens Fee Rate
 * @param {function} cbk Callback function
 * @returns {Promise<{
 *   icon: string,
 *   message: string
 * }>} via cbk or Promise<{
 *   icon: Message Icon,
 *   message: Message
 * }>
 */
function getBalancedOpenMessage({ capacity, from, lnd, rate }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!capacity) {
            return cbk([400, 'ExpectedBalancedProposalCapacityToGetMessage']);
          }

          if (!from) {
            return cbk([400, 'ExpectedProposalFromPublicKeyToGetMessage']);
          }

          if (!lnd) {
            return cbk([400, 'ExpectedLndToGetBalancedOpenMessage']);
          }

          if (!rate) {
            return cbk([400, 'ExpectedFeeRateToGetBalancedOpenMessage']);
          }

          return cbk();
        },

        // Get node alias
        getAlias: ['validate', ({}, cbk) => getNodeAlias({ lnd, id: from }, cbk)],

        // Message to post
        message: ['getAlias', ({ getAlias }, cbk) => {
          const proposal = `${ formatCapacity(capacity) } balanced channel open`;

          const elements = [
            escape(`Received a ${ proposal } proposal from ${ fromName(getAlias) }`),
            `\`${ from }\``,
            `Proposed chain fee rate: ${ rate }/vbyte`
          ];

          return cbk(null, { icon: icons.balanced_open, message: join(elements) });
        }]
      },
      returnResult({ reject, resolve, of: 'message' }, cbk));
  });
}

export default getBalancedOpenMessage;
