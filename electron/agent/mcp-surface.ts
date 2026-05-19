import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DEFAULT_COMMAND_OUTPUT_BYTES, DEFAULT_COMMAND_TIMEOUT_MS, MAX_COMMAND_OUTPUT_BYTES, MAX_COMMAND_TIMEOUT_MS } from './command-policy';

export interface BrokerRequester {
  request(
    method: string,
    params?: Record<string, unknown>,
    options?: { onProgress?: (progress: unknown) => void },
  ): Promise<unknown>;
}

function asTextResult(value: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(value, null, 2),
    }],
  };
}

const profileIdSchema = {
  profileId: z.string().min(1),
};

export function registerTools(server: McpServer, broker: BrokerRequester): void {
  server.registerTool('list_servers', {
    description: 'List SSH server profiles stored in JaviServer without exposing credentials.',
  }, async () => asTextResult(await broker.request('list_servers')));

  server.registerTool('connect_server', {
    description: 'Connect to a stored SSH server profile using credentials saved in JaviServer.',
    inputSchema: z.object(profileIdSchema),
  }, async (args) => asTextResult(await broker.request('connect_server', args)));

  server.registerTool('disconnect_server', {
    description: 'Disconnect one active SSH server profile.',
    inputSchema: z.object(profileIdSchema),
  }, async (args) => asTextResult(await broker.request('disconnect_server', args)));

  server.registerTool('list_directory', {
    description: 'List a remote directory through SFTP.',
    inputSchema: z.object({
      ...profileIdSchema,
      remotePath: z.string().min(1),
    }),
  }, async (args) => asTextResult(await broker.request('list_directory', args)));

  server.registerTool('read_file', {
    description: 'Read text content from a remote file with a byte limit.',
    inputSchema: z.object({
      ...profileIdSchema,
      filePath: z.string().min(1),
      maxBytes: z.number().int().positive().max(MAX_COMMAND_OUTPUT_BYTES).optional(),
    }),
  }, async (args) => asTextResult(await broker.request('read_file', args)));

  server.registerTool('search_files', {
    description: 'Search remote files by fixed text in one directory, optionally recursively.',
    inputSchema: z.object({
      ...profileIdSchema,
      remotePath: z.string().min(1),
      query: z.string().min(1),
      recursive: z.boolean().optional(),
      filePattern: z.string().optional(),
    }),
  }, async (args) => asTextResult(await broker.request('search_files', args)));

  server.registerTool('grep_file', {
    description: 'Search one remote text file with grep and optional context.',
    inputSchema: z.object({
      ...profileIdSchema,
      filePath: z.string().min(1),
      query: z.string().min(1),
      ignoreCase: z.boolean().optional(),
      context: z.number().int().min(0).max(50).optional(),
    }),
  }, async (args) => asTextResult(await broker.request('grep_file', args)));

  server.registerTool('read_log_tail', {
    description: 'Read the last lines of a remote log file.',
    inputSchema: z.object({
      ...profileIdSchema,
      filePath: z.string().min(1),
      lines: z.number().int().positive().max(10_000).optional(),
    }),
  }, async (args) => asTextResult(await broker.request('read_log_tail', args)));

  server.registerTool('file_info', {
    description: 'Read line count, size, and modification time for one remote file.',
    inputSchema: z.object({
      ...profileIdSchema,
      filePath: z.string().min(1),
    }),
  }, async (args) => asTextResult(await broker.request('file_info', args)));

  server.registerTool('run_command', {
    description: 'Run a non-interactive SSH command. Read-only commands run directly; risky commands require visible confirmation in JaviServer.',
    inputSchema: z.object({
      ...profileIdSchema,
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeoutMs: z.number().int().positive().max(MAX_COMMAND_TIMEOUT_MS).default(DEFAULT_COMMAND_TIMEOUT_MS),
      maxOutputBytes: z.number().int().positive().max(MAX_COMMAND_OUTPUT_BYTES).default(DEFAULT_COMMAND_OUTPUT_BYTES),
    }),
  }, async (args) => asTextResult(await broker.request('run_command', args)));
}

export function registerResources(server: McpServer, broker: BrokerRequester): void {
  server.registerResource('servers', 'javiserver://servers', {
    title: 'Configured SSH servers',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(await broker.request('resource:servers'), null, 2),
    }],
  }));

  server.registerResource('server-status', new ResourceTemplate('javiserver://servers/{profileId}/status', {
    list: async () => {
      const servers = await broker.request('resource:servers') as Array<{ id: string; name: string }>;
      return {
        resources: servers.map((serverEntry) => ({
          uri: `javiserver://servers/${serverEntry.id}/status`,
          name: `${serverEntry.name} status`,
          mimeType: 'application/json',
        })),
      };
    },
  }), {
    title: 'SSH server status',
    mimeType: 'application/json',
  }, async (uri, variables) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(
        await broker.request('resource:server_status', { profileId: String(variables.profileId || '') }),
        null,
        2,
      ),
    }],
  }));

  server.registerResource('server-bookmarks', new ResourceTemplate('javiserver://servers/{profileId}/bookmarks', {
    list: async () => {
      const servers = await broker.request('resource:servers') as Array<{ id: string; name: string }>;
      return {
        resources: servers.map((serverEntry) => ({
          uri: `javiserver://servers/${serverEntry.id}/bookmarks`,
          name: `${serverEntry.name} bookmarks`,
          mimeType: 'application/json',
        })),
      };
    },
  }), {
    title: 'SSH server bookmarks',
    mimeType: 'application/json',
  }, async (uri, variables) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(
        await broker.request('resource:server_bookmarks', { profileId: String(variables.profileId || '') }),
        null,
        2,
      ),
    }],
  }));
}
