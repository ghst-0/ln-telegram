import asyncAuto from 'async/auto.js';
import { returnResult } from 'asyncjs-util';

const {isArray} = Array;

/**
 * Decode the command text
 * @param {{}} help
 * @param {string} help.select_node_text Select Node Help
 * @param {string} help.syntax_example_text Syntax Example
 * @param {{from: string, lnd: {}, public_key: string}[]} nodes List of nodes {
 *   from: Saved Node Name,
 *   lnd: Authenticated LND API Object
 * }
 * @param {function} reply Reply Function
 * @param {string} text Original Command Text
 * @param {function} cbk Callback function
 * @returns {Promise<{lnd: {}, params: string[]}>} via cbk or Promise
 *   lnd: <Authenticated LND gRPC API Object>
 *   params: [<Parameter>]
 */
function decodeCommand({ help, nodes, reply, text }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        // Check arguments
        validate: cbk => {
          if (!help) {
            return cbk([400, 'ExpectedHelpTextToDecodeCommand']);
          }

          if (!isArray(nodes)) {
            return cbk([400, 'ExpectedNodesWhenDecodingCommand']);
          }

          if (!reply) {
            return cbk([400, 'ExpectedReplyFunctionToDecodeCommand']);
          }

          if (!text) {
            return cbk([400, 'ExpectedCommandTextToDecodeCommand']);
          }

          return cbk();
        },

        // Decoded elements
        decoded: ['validate', ({}, cbk) => {
          const [defaultNode] = nodes;
          const elements = text.split(' ').slice(1);

          const isMulti = nodes.length > [defaultNode].length;
          const [nodeIndex] = elements;

          const selectedNode = nodes[Number(nodeIndex || 1) - 1];

          const node = !isMulti ? defaultNode : selectedNode;

          // Exit early when the node to use is unknown
          if (!node || (nodes.length > [node].length && !nodeIndex)) {
            const syntax = help.syntax_example_text.split(' ');

            syntax.splice(1, 0, '<node #>');

            const text = []
              .concat([help.select_node_text])
              .concat(nodes.map(({ from }, i) => `- ${ i + 1 }: ${ from }`))
              .concat([syntax.join(' ')]);

            reply(text.join('\n'));

            return cbk([400, 'UnknownNodeToUseForCommand']);
          }

          const params = nodes.length === 1 ? elements : elements.slice(1);

          return cbk(null, { params, lnd: node.lnd })
        }]
      },
      returnResult({ reject, resolve, of: 'decoded' }, cbk));
  });
}

export default decodeCommand;
