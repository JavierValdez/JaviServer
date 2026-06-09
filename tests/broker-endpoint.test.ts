import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WINDOWS_AGENT_BROKER_ENDPOINT } from '../electron/agent/broker-endpoint';

test('Windows broker endpoint uses the canonical named pipe path', () => {
  assert.equal(WINDOWS_AGENT_BROKER_ENDPOINT, '\\\\.\\pipe\\javiserver-agent-broker');
  assert.deepEqual([...WINDOWS_AGENT_BROKER_ENDPOINT].slice(0, 5), ['\\', '\\', '.', '\\', 'p']);
});
