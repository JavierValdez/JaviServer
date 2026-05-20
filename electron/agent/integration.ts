import { app, BrowserWindow, dialog } from 'electron';
import type { MessageBoxOptions } from 'electron';
import { join } from 'node:path';
import { AgentActivityLog } from './activity-log';
import { AgentBrokerServer } from './broker';
import { buildAgentClientLaunchConfig } from './client-config';
import { classifyCommand, normalizeRunCommandOptions } from './command-policy';
import type { AgentActivityEntry, AgentSession, BrokerRequest } from './protocol';
import { createActivityEntry } from './protocol';
import {
  ensureAgentIntegrationToken,
  getAgentIntegrationState,
  regenerateAgentIntegrationToken,
  setAgentIntegrationEnabled,
} from './store';
import type { ProfileStore } from '../services/ProfileStore';
import type { SSHService } from '../services/SSHService';
import type { ServerProfile } from '../../src/types';

export interface AgentIntegrationPublicState {
  enabled: boolean;
  brokerRunning: boolean;
  sessions: AgentSession[];
  activity: AgentActivityEntry[];
}

interface AgentDependencies {
  profileStore: ProfileStore;
  sshService: SSHService;
}

let dependencies: AgentDependencies | null = null;
let activityLog: AgentActivityLog | null = null;
let broker: AgentBrokerServer | null = null;

export function configureAgentIntegration(profileStore: ProfileStore, sshService: SSHService): void {
  dependencies = { profileStore, sshService };
}

function getDependencies(): AgentDependencies {
  if (!dependencies) {
    throw new Error('La integracion IA no esta inicializada.');
  }

  return dependencies;
}

export function getAgentBrokerEndpoint(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\javiserver-agent-broker';
  }

  return join(app.getPath('userData'), 'javiserver-agent-broker.sock');
}

function getActivityLog(): AgentActivityLog {
  if (!activityLog) {
    activityLog = new AgentActivityLog(join(app.getPath('userData'), 'javiserver-agent-activity.json'));
  }

  return activityLog;
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

function appendActivity(entry: AgentActivityEntry): void {
  const activity = getActivityLog().append(entry);
  broadcast('agentIntegration:activity', activity);
}

function buildTarget(method: string, params: Record<string, unknown>): string | undefined {
  if (typeof params.profileId === 'string') {
    return `${method}:${params.profileId}`;
  }

  if (typeof params.filePath === 'string') {
    return `${method}:${params.filePath}`;
  }

  if (typeof params.remotePath === 'string') {
    return `${method}:${params.remotePath}`;
  }

  return method;
}

function sanitizeProfile(profile: ServerProfile, connected: boolean) {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    authType: profile.authType,
    bookmarks: profile.bookmarks,
    logPatterns: profile.logPatterns || [],
    connected,
  };
}

function listSanitizedServers(): ReturnType<typeof sanitizeProfile>[] {
  const { profileStore, sshService } = getDependencies();
  return profileStore.getAll().map((profile) => sanitizeProfile(profile, sshService.isConnected(profile.id)));
}

function resolveProfile(profileId: string): ServerProfile {
  const { profileStore } = getDependencies();
  const profile = profileStore.get(profileId);
  if (!profile) {
    throw new Error('No se encontro el perfil SSH solicitado.');
  }

  return profile;
}

async function ensureConnected(profileId: string): Promise<ServerProfile> {
  const profile = resolveProfile(profileId);
  const { sshService } = getDependencies();
  await sshService.connect(profile);
  return profile;
}

function getDialogOwnerWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow()
    ?? BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
}

