import asyncAuto from 'async/auto.js';
import asyncEach from 'async/each.js';
import asyncMap from 'async/map.js';
import { getBackups } from 'ln-service';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from '../authentication/index.js';

const date = () => new Date().toISOString().slice(0, 10);
const hexAsBuffer = hex => Buffer.from(hex, 'hex');
const {isArray} = Array;

/**
 * Execute backup command
 * @param {number} from Command From User Id
 * @param {number} id Connected User Id
 * @param {{alias: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   alias: Node Alias,
 *   from: Saved Node Name,
 *   lnd: Authenticated LND API Object
 * }
 * @param {function} reply Reply Function
 * @param {function} send Send Document Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function handleBackupCommand({ from, id, nodes, reply, send }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdToExecuteBackupCommand']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedNodesArrayToExecuteBackupCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionToExecuteBackupCommand']);
          }

          if (!send) {
            return cbk([[400, 'ExpectedSendDocumentFunctionToHandleBackupCmd']]);
          }

          return cbk();
        },

        // Check access
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Get backups and send them as documents
        getBackups: ['checkAccess', ({}, cbk) => {
          return asyncMap(nodes, (node, cbk) => {
              return getBackups({ lnd: node.lnd }, (err, res) => {
                if (err) {
                  return cbk(err);
                }

                return cbk(null, {
                  alias: node.alias,
                  backup: res.backup,
                  channels: res.channels,
                  public_key: node.public_key
                });
              });
            },
            cbk);
        }],

        // Post the backups
        postBackups: ['getBackups', async ({ getBackups }) => {
          return await asyncEach(getBackups, async (node) => {
            const channels = `${ node.channels.length } channels`;
            const filename = `${ date() }-${ node.alias }-${ node.public_key }`;
            const named = `${ node.alias } ${ node.public_key }`;

            return await send({
                filename: `${ filename }.backup`,
                source: hexAsBuffer(node.backup)
              },
              {
                caption: `Backup for ${ channels } on ${ named }`
              });
          });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleBackupCommand;
