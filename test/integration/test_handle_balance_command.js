import test from 'node:test';
import { deepEqual } from 'node:assert/strict';
import { setupChannel, spawnLightningCluster } from 'ln-docker-daemons';

import { handleBalanceCommand } from './../../index.js';

const size = 2;

// Issuing a balance command should return a balance response
test(`Handle balance command`, async () => {
  const {kill, nodes} = await spawnLightningCluster({size});
  const replies = [];

  const [{generate, id, lnd}, target] = nodes;

  try {
    await setupChannel({generate, lnd, give_tokens: 1e3, to: target});

    await handleBalanceCommand({
      from: 1,
      id: 1,
      nodes: [
        {lnd, from: 'control', public_key: id},
        {from: 'target', lnd: target.lnd, public_key: target.id},
      ],
      reply: (message) => replies.push(message.split('\n')),
      working: () => {},
    });

    deepEqual(replies.length, 1, 'Balance summary is posted');

    await kill({});
  } catch (err) {
    await kill({});

    deepEqual(err, null, 'Expected no error');
  }
});
