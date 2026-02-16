import test from 'node:test';
import { deepEqual } from 'node:assert/strict';
import asyncRetry from 'async/retry.js';
import { getNode } from 'lightning';
import { setupChannel, spawnLightningCluster } from 'ln-docker-daemons';

import { handleLiquidityCommand } from './../../index.js';

const interval = 10;
const size = 2;
const times = 10000;

// Issuing a liquidity command should return a liquidity response
test(`Handle liquidity command`, async () => {
  const {kill, nodes} = await spawnLightningCluster({size});
  const replies = [];

  const [{generate, id, lnd}, target] = nodes;

  try {
    await setupChannel({generate, lnd, to: target});

    // Wait for target graph announcement
    await asyncRetry({interval, times}, async () => {
      if (!(await getNode({lnd, public_key: target.id})).alias) {
        throw new Error('ExpectedNodeAliasFoundInGraph');
      }
    });

    await handleLiquidityCommand({
      from: 1,
      id: 1,
      nodes: [{lnd, from: 'from', public_key: id}],
      reply: (message) => replies.push(message.split('\n')),
      text: `/liquidity ${target.id}`,
      working: () => {},
    });

    deepEqual(replies, [[
      `🌊 *Liquidity with ${target.id.slice(0, 20)} ${target.id.slice(0, 8)}:*`,
      '',
      '```',
      ' Inbound   -           0.00% (1) ',
      ' Outbound  0.00996530  0.00% (1) ',
      '',
      '```'
    ]],
    'Liquidity summary is posted');
  } catch (err) {
    deepEqual(err, null, 'Expected no error');
  }

  await kill({});
});
