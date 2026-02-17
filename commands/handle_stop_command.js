import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { stopBotMessage } from './../messages/index.js';

/**
 * Execute stop command to stop the bot
 * @param {number} from Command From User Id
 * @param {number} id Connected User Id
 * @param {function} reply Reply to Telegram Context Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function handleStopCommand({ from, id, reply }, cbk) {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!from) {
            return cbk([400, 'ExpectedFromUserIdToExecuteStopCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionToExecuteStopCommand']);
          }

          return cbk();
        },

        // Confirm the connected user issued the command
        checkAccess: ['validate', ({}, cbk) => checkAccess({ from, id }, cbk)],

        // Notify the chat that the bot would stop
        notify: ['checkAccess', async ({}) => {
          const { markup, mode, text } = stopBotMessage({});

          return await reply(text, { parse_mode: mode, reply_markup: markup });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default handleStopCommand;