async function confirmAgentRunCommand(
  session: AgentSession,
  profile: ServerProfile,
  command: string,
  cwd: string | undefined,
  reason: string,
): Promise<void> {
  const options: MessageBoxOptions = {
    type: 'question',
    buttons: ['Cancelar', 'Ejecutar'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirmar comando solicitado por IA',
    message: 'Un cliente MCP quiere ejecutar un comando SSH',
    detail:
      `${session.clientName} solicito ejecutar en:\n` +
      `${profile.name} (${profile.username}@${profile.host}:${profile.port})\n` +
      `${cwd ? `Directorio: ${cwd}\n` : ''}` +
      `Motivo de confirmacion: ${reason}\n\n` +
      command,
  };
  const ownerWindow = getDialogOwnerWindow();
  const { response } = ownerWindow
    ? await dialog.showMessageBox(ownerWindow, options)
    : await dialog.showMessageBox(options);

  if (response !== 1) {
    throw new Error('Comando cancelado por el usuario');
  }
}

async function handleBrokerRequest(
  session: AgentSession,
  request: BrokerRequest,
  _emitProgress: (progress: unknown) => void,
): Promise<unknown> {
  const started = Date.now();
  const params = request.params || {};
  let kind: 'tool' | 'resource' = 'tool';

  try {
    let result: unknown;
    const profileId = typeof params.profileId === 'string' ? params.profileId : '';

    switch (request.method) {
      case 'list_servers':
        result = listSanitizedServers();
        break;
      case 'connect_server': {
        const profile = await ensureConnected(profileId);
        result = {
          success: true,
          server: sanitizeProfile(profile, true),
        };
        break;
      }
      case 'disconnect_server': {
        const { sshService } = getDependencies();
        await sshService.disconnect(profileId);
        result = { success: true, profileId };
        break;
      }
      case 'list_directory':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.listDirectory(profileId, String(params.remotePath || '/'));
        break;
      case 'read_file':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.readTextFile(
          profileId,
          String(params.filePath || ''),
          { maxBytes: params.maxBytes === undefined ? undefined : Number(params.maxBytes) },
        );
        break;
      case 'search_files':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.searchInDirectory(
          profileId,
          String(params.remotePath || '/'),
          String(params.query || ''),
          {
            recursive: Boolean(params.recursive),
            filePattern: typeof params.filePattern === 'string' && params.filePattern.trim()
              ? params.filePattern.trim()
              : undefined,
          },
        );
        break;
      case 'grep_file':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.grep(
          profileId,
          String(params.filePath || ''),
          String(params.query || ''),
          {
            ignoreCase: Boolean(params.ignoreCase),
            context: params.context === undefined ? undefined : Number(params.context),
          },
        );
        break;
      case 'read_log_tail':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.readLines(
          profileId,
          String(params.filePath || ''),
          { lines: Number(params.lines || 200), fromStart: false },
        );
        break;
      case 'file_info':
        await ensureConnected(profileId);
        result = await getDependencies().sshService.getFileInfo(profileId, String(params.filePath || ''));
        break;
      case 'run_command': {
        const profile = await ensureConnected(profileId);
        const command = String(params.command || '').trim();
        if (!command) {
          throw new Error('El comando es requerido.');
        }

        const options = normalizeRunCommandOptions(params);
        const decision = classifyCommand(command);
        if (decision.requiresConfirmation) {
          await confirmAgentRunCommand(session, profile, command, options.cwd, decision.reason);
        }

        result = await getDependencies().sshService.runCommand(profileId, command, options);
        break;
      }
      case 'resource:servers':
        kind = 'resource';
        result = listSanitizedServers();
        break;
      case 'resource:server_status': {
        kind = 'resource';
        const profile = resolveProfile(profileId);
        result = {
          profileId,
          connected: getDependencies().sshService.isConnected(profileId),
          server: sanitizeProfile(profile, getDependencies().sshService.isConnected(profileId)),
        };
        break;
      }
      case 'resource:server_bookmarks': {
        kind = 'resource';
        result = {
          profileId,
          bookmarks: resolveProfile(profileId).bookmarks,
        };
        break;
      }
      default:
        throw new Error(`Metodo MCP no soportado: ${request.method}`);
    }

    appendActivity(createActivityEntry({
      kind,
      clientId: session.clientId,
      clientName: session.clientName,
      action: request.method,
      target: buildTarget(request.method, params),
      ok: true,
      durationMs: Date.now() - started,
    }));
    return result;
  } catch (error) {
    appendActivity(createActivityEntry({
      kind,
      clientId: session.clientId,
      clientName: session.clientName,
      action: request.method,
      target: buildTarget(request.method, params),
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Error interno',
    }));
    throw error;
  }
}

function buildBroker(): AgentBrokerServer {
  return new AgentBrokerServer({
    endpoint: getAgentBrokerEndpoint(),
    getToken: () => getAgentIntegrationState().token,
    handleRequest: handleBrokerRequest,
    onSessionConnected: (session) => {
      appendActivity(createActivityEntry({
        kind: 'connect',
        clientId: session.clientId,
        clientName: session.clientName,
        action: 'connect',
        ok: true,
      }));
      broadcast('agentIntegration:state', getAgentIntegrationPublicState());
    },
    onSessionDisconnected: (session) => {
      appendActivity(createActivityEntry({
        kind: 'disconnect',
        clientId: session.clientId,
        clientName: session.clientName,
        action: 'disconnect',
        ok: true,
      }));
      broadcast('agentIntegration:state', getAgentIntegrationPublicState());
    },
  });
}

export async function startAgentBrokerIfEnabled(): Promise<void> {
  const state = getAgentIntegrationState();
  if (!state.enabled) {
    return;
  }

  ensureAgentIntegrationToken();
  if (!broker) {
    broker = buildBroker();
  }

  try {
    await broker.start();
  } catch (error) {
    broker = null;
    throw error;
  }

  broadcast('agentIntegration:state', getAgentIntegrationPublicState());
}

export async function stopAgentBroker(): Promise<void> {
  if (!broker) {
    return;
  }

  await broker.stop();
  broker = null;
  broadcast('agentIntegration:state', getAgentIntegrationPublicState());
}

export function getAgentIntegrationPublicState(): AgentIntegrationPublicState {
  const state = getAgentIntegrationState();
  return {
    enabled: state.enabled,
    brokerRunning: Boolean(broker?.isRunning()),
    sessions: broker?.listSessions() || [],
    activity: getActivityLog().list(),
  };
}

export async function setAgentIntegrationPublicEnabled(enabled: boolean): Promise<AgentIntegrationPublicState> {
  setAgentIntegrationEnabled(enabled);
  if (enabled) {
    await startAgentBrokerIfEnabled();
  } else {
    broker?.disconnectAll();
    await stopAgentBroker();
  }

  return getAgentIntegrationPublicState();
}

export function getAgentClientConfig(): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  const token = ensureAgentIntegrationToken();
  const launchArgs = app.isPackaged ? ['--mcp-stdio'] : [app.getAppPath(), '--mcp-stdio'];
  const launchConfig = buildAgentClientLaunchConfig({
    platform: process.platform,
    execPath: process.execPath,
    launchArgs,
    comSpec: process.env.ComSpec,
    stdioEnvKey: 'JAVISERVER_MCP_STDIO',
    // Windows-only: cuando esta empaquetada, el instalador NSIS coloca este
    // binario al lado de JaviServer.exe (extraFiles en electron-builder).
    // En dev (no empaquetada) no existe; el builder ignora el bridge y cae al
    // fallback de lanzar el exe directo.
    mcpBridgeExeName: app.isPackaged && process.platform === 'win32' ? 'JaviServerMcp.exe' : undefined,
  });

  return {
    ...launchConfig,
    env: { JAVISERVER_MCP_TOKEN: token, JAVISERVER_MCP_STDIO: '1', ELECTRON_RUN_AS_NODE: '' },
  };
}

export function regenerateAgentIntegrationPublicToken(): AgentIntegrationPublicState {
  regenerateAgentIntegrationToken();
  broker?.disconnectAll();
  broadcast('agentIntegration:state', getAgentIntegrationPublicState());
  return getAgentIntegrationPublicState();
}

export function clearAgentActivity(): AgentActivityEntry[] {
  getActivityLog().clear();
  const activity: AgentActivityEntry[] = [];
  broadcast('agentIntegration:activity', activity);
  return activity;
}
