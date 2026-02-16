import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

const date = () => new Date().toISOString().substring(0, 10);
const hexAsBuffer = hex => Buffer.from(hex, 'hex');

/**
 * Post updated backup to Telegram
 * @param {string} backup Backup File Hex
 * @param {number} id Connected User Id
 * @param {{}} node
 * @param {string} node.alias Node Alias
 * @param {string} node.public_key Public Key Hex
 * @param {function} send Send File Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function postUpdatedBackup({ backup, id, node, send }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!backup) {
            return cbk([400, 'ExpectedBackupFileToPostUpdatedBackup']);
          }

          if (!id) {
            return cbk([400, 'ExpectedIdToPostUpdatedBackup']);
          }

          if (!node) {
            return cbk([400, 'ExpectedNodeToPostUpdatedBackup']);
          }

          if (!send) {
            return cbk([400, 'ExpectedSendFunctionToPostUpdatedBackup']);
          }

          return cbk();
        },

        // Post the backup file
        post: ['validate', ({}, cbk) => {
          const filename = `${ date() }-${ node.alias }-${ node.public_key }.backup`;

          return (async () => {
            try {
              await send(id, { filename, source: hexAsBuffer(backup) });

              return cbk();
            } catch (err) {
              return cbk([503, 'UnexpectedErrorSendingBackupFileUpdate', { err }]);
            }
          })();
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default postUpdatedBackup;
