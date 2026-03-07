import type {
  FileInfo,
  PathBookmark,
  ServerProfile,
  TerminalSuggestion,
  TerminalSuggestionRequest,
} from './types';
import type { AppUpdateState } from './types/updater';

interface DirectorySearchMatch {
  line: number;
  content: string;
}

interface DirectorySearchResult {
  filename: string;
  filepath: string;
  matches: DirectorySearchMatch[];
}

interface LogFileInfo {
  lines: number;
  size: string;
  lastModified: string;
}

interface ElectronApi {
  profiles: {
    getAll: () => Promise<ServerProfile[]>;
    get: (profileId: string) => Promise<ServerProfile | null>;
    create: (input: {
      name: string;
      host: string;
      port: number;
      username: string;
      authType: ServerProfile['authType'];
      credential: string;
    }) => Promise<ServerProfile>;
    update: (
      profileId: string,
      updates: Partial<{
        name: string;
        host: string;
        port: number;
        username: string;
        authType: ServerProfile['authType'];
        credential: string;
      }>,
    ) => Promise<ServerProfile>;
    delete: (profileId: string) => Promise<boolean>;
  };
  dialog: {
    selectKeyfile: () => Promise<{ success: boolean; path?: string; content?: string }>;
  };
  clipboard: {
    readText: () => Promise<string> | string;
    writeText: (text: string) => Promise<void> | void;
  };
  ssh: {
    connect: (profileId: string) => Promise<boolean>;
    disconnect: (profileId: string) => Promise<void>;
    onConnectionClosed: (listener: (profileId: string) => void) => () => void;
  };
  sftp: {
    listDirectory: (profileId: string, remotePath: string) => Promise<FileInfo[]>;
    download: (profileId: string, remotePath: string) => Promise<{ success: boolean; path?: string }>;
    searchInDirectory: (
      profileId: string,
      remotePath: string,
      query: string,
      options?: { recursive?: boolean; filePattern?: string },
    ) => Promise<DirectorySearchResult[]>;
  };
  bookmarks: {
    add: (profileId: string, bookmark: Omit<PathBookmark, 'id'>) => Promise<PathBookmark>;
    remove: (profileId: string, bookmarkId: string) => Promise<boolean>;
  };
  logs: {
    getFileInfo: (profileId: string, filePath: string) => Promise<LogFileInfo>;
    readLines: (
      profileId: string,
      filePath: string,
      options: { lines?: number; all?: boolean; fromStart?: boolean },
    ) => Promise<string>;
    startTail: (profileId: string, filePath: string, initialLines: number) => Promise<string>;
    stopTail: (tailId: string) => Promise<void>;
    searchByDateRange: (profileId: string, filePath: string, startDate: string, endDate: string) => Promise<string>;
    grep: (
      profileId: string,
      filePath: string,
      query: string,
      options?: { ignoreCase?: boolean; context?: number },
    ) => Promise<string>;
    onData: (listener: (payload: { tailId: string; data: string }) => void) => () => void;
  };
  terminal: {
    start: (profileId: string) => Promise<void>;
    write: (profileId: string, data: string) => Promise<boolean>;
    resize: (profileId: string, cols: number, rows: number) => Promise<boolean>;
    getSuggestions: (profileId: string, request: TerminalSuggestionRequest) => Promise<TerminalSuggestion[]>;
    stop: (profileId: string) => Promise<boolean>;
    onData: (listener: (payload: { profileId: string; data: string }) => void) => () => void;
  };
  updater: {
    getState: () => Promise<AppUpdateState>;
    checkForUpdates: () => Promise<AppUpdateState>;
    downloadInstaller: () => Promise<AppUpdateState>;
    revealInstaller: () => Promise<boolean>;
    onStateChange: (listener: (payload: AppUpdateState) => void) => () => void;
  };
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}

export {};
