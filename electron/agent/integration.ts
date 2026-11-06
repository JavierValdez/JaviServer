import { app, BrowserWindow, dialog } from 'electron';
import type { MessageBoxOptions } from 'electron';
import { Buffer } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentActivityLog } from './activity-log';
import { AgentBrokerServer } from './broker';
import { WINDOWS_AGENT_BROKER_ENDPOINT } from './broker-endpoint';
import { buildAgentClientLaunchConfig } from './client-config';
import { classifyCommand, normalizeRunCommandOptions, shouldConfirmCommand } from './command-policy';
import {
  buildSecretStdin,
  buildSecretWrapper,
  normalizeSecretSpecs,
  redactSecrets,
  validateSecretValues,
} from './secret-command';
import type { NormalizedSecretSpec } from './secret-command';
import { isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CommandPermissionSettings } from './command-policy';
import type { AgentActivityEntry, AgentSession, BrokerRequest } from './protocol';
import { createActivityEntry } from './protocol';
import {
  ensureAgentIntegrationToken,
  getAgentIntegrationState,
  regenerateAgentIntegrationToken,
  setAgentIntegrationEnabled,
  setAgentIntegrationPermissions,
} from './store';
import type { ProfileStore } from '../services/ProfileStore';
import type { SSHService } from '../services/SSHService';
import type { ServerProfile } from '../../src/types';

export interface AgentIntegrationPublicState {
  enabled: boolean;
  brokerRunning: boolean;
  sessions: AgentSession[];
  activity: AgentActivityEntry[];
  permissions: CommandPermissionSettings;
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
    return WINDOWS_AGENT_BROKER_ENDPOINT;
  }

  const preferred = join(app.getPath('userData'), 'javiserver-agent-broker.sock');
  // macOS limita sun_path a 104 bytes, Linux a 108. Si nos pasamos, usar /tmp.
  if (Buffer.byteLength(preferred, 'utf-8') <= 100) return preferred;
  return join(tmpdir(), `javiserver-agent-broker-${process.getuid?.() ?? 'u'}.sock`);
}

