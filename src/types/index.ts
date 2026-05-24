export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'keyfile';
  credential: string;
  bookmarks: PathBookmark[];
  logPatterns?: LogPattern[];
}

export interface PathBookmark {
  id: string;
  name: string;
  path: string;
  isLogDirectory: boolean;
}

export interface LogPattern {
  pattern: string;
  color: string;
  label: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifyTime: Date;
  permissions: string;
}

export interface TerminalSuggestion {
  type: 'command' | 'path';
  label: string;
  insertText: string;
  detail?: string;
  isDirectory?: boolean;
}

export interface TerminalSuggestionRequest {
  mode: 'command' | 'path';
  query: string;
  currentPath?: string;
  directoryOnly?: boolean;
}

export type AgentActivityKind = 'connect' | 'disconnect' | 'tool' | 'resource';

export interface AgentActivityEntry {
  id: string;
  at: string;
  kind: AgentActivityKind;
  clientId: string;
  clientName: string;
  action: string;
  target?: string;
  ok: boolean;
  durationMs?: number;
  error?: string;
}

export interface AgentSession {
  id: string;
  clientId: string;
  clientName: string;
  clientVersion?: string;
  connectedAt: string;
}

export interface AgentPermissionSettings {
  autoApproveReadCommands: boolean;
  autoApproveWriteCommands: boolean;
}

export interface AgentIntegrationState {
  enabled: boolean;
  brokerRunning: boolean;
  sessions: AgentSession[];
  activity: AgentActivityEntry[];
  permissions: AgentPermissionSettings;
}

export interface AgentClientConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface RemoteCommandResult {
  command: string;
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: string;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

export interface ConnectionStatus {
  profileId: string;
  connected: boolean;
  connecting: boolean;
  error?: string;
}

export type TabType = 'explorer' | 'logs' | 'terminal';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  profileId: string;
  data?: {
    path?: string;
    filePath?: string;
    terminalId?: string;
  };
}
