import interaction from './../interaction.json' with { type: 'json' };

/**
 * Handle start command
 * @param {number} [id] Connected User Id
 * @param {function} reply Reply to Telegram Context Function
 * @returns {*}
 */
function handleStartCommand({ id, reply }) {
  // Exit early when the bot is already connected
  if (!!id) {
    return reply(interaction.bot_is_connected);
  }

  return reply(interaction.start_message);
}

export default handleStartCommand;
