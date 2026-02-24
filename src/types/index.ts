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
  };
}
