const flatten = arr => [].concat(...arr);

/**
 * Derive pending forwards from a list of pending payments
 * @param {{
 *   id: string,
 *   partner_public_key: string,
 *   pending_payments: [{
 *     id: string
 *     [in_channel]: string,
 *     [in_payment]: number,
 *     [is_forward]: boolean,
 *     is_outgoing: boolean,
 *     [out_channel]: string,
 *     [out_payment]: number,
 *     [payment]: number,
 *     timeout: number,
 *     tokens: number
 *   }]
 * }[]} channels {
 *   id: Channel Id,
 *   partner_public_key: Peer Public Key Hex,
 *   pending_payments: {
 *     id: Payment Preimage Hash Hex,
 *     [in_channel]: Forward Inbound From Channel Id,
 *     [in_payment]: Payment Index on Inbound Channel,
 *     [is_forward]: Payment is a Forward,
 *     is_outgoing: Payment Is Outgoing,
 *     [out_channel]: Forward Outbound To Channel Id,
 *     [out_payment]: Payment Index on Outbound Channel,
 *     [payment]: Payment Attempt Id,
 *     timeout: Chain Height Expiration,
 *     tokens: Payment Tokens
 *   }[]
 * }
 * @returns {{
 *   forwarding: {
 *     fee: number,
 *     in_peer: string,
 *     out_peer: string,
 *     payment: string,
 *     timeout: number,
 *     tokens: number
 *   }[],
 *   sending: {
 *     out_channel: string,
 *     out_peer: string,
 *     timeout: number,
 *     tokens: number
 *   }[]
 * }} {
 *   out_channel: Sending Out Channel Id,
 *   out_peer: Sending Out Peer Public Key Hex,
 *   timeout: Sending Timeout Block Height,
 *   tokens: Sending Tokens Amount
 * }
 */
function pendingPayments({ channels }) {
  // Collect all the outbound type HTLCs
  const sending = flatten(channels.map(channel => {
    return (channel.pending_payments || [])
      .filter(n => !n.is_forward && !!n.is_outgoing)
      .map(payment => ({
        out_channel: channel.id,
        out_peer: channel.partner_public_key,
        timeout: payment.timeout,
        tokens: payment.tokens
      }));
  }));

  // Collect all the forwarding type HTLCs
  const forwards = flatten(channels.map(channel => {
    return (channel.pending_payments || [])
      .filter(n => !!n.is_forward)
      .filter(n => !!n.in_channel || !!n.out_channel)
      .filter(n => !!n.in_payment || !!n.out_payment)
      .map(payment => ({
        channel: channel.id,
        id: payment.id,
        in_channel: payment.in_channel,
        in_payment: payment.in_payment,
        is_outgoing: payment.is_outgoing,
        payment: payment.payment,
        timeout: payment.timeout,
        tokens: payment.tokens
      }));
  }));

  // Outbound forwarding HTLCs
  const outbound = forwards
    // Outbound forwards have inbound channels and inbound payment indexes
    .filter(n => !!n.in_channel && !!n.in_payment && !!n.is_outgoing)
    // Only evaluate forwards where the inbound channel exists in channels
    .filter(htlc => channels.find(channel => channel.id === htlc.in_channel))
    // Only evaluate forwards wherre the inbound payment exists in the payments
    .filter(htlc => forwards.find(n => n.payment === htlc.in_payment))

  // HTLCs that are being routed
  const forwarding = outbound.map(htlc => {
    const inboundChannel = channels.find(n => n.id === htlc.in_channel);
    const inboundPayment = forwards.find(n => n.payment === htlc.in_payment);
    const outboundChannel = channels.find(n => n.id === htlc.channel);

    return {
      fee: inboundPayment.tokens - htlc.tokens,
      in_peer: inboundChannel.partner_public_key,
      out_peer: outboundChannel.partner_public_key,
      payment: htlc.id,
      timeout: inboundPayment.timeout,
      tokens: htlc.tokens
    };
  });

  return { forwarding, sending };
}

export default pendingPayments;
