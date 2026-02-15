import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';
import { subscribeToBlocks } from 'goldengate';

import { checkAccess } from './../authentication/index.js';
import interaction from './../interaction.json' with { type: 'json' };

const delay = 1000 * 60;
const join = arr => arr.join('. ');
const network = 'btc';

/** Get notified on a block

  Syntax of command:

  /blocknotify

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    reply: <Reply Function>
    request: <Request Function>
  }

  @returns via cbk or Promise
*/
function handleBlocknotifyCommand({ from, id, reply, request }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdToHandleBlockNotifyCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionToHandleBlockNotifyCommand']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionToHandleBlocknotifyCmd']);
          }

          return cbk();
        },

        // Confirm the connected user issued the command
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Wait for block
        wait: ['checkAccess', ({}, cbk) => {
          let currentHeight;
          const sub = subscribeToBlocks({ delay, network, request });

          sub.on('block', ({ height }) => {
            const heightMessage = `Chain height is now ${ height }`;

            // Exit early when there is no current height
            if (!currentHeight) {
              currentHeight = height;

              return reply(join([
                interaction.requesting_block_notification,
                heightMessage
              ]));
            }

            reply(join([interaction.block_notification, heightMessage]));

            sub.removeAllListeners();

            return cbk();
          });

          sub.on('error', err => {
            sub.removeAllListeners();

            return cbk([503, 'UnexpectedErrorGettingBlock', { err }]);
          });

          return;
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleBlocknotifyCommand;
