// Bridge MCP standalone cross-plataforma.
// En Windows se conecta vía named pipe; en macOS/Linux vía Unix socket.
// Actúa como puente entre el cliente MCP (Kiro CLI, Claude Desktop, VS Code Copilot, etc.)
// y la app GUI corriendo localmente, conectándose a su broker.

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WINDOWS_AGENT_BROKER_ENDPOINT } from '../../electron/agent/broker-endpoint';
import { AgentBrokerClient } from '../../electron/agent/broker-client';
import { registerResources, registerTools } from '../../electron/agent/mcp-surface';

const SERVER_NAME = 'artishell';
const TOKEN_ENV = 'ARTISHELL_MCP_TOKEN';
const LEGACY_TOKEN_ENV = 'JAVISERVER_MCP_TOKEN';
const VERSION = process.env.ARTISHELL_BRIDGE_VERSION
  || process.env.JAVISERVER_BRIDGE_VERSION
  || '0.0.0';

function getMcpEnv(primary: string, legacy: string): string | undefined {
  return process.env[primary] || process.env[legacy];
}

function resolveBrokerEndpoint(): string {
  if (process.platform === 'win32') return WINDOWS_AGENT_BROKER_ENDPOINT;
  const userDataCandidates = process.platform === 'darwin'
    ? [
        path.join(os.homedir(), 'Library', 'Application Support', 'ArtiShell'),
        path.join(os.homedir(), 'Library', 'Application Support', 'JaviServer'),
        path.join(os.homedir(), 'Library', 'Application Support', 'javiserver'),
      ]
    : [
        path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'ArtiShell'),
        path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'JaviServer'),
        path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'javiserver'),
        path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'JaviServer'),
        path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'), 'javiserver'),
      ];
  const socketCandidates = userDataCandidates
    .map((userData) => path.join(userData, 'javiserver-agent-broker.sock'))
    .filter((candidate) => Buffer.byteLength(candidate, 'utf-8') <= 100);
  return socketCandidates.find((candidate) => existsSync(candidate))
    ?? socketCandidates[0]
    ?? path.join(os.tmpdir(), `javiserver-agent-broker-${process.getuid?.() ?? 'u'}.sock`);
}

const PIPE_ENDPOINT = resolveBrokerEndpoint();

function logDebug(message: string): void {
  if (getMcpEnv('ARTISHELL_MCP_DEBUG', 'JAVISERVER_MCP_DEBUG') !== '1') {
    return;
  }
  process.stderr.write(`[ArtiShell MCP bridge] ${new Date().toISOString()} ${message}\n`);
}

async function connectBroker(token: string): Promise<AgentBrokerClient> {
  const client = new AgentBrokerClient({
    endpoint: PIPE_ENDPOINT,
    token,
    clientId: getMcpEnv('ARTISHELL_MCP_CLIENT_ID', 'JAVISERVER_MCP_CLIENT_ID') || randomUUID(),
    clientName: getMcpEnv('ARTISHELL_MCP_CLIENT_NAME', 'JAVISERVER_MCP_CLIENT_NAME') || 'MCP client',
    clientVersion: getMcpEnv('ARTISHELL_MCP_CLIENT_VERSION', 'JAVISERVER_MCP_CLIENT_VERSION'),
  });

  // Reintenta varias veces por si la app GUI todavía está arrancando el broker.
  const deadline = Date.now() + 20_000;
  let lastError: Error | null = null;
  while (Date.now() < deadline) {
    try {
      await client.connect();
      logDebug('broker connected');
      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError ?? new Error(
    `No se pudo conectar al broker de ${SERVER_NAME}. Asegurate de que la app GUI esta abierta y la integracion IA esta habilitada.`,
  );
}

async function main(): Promise<void> {
  const token = process.env[TOKEN_ENV] || process.env[LEGACY_TOKEN_ENV];
  if (!token) {
    process.stderr.write(`Falta ${TOKEN_ENV} para autenticar el MCP de ${SERVER_NAME}.\n`);
    process.exit(1);
  }

  const broker = await connectBroker(token);
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  registerTools(server, broker);
  registerResources(server, broker);

  let shuttingDown = false;
  const shutdown = async (exitCode: number, reason: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logDebug(`shutdown: ${reason}`);
    try {
      await broker.close();
      await server.close();
    } finally {
      process.exit(exitCode);
    }
  };

  // ── Triggers defensivos ──────────────────────────────────────────
  process.stdin.on('end', () => { void shutdown(0, 'stdin end'); });
  process.stdin.on('close', () => { void shutdown(0, 'stdin close'); });
  process.stdin.on('error', (err) => {
    void shutdown(1, `stdin error: ${err instanceof Error ? err.message : String(err)}`);
  });

  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
    process.on(sig, () => { void shutdown(0, sig); });
  }

  if (process.platform !== 'win32') {
    const initialPpid = process.ppid;
    const ppidWatcher = setInterval(() => {
      const current = process.ppid;
      if (current !== initialPpid || current === 1) {
        void shutdown(0, `parent changed: ${initialPpid} -> ${current}`);
      }
    }, 2000);
    ppidWatcher.unref();
  }
  // ──────────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  transport.onclose = () => { void shutdown(0, 'transport closed'); };
  await server.connect(transport);
  logDebug('stdio server ready');

  broker.onClose(() => { void shutdown(1, 'broker closed'); });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
  process.exit(1);
});
