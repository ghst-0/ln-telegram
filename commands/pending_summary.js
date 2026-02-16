import { DateTime } from 'luxon';

import { formatTokens, icons } from './../interface/index.js';

const asRelative = n => n.toRelative({locale: 'en'});
const blocksAsEpoch = blocks => Date.now() + blocks * 1000 * 60 * 10;
const escape = text => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const flatten = arr => [].concat(...arr);
const fromNow = ms => !ms ? undefined : DateTime.fromMillis(ms);
const nodeAlias = (alias, id) => `${alias} ${id.substring(0, 8)}`.trim();
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());
const uniq = arr => Array.from(new Set(arr));

/**
 * Notify of pending channels and HTLCs
 * @param {number} count Nodes Count
 * @param {{
 *   forwarding: {
 *     fee: number
 *     in_peer: string
 *     out_peer: string
 *     tokens: number
 *   }[],
 *   from: string
 *   nodes: {
 *     alias: string
 *     id: string
 *   }[],
 *   sending: {
 *     out_peer: string
 *   }[]
 * }[]} htlcs
 * @param {{
 *   closing: {
 *     partner_public_key: string,
 *     pending_balance: number,
 *     timelock_expiration: number
 *   }[],
 *   from: string,
 *   height: number
 *   nodes: {
 *     alias: string,
 *     id: string
 *   }[],
 *   opening: {
 *     is_partner_initiated: boolean,
 *     local_balance: number,
 *     partner_public_key: string,
 *     remote_balance: number,
 *     transaction_fee: number,
 *     transaction_id: string
 *    }[]
 * }[]} pending {
 *   closing: {
 *     partner_public_key: Peer Public Key Hex,
 *     pending_balance: Pending Balance Tokens,
 *     timelock_expiration: Funds Locked Until Height
 *   },
 *   from: From Node Named,
 *   height: Current Block Height,
 *   nodes: {
 *     alias: Node Alias,
 *     id: Public Key Hex
 *   },
 *   opening: {
 *     is_partner_initiated: Opening Channel is Peer Initiated,
 *     local_balance: Opening Channel Local Balance Tokens,
 *     partner_public_key: Opening Channel With Public Key Hex,
 *     remote_balance: Opening Channel Remote Balance Tokens,
 *     transaction_fee: Commitment Transaction Fee Tokens,
 *     transaction_id: Funding Transaction Id Hex
 *   }
 * }
 * @returns {string[]} Pending Item
 */
function pendingSummary({ count, htlcs, pending }) {
  // Pending closing and opening channels
  const channels = pending.map(node => {
    // Opening channels, waiting for confirmation
    const openingChannels = node.opening
      .map(opening => {
        const direction = !!opening.is_partner_initiated ? 'in' : 'out';
        const funds = [opening.local_balance, opening.remote_balance];
        const peerId = opening.partner_public_key;
        const tx = opening.transaction_id;
        const waiting = `${ icons.opening } Waiting`;

        const capacity = sumOf(funds.concat(opening.transaction_fee));
        const peer = node.nodes.find(n => n.id === peerId);

        const alias = escape(nodeAlias(peer.alias, peer.id));
        const channel = `${ formatTokens({ tokens: capacity }).display } channel`;

        const action = `${ direction }bound ${ escape(channel) }`;

        return `${ waiting } for ${ action } with ${ alias } to confirm: \`${ tx }\``;
      });

    // Closing channels, waiting for coins to return
    const waitingOnFunds = node.closing
      .filter(n => !!n.timelock_expiration && !!n.pending_balance)
      .filter(n => n.timelock_expiration > node.height)
      .map(closing => {
        const funds = formatTokens({ tokens: closing.pending_balance }).display;
        const peerId = closing.partner_public_key;
        const waitBlocks = closing.timelock_expiration - node.height;
        const waiting = `${ icons.closing } Waiting`;

        const peer = node.nodes.find(n => n.id === peerId);
        const time = escape(asRelative(fromNow(blocksAsEpoch(waitBlocks))));

        const action = `recover ${ escape(funds) } ${ time } from closing channel`;
        const alias = nodeAlias(peer.alias, peer.id);

        return `${ waiting } to ${ action } with ${ escape(alias) }`;
      });

    return {
      from: node.from,
      channels: flatten([].concat(openingChannels).concat(waitingOnFunds))
    };
  });

  // HTLCs in flight for probing or for forwarding
  const payments = htlcs.map(node => {
    // Forwarding an HTLC in one peer and out another
    const forwarding = node.forwarding.map(forward => {
      const fee = escape(formatTokens({ tokens: forward.fee }).display);
      const from = node.nodes.find(n => n.id === forward.in_peer);
      const to = node.nodes.find(n => n.id === forward.out_peer);
      const tokens = escape(formatTokens({ tokens: forward.tokens }).display);

      const action = `${ tokens } for ${ fee } fee`;
      const forwarding = `${ icons.forwarding } Forwarding`;
      const inPeer = escape(nodeAlias(from.alias, from.id));
      const outPeer = escape(nodeAlias(to.alias, to.id));

      return `${ forwarding } ${ action } from ${ inPeer } to ${ outPeer }`;
    });

    // Probing out peers
    const probes = uniq(node.sending.map(n => n.out_peer)).map(key => {
      const out = node.nodes.find(n => n.id === key);

      return escape(nodeAlias(out.alias, out.id));
    });

    const probing = !probes.length ?
      [] : [`${ icons.probe } Probing out ${ probes.join(', ') }`];

    return { from: node.from, payments: [].concat(forwarding).concat(probing) };
  });

  const nodes = [];

  // Pending channels for a node
  channels.filter(node => !!node.channels.length).forEach(node => {
    return node.channels.forEach(item => nodes.push({ item, from: node.from }));
  });

  // Pending payments for a node
  payments.filter(n => !!n.payments.length).forEach(node => {
    return node.payments.forEach(item => nodes.push({ item, from: node.from }));
  });

  // Exit early when there is nothing pending for any nodes
  if (!nodes.length) {
    return [`${ icons.bot } No pending payments or channels`];
  }

  const sections = uniq(nodes.map(n => n.from));

  return flatten(sections.map(from => {
    const title = (count <= [from].length) ? [] : [`\n*${ escape(from) }*`];

    return title.concat(nodes.filter(n => n.from === from).map(n => n.item));
  }));
}

export default pendingSummary;
