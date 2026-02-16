import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import interaction from './../interaction.json' with { type: 'json' };
import { checkAccess } from './../authentication/index.js';

const failedToGetLatestVersion = `${interaction.bot} Failed to get latest version information from NPM`;
const currentVersion = n => `${interaction.bot} Running version: ${n}`;
const latestVersion = n => `${interaction.bot} Latest version: ${n}`;
const ok = 200;
const url = n => `https://registry.npmjs.org/${n}/latest`;

/**
 * Handle the mempool command
 * @param {number} from Command From User Id
 * @param {number} id Connected User Id
 * @param {string} named Name To Look Up
 * @param {function} reply Reply to Telegram Context Function
 * @param {function} request Request Function
 * @param {string} version Current Version
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function handleVersionCommand({ from, id, named, reply, request, version }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdNumberForVersionCommand']);
          }

          if (!named) {
            return cbk([400, 'ExpectedPackageNameStringToHandleVersionCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionToHandleVersionCommand']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionToHandleVersionCommand']);
          }

          if (!version) {
            return cbk([400, 'ExpectedVersionStringToHandleVersionCommand']);
          }

          return cbk();
        },

        // Authenticate the command caller is authorized to this command
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Get version from NPM
        getVersion: ['checkAccess', ({}, cbk) => {
          reply(currentVersion(version));

          return request({ json: true, url: url(named) }, (err, r, pkg) => {
            if (!!err || !r || r.statusCode !== ok || !pkg || !pkg.version) {
              reply(failedToGetLatestVersion);

              return cbk();
            }

            reply(latestVersion(pkg.version));

            return cbk();
          });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleVersionCommand;
