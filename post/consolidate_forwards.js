const keyForPair = n => `${n.incoming_channel}:${n.outgoing_channel}`;
const {keys} = Object;
const mtokensAsTokens = n => Number(n) / 1e3;

/**
 * Consolidate a set of forwards to combine similar forwards together
 * @param {{
 *   forwards: {
 *     fee_mtokens: string
 *     incoming_channel: string,
 *     mtokens: string,
 *     outgoing_channel: string
 *   }[]
 * }} forwards {
 *   fee_mtokens: Forward Fee Millitokens Earned,
 *   incoming_channel: Standard Format Incoming Channel Id,
 *   mtokens: Forwarded Millitokens,
 *   outgoing_channel: Standard Format Outgoing Channel Id
 * }
 * @returns {{
 *   forwards: {
 *     fee_mtokens: string
 *     incoming_channel: string,
 *     outgoing_channel: string,
 *     tokens: number
 *   }[]
 * }} {
 *   fee: Forward Fee Tokens Earned,
 *   incoming_channel: Standard Format Incoming Channel Id,
 *   outgoing_channel: Standard Format Outgoing Channel Id,
 *   tokens: Forwarded Tokens
 * }
 */
function consolidateForwards({ forwards }) {
  const unique = forwards.reduce((sum, forward) => {
      const fee = mtokensAsTokens(forward.fee_mtokens);
      const tokens = mtokensAsTokens(forward.mtokens);
      const pair = keyForPair(forward);

      sum[pair] = sum[pair] || {};

      sum[pair].fee = (sum[pair].fee || Number()) + fee;
      sum[pair].incoming_channel = forward.incoming_channel;
      sum[pair].outgoing_channel = forward.outgoing_channel;
      sum[pair].tokens = (sum[pair].tokens || Number()) + tokens;

      return sum;
    },
    {});

  return { forwards: keys(unique).map(key => unique[key]) };
}

export default consolidateForwards;
