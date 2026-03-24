import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { promises as fs, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { constants as zlibConstants, createGzip } from 'node:zlib';
import {
  Client,
  type Algorithms,
  type ClientChannel,
  type ConnectConfig,
  type FileEntryWithStats,
  type SFTPWrapper,
  type Stats,
} from 'ssh2';
import type {
  ServerProfile,
  FileInfo,
  TerminalSuggestion,
  TerminalSuggestionRequest,
} from '../../src/types';

interface SearchMatch {
  line: number;
  content: string;
}

export interface DirectorySearchResult {
  filename: string;
  filepath: string;
  matches: SearchMatch[];
}

export interface LogFileInfo {
  lines: number;
  size: string;
  lastModified: string;
}

interface TailSession {
  profileId: string;
  stream: ClientChannel;
}

interface TerminalSession {
  profileId: string;
  stream: ClientChannel;
}

interface ConnectionContext {
  client: Client;
  profile: ServerProfile;
  sftp?: SFTPWrapper;
  homeDirectory?: string;
  commandCache?: string[];
}

interface ExecOptions {
  allowedExitCodes?: number[];
}

const LEGACY_SSH_ALGORITHMS: Algorithms = {
  kex: {
    prepend: [],
    append: [
      'diffie-hellman-group-exchange-sha1',
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group1-sha1',
    ],
    remove: [],
  },
  serverHostKey: {
    prepend: [],
    append: ['ssh-dss'],
    remove: [],
  },
  cipher: {
    prepend: [],
    append: [
      'aes256-cbc',
      'aes192-cbc',
      'aes128-cbc',
      '3des-cbc',
      'blowfish-cbc',
    ],
    remove: [],
  },
  hmac: {
    prepend: [],
    append: [
      'hmac-md5',
      'hmac-sha1-96',
      'hmac-md5-96',
    ],
    remove: [],
  },
};

const MAX_TERMINAL_SUGGESTIONS = 12;
const COMMON_TERMINAL_COMMANDS = [
  'cd',
  'ls',
  'pwd',
  'cat',
  'tail',
  'grep',
  'find',
  'less',
  'head',
  'vim',
  'nano',
  'mkdir',
  'rm',
  'mv',
  'cp',
  'chmod',
  'chown',
  'du',
  'df',
  'ps',
  'top',
  'systemctl',
  'journalctl',
  'docker',
  'docker-compose',
  'git',
  'npm',
  'node',
  'pm2',
  'clear',
  'exit',
];

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function toPermissions(entry: FileEntryWithStats): string {
  if (entry.longname) {
    return entry.longname.split(/\s+/)[0] || entry.longname.slice(0, 10);
  }

  if (typeof entry.attrs.mode === 'number') {
    return entry.attrs.mode.toString(8).slice(-4);
  }

  return '---------';
}

function toPublicError(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(error.message);
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Ocurrió un error inesperado en la conexión SSH.');
}

function shouldRetryWithLegacyAlgorithms(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('no matching key exchange algorithm')
    || message.includes('no matching host key format')
    || message.includes('no matching cipher')
    || message.includes('no matching mac')
    || message.includes('no matching hmac')
  );
}

export class SSHService extends EventEmitter {
  private readonly connections = new Map<string, ConnectionContext>();
  private readonly pendingConnections = new Map<string, Promise<void>>();
  private readonly tailSessions = new Map<string, TailSession>();
  private readonly terminalSessions = new Map<string, TerminalSession>();

  async connect(profile: ServerProfile): Promise<void> {
    const existingConnection = this.connections.get(profile.id);
    if (existingConnection) {
      return;
    }

    const pending = this.pendingConnections.get(profile.id);
    if (pending) {
      return pending;
    }

    const connectionPromise = this.connectWithCompatibility(profile).finally(() => {
      this.pendingConnections.delete(profile.id);
    });

    this.pendingConnections.set(profile.id, connectionPromise);
    return connectionPromise;
  }

  async disconnect(profileId: string): Promise<void> {
    const connection = this.connections.get(profileId);
    if (!connection) {
      return;
    }

    for (const [terminalId, session] of this.terminalSessions.entries()) {
      if (session.profileId === profileId) {
        this.stopTerminal(terminalId);
      }
    }

    for (const [tailId, session] of this.tailSessions.entries()) {
      if (session.profileId === profileId) {
        await this.stopTail(tailId);
      }
    }

    connection.client.end();
    this.connections.delete(profileId);
  }

