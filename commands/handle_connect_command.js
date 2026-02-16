import interaction from './../interaction.json' with { type: 'json' };

/**
 * Handle connect command
 * @param {number} from Message From User Id
 * @param {number} [id] Connected User Id
 * @param {function} reply Reply to Telegram Context Function
 * @returns {*}
 */
function handleConnectCommand({ from, id, reply }) {
  if (!!id) {
    return reply(interaction.bot_is_connected);
  }

  return reply(`🤖 Connection code is: \`${ from }\``);
}

export default handleConnectCommand;
