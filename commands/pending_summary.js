import { formatTokens, icons } from '../interface/index.js';

const blocksAsEpoch = blocks => Date.now() + blocks * 1000 * 60 * 10;
const escape = text => text.replaceAll(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\\$&');
const flatten = arr => [].concat(...arr);
const nodeAlias = (alias, id) => `${alias} ${id.slice(0, 8)}`.trim();
const sumOf = arr => arr.reduce((sum, n) => sum + n, Number());
const uniq = arr => Array.from(new Set(arr));


const units = {
  year  : 24 * 60 * 60 * 1000 * 365,
  month : 24 * 60 * 60 * 1000 * 365/12,
  day   : 24 * 60 * 60 * 1000,
  hour  : 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const getRelativeTime = (d1, d2 = new Date()) => {
  const elapsed = d1 - d2
  for (let u in units)
    if (Math.abs(elapsed) > units[u] || u === 'second')
      return rtf.format(Math.round(elapsed / units[u]), u)
}


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
        const direction = opening.is_partner_initiated ? 'in' : 'out';
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
        const time = getRelativeTime(blocksAsEpoch(waitBlocks));

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

    const probing = probes.length === 0 ?
      [] : [`${ icons.probe } Probing out ${ probes.join(', ') }`];

    return { from: node.from, payments: [].concat(forwarding).concat(probing) };
  });

  const nodes = [];

  // Pending channels for a node
  for (const node1 of channels.filter(node => node.channels.length > 0)) {
    for (const item of node1.channels) {
      nodes.push({ item, from: node1.from })
    }
  }

  // Pending payments for a node
  for (const node of payments.filter(n => n.payments.length > 0)) {
    for (const item of node.payments) {
      nodes.push({ item, from: node.from })
    }
  }

  // Exit early when there is nothing pending for any nodes
  if (nodes.length === 0) {
    return [`${ icons.bot } No pending payments or channels`];
  }

  const sections = uniq(nodes.map(n => n.from));

  return flatten(sections.map(from => {
    const title = (count <= [from].length) ? [] : [`\n*${ escape(from) }*`];

    return title.concat(nodes.filter(n => n.from === from).map(n => n.item));
  }));
}

export default pendingSummary;
