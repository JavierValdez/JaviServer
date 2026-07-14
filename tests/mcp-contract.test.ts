import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerResources, registerTools } from '../electron/agent/mcp-surface';

test('MCP surface lists tools and resources and serves responses', async () => {
  const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const broker = {
    request: async (method: string, params?: Record<string, unknown>) => {
      calls.push({ method, params });
      if (method === 'resource:servers') {
        return [{ id: 'server-1', name: 'App Server', connected: false }];
      }
      if (method === 'resource:server_status') {
        return { profileId: params?.profileId, connected: false };
      }
      if (method === 'resource:server_bookmarks') {
        return { profileId: params?.profileId, bookmarks: [{ id: 'bookmark-1', path: '/var/log' }] };
      }
      if (method === 'list_servers') {
        return [{ id: 'server-1', name: 'App Server', connected: false }];
      }
      if (method === 'run_command') {
        return { stdout: 'ok', stderr: '', exitCode: 0, timedOut: false, truncated: false };
      }
      return [];
    },
  };

  const server = new McpServer({ name: 'artishell-test', version: '1.0.0' });
  registerTools(server, broker);
  registerResources(server, broker);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === 'list_servers'));
  assert.ok(tools.tools.some((tool) => tool.name === 'run_command'));

  const toolResult = await client.callTool({ name: 'list_servers', arguments: {} });
  assert.match(JSON.stringify(toolResult), /App Server/);

  const invalidToolResult = await client.callTool({ name: 'list_directory', arguments: {} });
  assert.equal(invalidToolResult.isError, true);
  assert.match(JSON.stringify(invalidToolResult), /profileId/);

  await client.callTool({
    name: 'run_command',
    arguments: {
      profileId: 'server-1',
      command: 'ls -la',
      cwd: '/var/log',
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    },
  });
  assert.deepEqual(
    calls.find((call) => call.method === 'run_command')?.params,
    {
      profileId: 'server-1',
      command: 'ls -la',
      cwd: '/var/log',
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    },
  );

  const invalidLimitResult = await client.callTool({
    name: 'run_command',
    arguments: { profileId: 'server-1', command: 'ls', timeoutMs: 121000 },
  });
  assert.equal(invalidLimitResult.isError, true);
  assert.match(JSON.stringify(invalidLimitResult), /timeoutMs/);

  const resources = await client.listResources();
  assert.ok(resources.resources.some((resource) => resource.uri === 'artishell://servers'));
  assert.ok(resources.resources.some((resource) => resource.uri === 'artishell://servers/server-1/status'));
  assert.ok(resources.resources.some((resource) => resource.uri === 'artishell://servers/server-1/bookmarks'));

  const status = await client.readResource({ uri: 'artishell://servers/server-1/status' });
  assert.match(JSON.stringify(status), /server-1/);
  assert.ok(calls.some((call) => call.method === 'resource:server_status'));

  await Promise.all([client.close(), server.close()]);
});
