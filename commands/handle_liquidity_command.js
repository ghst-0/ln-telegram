import asyncAuto from 'async/auto.js';
import asyncMap from 'async/map.js';
import { findKey } from 'ln-sync';
import { getChannel } from 'ln-service';
import { getChannels } from 'ln-service';
import { getLiquidity } from 'ln-sync';
import { getNodeAlias } from 'ln-sync';
import { returnResult } from 'asyncjs-util';

import { checkAccess } from './../authentication/index.js';
import { icons } from './../interface/index.js';
import interaction from './../interaction.json' with { type: 'json' };
import { liquiditySummary } from './../messages/index.js';

const defaultAlias = '';
const {isArray} = Array;
const markup = {parse_mode: 'MarkdownV2'};
const {max} = Math;
const noLiquidityMessage = `${icons.liquidity} No channel liquidity`;
const uniq = arr => Array.from(new Set(arr));

/** Check peer liquidity

  Syntax of command:

  /liquidity <peer>

  {
    from: <Command From User Id Number>
    id: <Connected User Id Number>
    nodes: [{
      from: <From Name String>
      lnd: <Authenticated LND API Object>
      public_key: <Public Key Hex String>
    }]
    reply: <Reply Function>
    text: <Original Command Text String>
    working: <Working Function>
  }
*/
export default (args, cbk) => {
  return new Promise((resolve, reject) => {
    return asyncAuto({
      // Check arguments
      validate: cbk => {
        if (!args.from) {
          return cbk([400, 'ExpectedFromUserIdNumberForLiquidityCommand']);
        }

        if (!args.id) {
          return cbk([400, 'ExpectedConnectedIdNumberForLiquidityCommand']);
        }

        if (!isArray(args.nodes)) {
          return cbk([400, 'ExpectedNodesForLiquidityCommand']);
        }

        if (!args.reply) {
          return cbk([400, 'ExpectedReplyFunctionForLiquidityCommand']);
        }

        if (!args.text) {
          return cbk([400, 'ExpectedOriginalCommandTextForLiquidityCommand']);
        }

        if (!args.working) {
          return cbk([400, 'ExpectedWorkingFunctionForLiquidityCommand']);
        }

        return cbk();
      },

      // Authenticate the command caller is authorized to this command
      checkAccess: ['validate', ({}, cbk) => {
        return checkAccess({from: args.from, id: args.id}, cbk);
      }],

      // Derive the query if present
      query: ['checkAccess', ({}, cbk) => {
        const [, ...query] = args.text.split(' ');

        return cbk(null, query.join(' '));
      }],

      // Get public key filter
      getKey: ['query', ({query}, cbk) => {
        if (!query) {
          return cbk();
        }

        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getChannels({lnd: node.lnd}, (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            return findKey({
              query,
              channels: res.channels,
              lnd: node.lnd,
            },
            (err, found) => {
              if (!!err) {
                return cbk();
              }

              const channels = res.channels
                .filter(n => n.partner_public_key === found.public_key)
                .map(n => n.id);

              return asyncMap(channels, (id, cbk) => {
                return getChannel({id, lnd: node.lnd}, cbk);
              },
              (err, res) => {
                if (!!err) {
                  return cbk(err);
                }

                return cbk(null, {
                  channels: res,
                  id: found.public_key,
                  node: node.public_key,
                });
              });
            });
          });
        },
        cbk);
      }],

      // Peer alias
      getAlias: ['getKey', ({getKey}, cbk) => {
        const [id] = uniq((getKey || []).filter(n => !!n)).map(n => n.id);

        if (!id) {
          return cbk(null, []);
        }

        return asyncMap(args.nodes, ({lnd}, cbk) => {
          return getNodeAlias({id, lnd}, cbk);
        },
        cbk);
      }],

      // Liquidity with peer
      withPeer: ['getKey', 'query', ({getKey, query}, cbk) => {
        if (!getKey) {
          return cbk();
        }

        const [withPeer, other] = uniq(getKey.filter(n => !!n).map(n => n.id));

        if (!withPeer || !!other) {
          args.reply(interaction.peer_not_found);

          return cbk([404, 'FailedToFindPeerMatch']);
        }

        return cbk(null, withPeer);
      }],

      // Fetch inbound liquidity information
      getInboundLiquidity: [
        'getKey',
        'withPeer',
        ({getKey, withPeer}, cbk) =>
      {
        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getLiquidity({
            lnd: node.lnd,
            with: !!withPeer ? [withPeer] : undefined,
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            const [fees] = (getKey || [])
              .filter(n => !!n)
              .filter(n => n.node === node.public_key)
              .filter(n => n.id === withPeer);

            const channels = !!fees ? fees.channels : [];

            const feeRate = max(...channels
              .map(n => n.policies.find(n => n.public_key !== node.public_key))
              .filter(n => !!n && n.fee_rate !== undefined)
              .map(n => n.fee_rate));

            return cbk(null, {
              balance: res.tokens.reduce((sum, n) => sum + n, Number()),
              fee_rate: isFinite(feeRate) ? feeRate : undefined,
              public_key: node.public_key,
            });
          });
        },
        cbk);
      }],

      // Fetch outbound liquidity information
      getOutboundLiquidity: [
        'getKey',
        'withPeer',
        ({getKey, withPeer}, cbk) =>
      {
        args.working();

        return asyncMap(args.nodes, (node, cbk) => {
          return getLiquidity({
            lnd: node.lnd,
            is_outbound: true,
            with: !!withPeer ? [withPeer] : undefined,
          },
          (err, res) => {
            if (!!err) {
              return cbk(err);
            }

            const [fees] = (getKey || [])
              .filter(n => !!n)
              .filter(n => n.node === node.public_key)
              .filter(n => n.id === withPeer);

            const channels = !!fees ? fees.channels : [];

            const feeRate = max(...channels
              .map(n => n.policies.find(n => n.public_key === node.public_key))
              .filter(n => !!n && n.fee_rate !== undefined)
              .map(n => n.fee_rate));

            return cbk(null, {
              balance: res.tokens.reduce((sum, n) => sum + n, Number()),
              fee_rate: isFinite(feeRate) ? feeRate : undefined,
              public_key: node.public_key,
            });
          });
        },
        cbk);
      }],

      // Put together liquidity report
      liquidity: [
        'getAlias',
        'getInboundLiquidity',
        'getOutboundLiquidity',
        'withPeer',
        async ({
          getAlias,
          getInboundLiquidity,
          getOutboundLiquidity,
          withPeer,
        },
        cbk) =>
      {
        const [alias] = getAlias.map(n => n.alias).filter(n => !!n);

        const {message} = liquiditySummary({
          alias: alias || defaultAlias,
          inbound: getInboundLiquidity,
          nodes: args.nodes,
          outbound: getOutboundLiquidity,
          peer: withPeer,
        });

        return await args.reply(message, markup);
      }],
    },
    returnResult({reject, resolve}, cbk));
  });
};
