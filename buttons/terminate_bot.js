import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

import { icons } from './../interface/index.js';

const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const markup = {parse_mode: 'MarkdownV2'};
const shutdownMessage = `${icons.bot} Bot shutting down...`

/**
 * User pressed terminate bot button
 * @param {{}} bot Telegram Bot Object
 * @param {{}} ctx Telegram Context Object
 * @param {function} exit Process Exit Function
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>} via cbk or Promise
 */
function terminateBot({ bot, ctx, exit }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!bot) {
            return cbk([400, 'ExpectedBotObjectToTerminateBot']);
          }

          if (!ctx) {
            return cbk([400, 'ExpectedTelegramContextToTerminateBot']);
          }

          return cbk();
        },

        // Notify the chat that the bot is stopping
        notify: ['validate', async ({}) => {
          return await ctx.reply(escape(shutdownMessage), markup);
        }],

        // Remove the referenced message
        remove: ['validate', async ({}) => await ctx.deleteMessage()],

        // Stop the loading message
        respond: ['validate', async ({}) => await ctx.answerCallbackQuery()],

        // Gracefully stop the bot
        terminateBot: ['notify', 'remove', 'respond', async ({}) => {
          return await bot.stop();
        }],

        // Terminate the process
        exit: ['terminateBot', ({}, cbk) => {
          exit();

          return cbk();
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export default terminateBot;
