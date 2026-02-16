import replyActionType from './reply_action_type.js';

/**
 * Determine if a message is a contextual reply that requires a reply action
 * @param {{}} ctx Telegram Context Object
 * @param {{public_key: string}[]} nodes List of nodes {
 *   public_key: Public Key Hex
 * }
 * @returns {boolean} Message is a Reply to Message Action
 */
function isMessageReplyAction({ ctx, nodes }) {
  if (!ctx || !ctx.update || !ctx.update.message) {
    return false;
  }

  if (!ctx.update.message.reply_to_message) {
    return false;
  }

  const { text } = ctx.update.message.reply_to_message;

  // Reply action messages must fit a specific type
  if (!text || !replyActionType({ nodes, text }).type) {
    return false;
  }

  return true;
}

export default isMessageReplyAction;
