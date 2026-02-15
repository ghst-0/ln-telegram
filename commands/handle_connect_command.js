import interaction from './../interaction.json' with { type: 'json' };

/** Handle connect command

  Syntax of command:

  /connect

  {
    from: <Message From User Id Number>
    [id]: <Connected User Id Number>
    reply: <Reply Function>
  }
*/
export default ({from, id, reply}) => {
  if (!!id) {
    return reply(interaction.bot_is_connected);
  }

  return reply(`🤖 Connection code is: \`${from}\``);
};
