import test from 'node:test';
import { rejects } from 'node:assert/strict';

import { postUpdatedBackup } from '../../post/index.js';

const makeArgs = overrides => {
  const args = {
    backup: '00',
    id: 1,
    node: {
      alias: 'alias',
      public_key: Buffer.alloc(33).toString('hex'),
    },
    send: (id, file) => new Promise((resolve, reject) => resolve()),
  };

  for (const k of Object.keys(overrides)) {
    args[k] = overrides[k]
  }

  return args;
};

const tests = [
  {
    args: makeArgs({backup: undefined}),
    description: 'Posting an updated backup requires a backup',
    error: [400, 'ExpectedBackupFileToPostUpdatedBackup'],
  },
  {
    args: makeArgs({id: undefined}),
    description: 'Posting an updated backup requires a user id',
    error: [400, 'ExpectedIdToPostUpdatedBackup'],
  },
  {
    args: makeArgs({node: undefined}),
    description: 'Posting an updated backup requires node details',
    error: [400, 'ExpectedNodeToPostUpdatedBackup'],
  },
  {
    args: makeArgs({send: undefined}),
    description: 'Posting an updated backup requires a send function',
    error: [400, 'ExpectedSendFunctionToPostUpdatedBackup'],
  },
  {
    args: makeArgs({}),
    description: 'An updated backup is posted',
  },
];

for (const { args, description, error, expected } of tests) {
  test(description, async () => {
    if (error) {
      await rejects(postUpdatedBackup(args), error, 'Got expected error');
    } else {
      await postUpdatedBackup(args);
    }
  })
}
