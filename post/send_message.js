import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

const api = 'https://api.telegram.org';
const ok = 200;
const parseMode = 'markdown';

/**
 * Send message to Telegram
 * @param {string} id Chat Id
 * @param {string} key API Key
 * @param {function} request Request Function
 * @param {string} text Message Text
 * @param {function} cbk Callback function
 * @returns {Promise<unknown>}
 */
const sendMessage = ({ id, key, request, text }, cbk) => {
  return new Promise((resolve, reject) => {
    asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!id) {
            return cbk([400, 'ExpectedChatIdToSendMessageToRocketChat']);
          }

          if (!key) {
            return cbk([400, 'ExpectedApiKeyToSendMessageToRocketChat']);
          }

          if (!request) {
            return cbk([400, 'ExpectedRequestFunctionToSendMessageToRocketChat']);
          }

          if (!text) {
            return cbk([400, 'ExpectedTextOfMessageToSendToRocketChat']);
          }

          return cbk();
        },

        // Send message
        send: ['validate', ({}, cbk) => {
          return request({
              qs: {
                text,
                chat_id: id,
                parse_mode: parseMode,
                disable_web_page_preview: true
              },
              url: `${ api }/bot${ key }/sendMessage`
            },
            (err, r, body) => {
              if (err) {
                return cbk([503, 'FailedToConnectToRocketChatToSendMessage', { err }]);
              }

              if (!r) {
                return cbk([503, 'ExpectedResponseFromRocketChatSendMessage']);
              }

              if (r.statusCode !== ok) {
                return cbk();
              }

              return cbk(null, true);
            });
        }],

        // Send message without format in case the first send didn't work
        sendNormal: ['send', ({ send }, cbk) => {
          // Exit early when regular send worked
          if (send) {
            return cbk();
          }

          return request({
              qs: { text, chat_id: id, disable_web_page_preview: true },
              url: `${ api }/bot${ key }/sendMessage`
            },
            (err, r, body) => {
              if (err) {
                return cbk([503, 'FailedToConnectToRocketChatApiToSend', { err }]);
              }

              if (!r) {
                return cbk([503, 'ExpectedResponseFromRocketChatSend']);
              }

              if (r.statusCode !== ok) {
                return cbk([503, 'UnexpectedStatusCodeFromRocketChat', { body }]);
              }

              return cbk();
            });
        }]
      },
      returnResult({ reject, resolve }, cbk));
  });
}

export { sendMessage };
