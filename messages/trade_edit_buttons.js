import { InlineKeyboard } from 'grammy';

import { callbackCommands, labels } from './../interface/index.js';

const nodeLabel = named => `Node: ${named}`;
const shortId = key => key.slice(0, 46);
const switchNode = id => `${callbackCommands.moveTradeNode}${id}`;

/**
 * Create a keyboard with trade edit buttons
 * @param {{}} args
 * @param {boolean} args.is_selecting
 * @param {{from: string, public_key: string}[]} args.nodes {
 *   from: Node Name,
 *   public_key: Node Identity Public Key Hex
 * }
 * @returns {{markup: InlineKeyboard}} Keyboard Markup Object
 */
function tradeEditButtons(args) {
  const markup = new InlineKeyboard();
  const [, otherNode] = args.nodes;

  const buttons = [
    // Edit the trade description
    [
      labels.tradeMessageDescriptionButtonLabel,
      callbackCommands.setTradeDescription
    ],
    // Edit the trade expiry
    [
      labels.tradeMessageExpiresAtLabel,
      callbackCommands.setTradeExpiresAt
    ]
  ];

  // Add the edit buttons
  for (const [label, command] of buttons) {
    markup.text(label, command)
  }

  if (args.is_selecting) {
    markup.text(
      labels.tradeMessageCancelButtonLabel,
      callbackCommands.cancelTrade
    );

    for (const node of args.nodes) {
      markup.row().text(
        nodeLabel(node.from),
        switchNode(shortId(node.public_key))
      )
    }
  }

  if (!args.is_selecting && !!otherNode) {
    markup.text(
      labels.tradeMessageNodeButtonLabel,
      callbackCommands.setTradeNode
    );
  }

  if (!args.is_selecting) {
    markup.text(
      labels.tradeMessageCancelButtonLabel,
      callbackCommands.cancelTrade
    );
  }

  return { markup };
}

export default tradeEditButtons;
