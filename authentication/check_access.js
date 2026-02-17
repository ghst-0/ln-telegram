import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

/**
 * Check access to private commands
 * @param {number} from Source User Id
 * @param {number} id Connected User Id
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function checkAccess({ from, id }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdToCheckAccess']);
          }

          return cbk();
        },

        // Check access
        checkAccess: ['validate', ({}, cbk) => {
          if (!id || from !== id) {
            return cbk([401, 'CommandRequiresConnectCode']);
          }

          return cbk();
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default checkAccess;
