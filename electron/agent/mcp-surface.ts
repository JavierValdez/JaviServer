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
    description: 'List SSH server profiles stored in ArtiShell without exposing credentials.',
  }, async () => asTextResult(await broker.request('list_servers')));

  server.registerTool('connect_server', {
    description: 'Connect to a stored SSH server profile using credentials saved in ArtiShell.',
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
    description: 'Run a non-interactive SSH command. Read-only commands run directly; risky commands require visible confirmation in ArtiShell.',
    inputSchema: z.object({
      ...profileIdSchema,
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeoutMs: z.number().int().positive().max(MAX_COMMAND_TIMEOUT_MS).default(DEFAULT_COMMAND_TIMEOUT_MS),
      maxOutputBytes: z.number().int().positive().max(MAX_COMMAND_OUTPUT_BYTES).default(DEFAULT_COMMAND_OUTPUT_BYTES),
    }),
  }, async (args) => asTextResult(await broker.request('run_command', args)));

  server.registerTool('upload_file', {
    description:
      'Upload one file from the local computer to the SSH server through SFTP. ' +
      'ArtiShell asks the user to confirm unless write commands are auto-approved. ' +
      'The file is written to a temporary name and renamed, and the result includes SHA-256 of both sides.',
    inputSchema: z.object({
      ...profileIdSchema,
      localPath: z.string().min(1).describe('Absolute path of the local file.'),
      remotePath: z.string().min(1).describe('Absolute remote destination path, including the file name.'),
      overwrite: z.boolean().default(false).describe('Replace the remote file if it already exists.'),
      mode: z.string().regex(/^[0-7]{3,4}$/).optional().describe('Octal permissions for the remote file, e.g. "600".'),
    }),
  }, async (args) => asTextResult(await broker.request('upload_file', args)));

  server.registerTool('run_command_with_secrets', {
    description:
      'Run an SSH command that needs credentials the user must type (passwords, tokens, usernames). ' +
      'Declare each secret by environment variable name and label; ArtiShell shows a form where the user ' +
      'enters the values and sees the command before it runs. Values reach the command as exported ' +
      'environment variables via stdin, never appear in the command line, are redacted from the output, ' +
      'and are never returned to the MCP client. The command runs with stdin closed, so it must read ' +
      'the variables instead of prompting.',
    inputSchema: z.object({
      ...profileIdSchema,
      command: z.string().min(1),
      secrets: z.array(z.object({
        name: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/).describe('Environment variable name, e.g. XWIKI_PASSWORD.'),
        label: z.string().min(1).max(120).describe('Label shown to the user.'),
        sensitive: z.boolean().default(true).describe('Mask the input and redact it from output. Use false for usernames.'),
      })).min(1).max(8),
      reason: z.string().max(500).optional().describe('Why the credentials are needed, shown to the user.'),
      cwd: z.string().optional(),
      timeoutMs: z.number().int().positive().max(MAX_COMMAND_TIMEOUT_MS).default(DEFAULT_COMMAND_TIMEOUT_MS),
      maxOutputBytes: z.number().int().positive().max(MAX_COMMAND_OUTPUT_BYTES).default(DEFAULT_COMMAND_OUTPUT_BYTES),
    }),
  }, async (args) => asTextResult(await broker.request('run_command_with_secrets', args)));
}

export function registerResources(server: McpServer, broker: BrokerRequester): void {
  server.registerResource('servers', 'artishell://servers', {
    title: 'Configured SSH servers',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify(await broker.request('resource:servers'), null, 2),
    }],
  }));

  server.registerResource('server-status', new ResourceTemplate('artishell://servers/{profileId}/status', {
    list: async () => {
      const servers = await broker.request('resource:servers') as Array<{ id: string; name: string }>;
      return {
        resources: servers.map((serverEntry) => ({
          uri: `artishell://servers/${serverEntry.id}/status`,
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

  server.registerResource('server-bookmarks', new ResourceTemplate('artishell://servers/{profileId}/bookmarks', {
    list: async () => {
      const servers = await broker.request('resource:servers') as Array<{ id: string; name: string }>;
      return {
        resources: servers.map((serverEntry) => ({
          uri: `artishell://servers/${serverEntry.id}/bookmarks`,
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
