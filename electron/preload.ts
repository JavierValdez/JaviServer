import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';

const unsubscribeOn = <T>(channel: string, listener: (payload: T) => void) => {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => {
    listener(payload);
  };

  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

contextBridge.exposeInMainWorld('api', {
  profiles: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.profilesGetAll),
    get: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.profilesGet, profileId),
    create: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.profilesCreate, input),
    update: (profileId: string, updates: unknown) => ipcRenderer.invoke(IPC_CHANNELS.profilesUpdate, profileId, updates),
    delete: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.profilesDelete, profileId),
  },
  dialog: {
    selectKeyfile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogSelectKeyfile),
  },
  ssh: {
    connect: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.sshConnect, profileId),
    disconnect: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.sshDisconnect, profileId),
    onConnectionClosed: (listener: (profileId: string) => void) =>
      unsubscribeOn(IPC_CHANNELS.sshConnectionClosed, listener),
  },
  sftp: {
    listDirectory: (profileId: string, remotePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.sftpListDirectory, profileId, remotePath),
    download: (profileId: string, remotePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.sftpDownload, profileId, remotePath),
    searchInDirectory: (
      profileId: string,
      remotePath: string,
      query: string,
      options?: { recursive?: boolean; filePattern?: string },
    ) => ipcRenderer.invoke(IPC_CHANNELS.sftpSearchInDirectory, profileId, remotePath, query, options),
  },
  bookmarks: {
    add: (profileId: string, bookmark: { name: string; path: string; isLogDirectory: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.bookmarksAdd, profileId, bookmark),
    remove: (profileId: string, bookmarkId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.bookmarksRemove, profileId, bookmarkId),
  },
  logs: {
    getFileInfo: (profileId: string, filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.logsGetFileInfo, profileId, filePath),
    readLines: (
      profileId: string,
      filePath: string,
      options: { lines?: number; all?: boolean; fromStart?: boolean },
    ) => ipcRenderer.invoke(IPC_CHANNELS.logsReadLines, profileId, filePath, options),
    startTail: (profileId: string, filePath: string, initialLines: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.logsStartTail, profileId, filePath, initialLines),
    stopTail: (tailId: string) => ipcRenderer.invoke(IPC_CHANNELS.logsStopTail, tailId),
    searchByDateRange: (profileId: string, filePath: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.logsSearchByDateRange, profileId, filePath, startDate, endDate),
    grep: (profileId: string, filePath: string, query: string, options?: { ignoreCase?: boolean; context?: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.logsGrep, profileId, filePath, query, options),
    onData: (listener: (payload: { tailId: string; data: string }) => void) =>
      unsubscribeOn(IPC_CHANNELS.logsData, listener),
  },
  terminal: {
    start: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.terminalStart, profileId),
    write: (profileId: string, data: string) => ipcRenderer.invoke(IPC_CHANNELS.terminalWrite, profileId, data),
    resize: (profileId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.terminalResize, profileId, cols, rows),
    stop: (profileId: string) => ipcRenderer.invoke(IPC_CHANNELS.terminalStop, profileId),
    onData: (listener: (payload: { profileId: string; data: string }) => void) =>
      unsubscribeOn(IPC_CHANNELS.terminalData, listener),
  },
});