function getActivityLog(): AgentActivityLog {
  if (!activityLog) {
    activityLog = new AgentActivityLog(join(app.getPath('userData'), 'artishell-agent-activity.json'));
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

export interface SecretPromptRequest {
  id: string;
  clientName: string;
  server: string;
  command: string;
  cwd?: string;
  reason?: string;
  fields: NormalizedSecretSpec[];
  cachedFields: string[];
}

export interface SecretPromptResponse {
  values: Record<string, string>;
  remember: boolean;
}

const SECRET_PROMPT_TIMEOUT_MS = 5 * 60_000;
const pendingSecretPrompts = new Map<string, {
  resolve: (response: SecretPromptResponse | null) => void;
  timer: NodeJS.Timeout;
}>();
/** Valores recordados durante la ejecucion de ArtiShell, por perfil y nombre. Solo en memoria. */
const rememberedSecrets = new Map<string, string>();

function secretCacheKey(profileId: string, name: string): string {
  return `${profileId}\u0000${name}`;
}

export function clearRememberedSecrets(): void {
  rememberedSecrets.clear();
}

export function respondSecretPrompt(id: string, response: SecretPromptResponse | null): boolean {
  const pending = pendingSecretPrompts.get(id);
  if (!pending) {
    return false;
  }
  pendingSecretPrompts.delete(id);
  clearTimeout(pending.timer);
  pending.resolve(response);
  return true;
}

async function requestSecretsFromUser(
  session: AgentSession,
  profile: ServerProfile,
  command: string,
  cwd: string | undefined,
  reason: string | undefined,
  specs: NormalizedSecretSpec[],
): Promise<Record<string, string>> {
  const cached: Record<string, string> = {};
  for (const spec of specs) {
    const value = rememberedSecrets.get(secretCacheKey(profile.id, spec.name));
    if (value !== undefined) {
      cached[spec.name] = value;
    }
  }

  const ownerWindow = getDialogOwnerWindow();
  if (!ownerWindow) {
    throw new Error('ArtiShell no tiene una ventana abierta para pedir los secretos al usuario.');
  }
  if (ownerWindow.isMinimized()) ownerWindow.restore();
  ownerWindow.show();
  ownerWindow.focus();

  const request: SecretPromptRequest = {
    id: randomUUID(),
    clientName: session.clientName,
    server: `${profile.name} (${profile.username}@${profile.host}:${profile.port})`,
    command,
    cwd,
    reason,
    fields: specs,
    cachedFields: Object.keys(cached),
  };

  const response = await new Promise<SecretPromptResponse | null>((resolve) => {
    const timer = setTimeout(() => {
      pendingSecretPrompts.delete(request.id);
      broadcast('agentIntegration:secretPromptClosed', request.id);
      resolve(null);
    }, SECRET_PROMPT_TIMEOUT_MS);
    pendingSecretPrompts.set(request.id, { resolve, timer });
    broadcast('agentIntegration:secretPrompt', request);
  });

  if (!response) {
    throw new Error('El usuario cancelo o no respondio la solicitud de secretos.');
  }

  const values: Record<string, string> = { ...cached };
  for (const spec of specs) {
    const typed = response.values?.[spec.name];
    if (typeof typed === 'string' && typed.length > 0) {
      values[spec.name] = typed;
    }
  }
  validateSecretValues(specs, values);

  if (response.remember) {
    for (const spec of specs) {
      rememberedSecrets.set(secretCacheKey(profile.id, spec.name), values[spec.name]);
    }
  }
  return values;
}

async function confirmAgentUpload(
  session: AgentSession,
  profile: ServerProfile,
  localPath: string,
  remotePath: string,
  overwrite: boolean,
): Promise<void> {
  const options: MessageBoxOptions = {
    type: 'question',
    buttons: ['Cancelar', 'Subir archivo'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirmar subida solicitada por IA',
    message: 'Un cliente MCP quiere subir un archivo al servidor',
    detail:
      `${session.clientName} solicito subir a:\n` +
      `${profile.name} (${profile.username}@${profile.host}:${profile.port})\n\n` +
      `Origen local: ${localPath}\n` +
      `Destino remoto: ${remotePath}\n` +
      (overwrite ? 'Si el destino existe, se reemplazara.' : 'No se reemplazara un archivo existente.'),
  };
  const ownerWindow = getDialogOwnerWindow();
  const { response } = ownerWindow
    ? await dialog.showMessageBox(ownerWindow, options)
    : await dialog.showMessageBox(options);

  if (response !== 1) {
    throw new Error('Subida cancelada por el usuario');
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
        const permissions = getAgentIntegrationState().permissions;
        if (shouldConfirmCommand(decision, permissions)) {
          await confirmAgentRunCommand(session, profile, command, options.cwd, decision.reason);
        }

        result = await getDependencies().sshService.runCommand(profileId, command, options);
        break;
      }
      case 'upload_file': {
        const profile = await ensureConnected(profileId);
        const localPath = String(params.localPath || '').trim();
        const remotePath = String(params.remotePath || '').trim();
        if (!isAbsolute(localPath)) {
          throw new Error('localPath debe ser una ruta absoluta del equipo local.');
        }
        if (!remotePath.startsWith('/') || remotePath.endsWith('/')) {
          throw new Error('remotePath debe ser la ruta absoluta del archivo remoto, incluido su nombre.');
        }
        const overwrite = Boolean(params.overwrite);
        const mode = typeof params.mode === 'string' && /^[0-7]{3,4}$/.test(params.mode)
          ? parseInt(params.mode, 8)
          : undefined;
        if (!getAgentIntegrationState().permissions.autoApproveWriteCommands) {
          await confirmAgentUpload(session, profile, localPath, remotePath, overwrite);
        }
        result = await getDependencies().sshService.uploadFile(profileId, localPath, remotePath, { overwrite, mode });
        break;
      }
      case 'run_command_with_secrets': {
        const profile = await ensureConnected(profileId);
        const command = String(params.command || '').trim();
        if (!command) {
          throw new Error('El comando es requerido.');
        }
        const specs = normalizeSecretSpecs(params.secrets);
        const options = normalizeRunCommandOptions(params);
        const reason = typeof params.reason === 'string' ? params.reason.trim().slice(0, 500) : undefined;
        const values = await requestSecretsFromUser(session, profile, command, options.cwd, reason, specs);
        const raw = await getDependencies().sshService.runCommand(
          profileId,
          buildSecretWrapper(specs, command),
          {
            ...options,
            stdin: buildSecretStdin(specs, values),
            displayCommand: command,
          },
        );
        result = {
          ...raw,
          stdout: redactSecrets(raw.stdout, specs, values),
          stderr: redactSecrets(raw.stderr, specs, values),
          secrets: specs.map((spec) => spec.name),
        };
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
    permissions: state.permissions,
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

export function setAgentIntegrationPublicPermissions(
  permissions: Partial<CommandPermissionSettings>,
): AgentIntegrationPublicState {
  setAgentIntegrationPermissions(permissions);
  broadcast('agentIntegration:state', getAgentIntegrationPublicState());
  return getAgentIntegrationPublicState();
}

export function getAgentClientConfig(): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  const token = ensureAgentIntegrationToken();
  const launchArgs = app.isPackaged ? ['--mcp-stdio'] : [app.getAppPath(), '--mcp-stdio'];

  // Resolver ruta al bridge MCP standalone en macOS/Linux empaquetado.
  const mcpBridgeExePath = (() => {
    if (!app.isPackaged) return undefined;
    if (process.platform === 'darwin' || process.platform === 'linux') {
      return join(process.resourcesPath, 'bridge', 'artishell-mcp-bridge');
    }
    return undefined;
  })();

  const launchConfig = buildAgentClientLaunchConfig({
    platform: process.platform,
    execPath: process.execPath,
    launchArgs,
    comSpec: process.env.ComSpec,
    stdioEnvKey: 'ARTISHELL_MCP_STDIO',
    mcpBridgeExeName: app.isPackaged && process.platform === 'win32' ? 'ArtiShellMcp.exe' : undefined,
    mcpBridgeExePath,
  });

  return {
    ...launchConfig,
    env: {
      ARTISHELL_MCP_TOKEN: token,
      ARTISHELL_MCP_STDIO: '1',
      // Alias de transición para clientes configurados antes del cambio de nombre.
      JAVISERVER_MCP_TOKEN: token,
      JAVISERVER_MCP_STDIO: '1',
      ELECTRON_RUN_AS_NODE: '',
    },
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
