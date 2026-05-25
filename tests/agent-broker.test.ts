import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { AgentBrokerClient } from '../electron/agent/broker-client';
import { AgentBrokerServer } from '../electron/agent/broker';

const tempDirs: string[] = [];

function createEndpoint(): string {
  const dir = mkdtempSync(join(tmpdir(), 'javiserver-broker-test-'));
  tempDirs.push(dir);
  return join(dir, `${randomUUID()}.sock`);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('broker authenticates valid clients and supports parallel sessions', async () => {
  const endpoint = createEndpoint();
  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async (_session, request) => ({ method: request.method }),
  });
  await server.start();

  const clientA = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'a',
    clientName: 'A',
  });
  const clientB = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'b',
    clientName: 'B',
  });
  await Promise.all([clientA.connect(), clientB.connect()]);

  assert.equal(server.listSessions().length, 2);
  assert.deepEqual(await clientA.request('ping'), { method: 'ping' });

  await Promise.all([clientA.close(), clientB.close()]);
  await server.stop();
});

test('broker rejects invalid tokens and closes sessions when disconnected', async () => {
  const endpoint = createEndpoint();
  let token = 'secret';
  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => token,
    handleRequest: async () => true,
  });
  await server.start();

  const invalid = new AgentBrokerClient({
    endpoint,
    token: 'wrong',
    clientId: 'bad',
    clientName: 'Bad',
  });
  await assert.rejects(() => invalid.connect(), /Token MCP invalido/);

  const valid = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'good',
    clientName: 'Good',
  });
  await valid.connect();
  assert.equal(server.listSessions().length, 1);

  token = 'rotated';
  server.disconnectAll();
  assert.equal(server.listSessions().length, 0);

  const stale = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'stale',
    clientName: 'Stale',
  });
  await assert.rejects(() => stale.connect(), /Token MCP invalido/);

  const rotated = new AgentBrokerClient({
    endpoint,
    token: 'rotated',
    clientId: 'rotated',
    clientName: 'Rotated',
  });
  await rotated.connect();
  assert.equal(server.listSessions().length, 1);

  await rotated.close();
  await server.stop();
});

test('broker does not replace an active Unix socket', { skip: process.platform === 'win32' }, async () => {
  const endpoint = createEndpoint();
  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async (_session, request) => ({ method: request.method }),
  });
  await server.start();

  const duplicate = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async () => true,
  });

  try {
    await assert.rejects(() => duplicate.start(), /broker MCP activo/);

    const client = new AgentBrokerClient({
      endpoint,
      token: 'secret',
      clientId: 'after-duplicate',
      clientName: 'After Duplicate',
    });
    await client.connect();
    assert.deepEqual(await client.request('ping'), { method: 'ping' });
    await client.close();
  } finally {
    await server.stop();
  }
});

test('broker forwards request progress to connected clients', async () => {
  const endpoint = createEndpoint();
  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async (_session, _request, emitProgress) => {
      emitProgress({ searched: 1, total: 2 });
      return { ok: true };
    },
  });
  await server.start();

  const client = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'progress',
    clientName: 'Progress',
  });
  await client.connect();

  const progress: unknown[] = [];
  assert.deepEqual(await client.request('search_files', {}, {
    onProgress: (value) => progress.push(value),
  }), { ok: true });
  assert.deepEqual(progress, [{ searched: 1, total: 2 }]);

  await client.close();
  await server.stop();
});

test('broker client can reconnect after an initial failed connection attempt', async () => {
  const endpoint = createEndpoint();
  const client = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'retry',
    clientName: 'Retry',
  });

  await assert.rejects(() => client.connect());

  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async (_session, request) => ({ method: request.method }),
  });
  await server.start();

  await client.connect();
  assert.deepEqual(await client.request('ping'), { method: 'ping' });

  await client.close();
  await server.stop();
});

test('broker client notifies listeners when the broker connection closes', async () => {
  const endpoint = createEndpoint();
  const server = new AgentBrokerServer({
    endpoint,
    getToken: () => 'secret',
    handleRequest: async () => true,
  });
  await server.start();

  const client = new AgentBrokerClient({
    endpoint,
    token: 'secret',
    clientId: 'close-listener',
    clientName: 'Close Listener',
  });
  await client.connect();

  const closed = new Promise<void>((resolve) => {
    client.onClose(resolve);
  });
  await server.stop();
  await closed;

  await client.close();
});