  async listDirectory(profileId: string, remotePath: string): Promise<FileInfo[]> {
    const sftp = await this.getSftp(profileId);
    const entries = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
      sftp.readdir(remotePath, (error, list) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        resolve(list);
      });
    });

    return entries
      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
      .map((entry) => ({
        name: entry.filename,
        path: path.posix.join(remotePath === '/' ? '/' : remotePath, entry.filename),
        isDirectory: entry.attrs.isDirectory(),
        size: entry.attrs.size ?? 0,
        modifyTime: new Date((entry.attrs.mtime ?? 0) * 1000),
        permissions: toPermissions(entry),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async downloadFile(
    profileId: string,
    remotePath: string,
    localPath: string,
    options: { compress?: boolean } = {},
  ): Promise<void> {
    const sftp = await this.getSftp(profileId);
    if (options.compress) {
      const remoteStream = sftp.createReadStream(remotePath);
      const localStream = createWriteStream(localPath);
      const gzipStream = createGzip({ level: zlibConstants.Z_BEST_COMPRESSION });

      try {
        await pipeline(remoteStream, gzipStream, localStream);
        return;
      } catch (error) {
        remoteStream.destroy();
        gzipStream.destroy();
        localStream.destroy();
        await fs.unlink(localPath).catch(() => undefined);
        throw toPublicError(error);
      }
    }

    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (error) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        resolve();
      });
    });
  }

  async searchInDirectory(
    profileId: string,
    remotePath: string,
    query: string,
    options: { recursive?: boolean; filePattern?: string } = {},
  ): Promise<DirectorySearchResult[]> {
    const recursive = options.recursive ?? false;
    const filePattern = options.filePattern || '*';
    const command = [
      'find',
      shellQuote(remotePath),
      recursive ? '' : '-maxdepth 1',
      '-type f',
      '-name',
      shellQuote(filePattern),
      '-exec',
      'grep -snIH -F --',
      shellQuote(query),
      '{}',
      '+',
    ]
      .filter(Boolean)
      .join(' ');

    const stdout = await this.execCommand(profileId, command, { allowedExitCodes: [0, 1] });
    if (!stdout.trim()) {
      return [];
    }

    const grouped = new Map<string, SearchMatch[]>();

    for (const line of stdout.split('\n')) {
      if (!line.trim()) {
        continue;
      }

      const match = line.match(/^(.*?):(\d+):(.*)$/);
      if (!match) {
        continue;
      }

      const [, filepath, lineNumber, content] = match;
      const item = grouped.get(filepath) ?? [];
      item.push({
        line: Number.parseInt(lineNumber, 10),
        content,
      });
      grouped.set(filepath, item);
    }

    return [...grouped.entries()].map(([filepath, matches]) => ({
      filename: path.posix.basename(filepath),
      filepath,
      matches,
    }));
  }

  async getFileInfo(profileId: string, filePath: string): Promise<LogFileInfo> {
    const sftp = await this.getSftp(profileId);
    const stats = await new Promise<Stats>((resolve, reject) => {
      sftp.stat(filePath, (error, result) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        resolve(result);
      });
    });

    const lineCount = await this.execCommand(
      profileId,
      `wc -l < ${shellQuote(filePath)}`,
      { allowedExitCodes: [0, 1] },
    );

    return {
      lines: Number.parseInt(lineCount.trim() || '0', 10) || 0,
      size: formatBytes(stats.size ?? 0),
      lastModified: new Date((stats.mtime ?? 0) * 1000).toISOString(),
    };
  }

  async readLines(
    profileId: string,
    filePath: string,
    options: { lines?: number; all?: boolean; fromStart?: boolean },
  ): Promise<string> {
    if (options.all) {
      return this.execCommand(profileId, `cat ${shellQuote(filePath)}`, { allowedExitCodes: [0, 1] });
    }

    const count = Math.max(1, options.lines ?? 200);
    const command = options.fromStart
      ? `head -n ${count} ${shellQuote(filePath)}`
      : `tail -n ${count} ${shellQuote(filePath)}`;

    return this.execCommand(profileId, command, { allowedExitCodes: [0, 1] });
  }

  async startTail(profileId: string, filePath: string, initialLines: number): Promise<string> {
    const connection = this.getConnection(profileId);
    const lineCount = initialLines > 0 ? initialLines : 200;

    return new Promise<string>((resolve, reject) => {
      connection.client.exec(`tail -n ${lineCount} -F ${shellQuote(filePath)}`, (error, stream) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        const tailId = randomUUID();
        this.tailSessions.set(tailId, { profileId, stream });

        stream.on('data', (chunk: Buffer) => {
          this.emit('log-data', {
            tailId,
            data: chunk.toString('utf8'),
          });
        });

        stream.stderr.on('data', (chunk: Buffer) => {
          this.emit('log-data', {
            tailId,
            data: chunk.toString('utf8'),
          });
        });

        stream.on('close', () => {
          this.tailSessions.delete(tailId);
        });

        resolve(tailId);
      });
    });
  }

  async stopTail(tailId: string): Promise<void> {
    const session = this.tailSessions.get(tailId);
    if (!session) {
      return;
    }

    session.stream.close();
    session.stream.end();
    this.tailSessions.delete(tailId);
  }

  async searchByDateRange(
    profileId: string,
    filePath: string,
    startDate: string,
    endDate: string,
  ): Promise<string> {
    const script = '\'match($0, /[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]/) { d = substr($0, RSTART, 10); if (d >= start && d <= end) print }\'';
    const command = [
      'awk',
      '-v',
      `start=${shellQuote(startDate)}`,
      '-v',
      `end=${shellQuote(endDate)}`,
      script,
      shellQuote(filePath),
    ].join(' ');

    return this.execCommand(profileId, command, { allowedExitCodes: [0, 1] });
  }

  async grep(
    profileId: string,
    filePath: string,
    query: string,
    options: { ignoreCase?: boolean; context?: number } = {},
  ): Promise<string> {
    const context = Math.max(0, options.context ?? 0);
    const command = [
      'grep',
      '-n',
      options.ignoreCase ? '-i' : '',
      context > 0 ? `-C ${context}` : '',
      '--',
      shellQuote(query),
      shellQuote(filePath),
    ]
      .filter(Boolean)
      .join(' ');

    return this.execCommand(profileId, command, { allowedExitCodes: [0, 1] });
  }

  async getTerminalSuggestions(
    profileId: string,
    request: TerminalSuggestionRequest,
  ): Promise<TerminalSuggestion[]> {
    const query = request.query.trim();

    if (request.mode === 'command') {
      return this.getCommandSuggestions(profileId, query);
    }

    return this.getPathSuggestions(
      profileId,
      query,
      request.currentPath,
      request.directoryOnly ?? false,
    );
  }

  async startTerminal(profileId: string, terminalId: string): Promise<void> {
    const connection = this.getConnection(profileId);
    if (this.terminalSessions.has(terminalId)) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      connection.client.shell((error, stream) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        this.terminalSessions.set(terminalId, { profileId, stream });

        stream.on('data', (chunk: Buffer) => {
          this.emit('terminal-data', {
            terminalId,
            profileId,
            data: chunk.toString('utf8'),
          });
        });

        stream.on('close', () => {
          const session = this.terminalSessions.get(terminalId);
          if (session?.stream === stream) {
            this.terminalSessions.delete(terminalId);
          }
        });

        resolve();
      });
    });
  }

  writeTerminal(terminalId: string, data: string): void {
    const session = this.terminalSessions.get(terminalId);
    if (!session) {
      throw new Error('La terminal no está inicializada para esta pestaña.');
    }

    session.stream.write(data);
  }

  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    this.terminalSessions.get(terminalId)?.stream.setWindow(rows, cols, 0, 0);
  }

  stopTerminal(terminalId: string): void {
    const session = this.terminalSessions.get(terminalId);
    if (!session) {
      return;
    }

    session.stream.close();
    session.stream.end();
    this.terminalSessions.delete(terminalId);
  }

  private async connectWithCompatibility(profile: ServerProfile): Promise<void> {
    try {
      await this.connectOnce(profile, this.createConnectConfig(profile));
    } catch (error) {
      if (!shouldRetryWithLegacyAlgorithms(error)) {
        throw toPublicError(error);
      }

      console.warn(`[ssh] ${profile.name}: retrying with legacy SSH algorithms.`);

      try {
        await this.connectOnce(profile, this.createConnectConfig(profile, LEGACY_SSH_ALGORITHMS));
      } catch (legacyError) {
        throw toPublicError(legacyError);
      }
    }
  }

  private createConnectConfig(profile: ServerProfile, algorithms?: Algorithms): ConnectConfig {
    const config: ConnectConfig = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      readyTimeout: 20_000,
      algorithms,
    };

    if (profile.authType === 'password') {
      config.password = profile.credential;
    } else {
      config.privateKey = profile.credential;
    }

    return config;
  }

  private connectOnce(profile: ServerProfile, config: ConnectConfig): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const client = new Client();
      let settled = false;

      const cleanupIfFailed = () => {
        client.removeAllListeners();
        try {
          client.end();
        } catch {
          // Ignore teardown failures from a half-open client.
        }
      };

      client.once('ready', () => {
        settled = true;
        this.connections.set(profile.id, { client, profile });
        resolve();
      });

      client.on('error', (error) => {
        if (!settled) {
          settled = true;
          cleanupIfFailed();
          reject(error);
          return;
        }

        console.error(`[ssh] ${profile.name}:`, error);
      });

      client.on('close', () => {
        this.handleConnectionClosed(profile.id);
      });

      client.connect(config);
    });
  }

  private getConnection(profileId: string): ConnectionContext {
    const connection = this.connections.get(profileId);
    if (!connection) {
      throw new Error('No hay una conexión SSH activa para este servidor.');
    }

    return connection;
  }

  private async getSftp(profileId: string): Promise<SFTPWrapper> {
    const connection = this.getConnection(profileId);
    if (connection.sftp) {
      return connection.sftp;
    }

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      connection.client.sftp((error, result) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        resolve(result);
      });
    });

    connection.sftp = sftp;
    return sftp;
  }

  private async getCommandSuggestions(profileId: string, query: string): Promise<TerminalSuggestion[]> {
    const prefix = query.toLowerCase();
    const commands = await this.getCommandCache(profileId);
    const baseCommands = prefix
      ? commands.filter((command) => command.toLowerCase().startsWith(prefix))
      : COMMON_TERMINAL_COMMANDS;

    return baseCommands
      .slice(0, MAX_TERMINAL_SUGGESTIONS)
      .map((command) => ({
        type: 'command' as const,
        label: command,
        insertText: `${command} `,
        detail: 'Comando disponible',
      }));
  }

  private async getPathSuggestions(
    profileId: string,
    query: string,
    currentPath?: string,
    directoryOnly = false,
  ): Promise<TerminalSuggestion[]> {
    const connection = this.getConnection(profileId);
    const homeDirectory = await this.getHomeDirectory(profileId);
    const activePath = currentPath?.trim() || connection.homeDirectory || '/';
    const normalizedCurrentPath = activePath === '~' ? homeDirectory : activePath;
    const resolution = this.resolveSuggestionPath(query, normalizedCurrentPath, homeDirectory);

    try {
      const entries = await this.listDirectory(profileId, resolution.lookupDirectory);

      return entries
        .filter((entry) => !directoryOnly || entry.isDirectory)
        .filter((entry) => entry.name.toLowerCase().startsWith(resolution.partial.toLowerCase()))
        .sort((left, right) => {
          if (left.isDirectory !== right.isDirectory) {
            return left.isDirectory ? -1 : 1;
          }

          return left.name.localeCompare(right.name);
        })
        .slice(0, MAX_TERMINAL_SUGGESTIONS)
        .map((entry) => ({
          type: 'path' as const,
          label: `${entry.name}${entry.isDirectory ? '/' : ''}`,
          insertText: `${resolution.insertBase}${entry.name}${entry.isDirectory ? '/' : ' '}`,
          detail: entry.path,
          isDirectory: entry.isDirectory,
        }));
    } catch {
      return [];
    }
  }

  private resolveSuggestionPath(
    query: string,
    currentPath: string,
    homeDirectory: string,
  ): { lookupDirectory: string; insertBase: string; partial: string } {
    if (!query) {
      return {
        lookupDirectory: currentPath,
        insertBase: '',
        partial: '',
      };
    }

    const endsWithSlash = query.endsWith('/');
    const withoutTrailingSlash = endsWithSlash && query.length > 1 ? query.slice(0, -1) : query;
    let rawBase = '';
    let partial = '';

    if (query === '~') {
      rawBase = '~';
    } else if (endsWithSlash) {
      rawBase = withoutTrailingSlash;
    } else {
      const separatorIndex = withoutTrailingSlash.lastIndexOf('/');
      rawBase = separatorIndex >= 0 ? withoutTrailingSlash.slice(0, separatorIndex) : '';
      partial = separatorIndex >= 0 ? withoutTrailingSlash.slice(separatorIndex + 1) : withoutTrailingSlash;
    }

    if (query.startsWith('/')) {
      const basePath = rawBase || '/';
      const normalizedBase = path.posix.normalize(basePath);

      return {
        lookupDirectory: normalizedBase,
        insertBase: normalizedBase === '/' ? '/' : `${normalizedBase}/`,
        partial,
      };
    }

    if (rawBase === '~' || rawBase.startsWith('~/')) {
      const relativeBase = rawBase === '~' ? '' : rawBase.slice(2);
      const lookupDirectory = relativeBase
        ? path.posix.normalize(path.posix.join(homeDirectory, relativeBase))
        : homeDirectory;

      return {
        lookupDirectory,
        insertBase: rawBase === '~' ? '~/' : `${rawBase}/`,
        partial,
      };
    }

    if (query === '~') {
      return {
        lookupDirectory: homeDirectory,
        insertBase: '~/',
        partial: '',
      };
    }

    if (!rawBase) {
      return {
        lookupDirectory: currentPath,
        insertBase: '',
        partial,
      };
    }

    const lookupDirectory = path.posix.normalize(path.posix.join(currentPath, rawBase));

    return {
      lookupDirectory,
      insertBase: `${rawBase}/`,
      partial,
    };
  }

  private async getHomeDirectory(profileId: string): Promise<string> {
    const connection = this.getConnection(profileId);
    if (connection.homeDirectory) {
      return connection.homeDirectory;
    }

    const homeDirectory = (await this.execCommand(profileId, 'printf %s "$HOME"')).trim() || '/';
    connection.homeDirectory = homeDirectory;
    return homeDirectory;
  }

  private async getCommandCache(profileId: string): Promise<string[]> {
    const connection = this.getConnection(profileId);
    if (connection.commandCache) {
      return connection.commandCache;
    }

    const commandScript = [
      'if command -v bash >/dev/null 2>&1; then',
      '  bash -lc \'compgen -c\';',
      'elif command -v zsh >/dev/null 2>&1; then',
      '  zsh -lc \'print -l ${(ko)commands}\';',
      'else',
      `  printf '%s\\n' ${COMMON_TERMINAL_COMMANDS.map((command) => shellQuote(command)).join(' ')};`,
      'fi',
    ].join(' ');

    try {
      const stdout = await this.execCommand(profileId, `sh -lc ${shellQuote(commandScript)}`, {
        allowedExitCodes: [0, 1],
      });

      const cachedCommands = [...new Set(stdout
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));

      connection.commandCache = cachedCommands.length > 0 ? cachedCommands : [...COMMON_TERMINAL_COMMANDS];
    } catch {
      connection.commandCache = [...COMMON_TERMINAL_COMMANDS];
    }

    return connection.commandCache;
  }

  private async execCommand(profileId: string, command: string, options: ExecOptions = {}): Promise<string> {
    const connection = this.getConnection(profileId);
    const allowedExitCodes = options.allowedExitCodes ?? [0];

    return new Promise<string>((resolve, reject) => {
      connection.client.exec(command, (error, stream) => {
        if (error) {
          reject(toPublicError(error));
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });

        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });

        stream.on('close', (code?: number) => {
          const exitCode = code ?? 0;
          if (allowedExitCodes.includes(exitCode)) {
            resolve(stdout);
            return;
          }

          reject(new Error(stderr.trim() || stdout.trim() || `El comando remoto falló con código ${exitCode}.`));
        });
      });
    });
  }

  private handleConnectionClosed(profileId: string): void {
    for (const [terminalId, session] of this.terminalSessions.entries()) {
      if (session.profileId === profileId) {
        this.terminalSessions.delete(terminalId);
      }
    }

    for (const [tailId, session] of this.tailSessions.entries()) {
      if (session.profileId === profileId) {
        this.tailSessions.delete(tailId);
      }
    }

    this.connections.delete(profileId);
    this.emit('connection-closed', profileId);
  }
}
