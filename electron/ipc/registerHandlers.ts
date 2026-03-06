import path from 'node:path';
import { promises as fs } from 'node:fs';
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { IPC_CHANNELS } from './channels';
import { ProfileStore, type ProfileInput } from '../services/ProfileStore';
import { SSHService } from '../services/SSHService';

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  profileStore: ProfileStore,
  sshService: SSHService,
): void {
  ipcMain.handle(IPC_CHANNELS.profilesGetAll, () => profileStore.getAll());
  ipcMain.handle(IPC_CHANNELS.profilesGet, (_event, profileId: string) => profileStore.get(profileId) ?? null);
  ipcMain.handle(IPC_CHANNELS.profilesCreate, (_event, input: ProfileInput) => profileStore.create(input));
  ipcMain.handle(IPC_CHANNELS.profilesUpdate, (_event, profileId: string, updates: Partial<ProfileInput>) => profileStore.update(profileId, updates));
  ipcMain.handle(IPC_CHANNELS.profilesDelete, async (_event, profileId: string) => {
    await sshService.disconnect(profileId);
    profileStore.delete(profileId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.dialogSelectKeyfile, async () => {
    const mainWindow = getMainWindow();
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [
        { name: 'Private Keys', extensions: ['pem', 'ppk', 'key'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    const selectedPath = result.filePaths[0];
    const content = await fs.readFile(selectedPath, 'utf8');

    return {
      success: true,
      path: selectedPath,
      content,
    };
  });

  ipcMain.handle(IPC_CHANNELS.sshConnect, async (_event, profileId: string) => {
    const profile = profileStore.get(profileId);
    if (!profile) {
      throw new Error('No se encontró el perfil para conectar.');
    }

    await sshService.connect(profile);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.sshDisconnect, (_event, profileId: string) => sshService.disconnect(profileId));

  ipcMain.handle(IPC_CHANNELS.sftpListDirectory, (_event, profileId: string, remotePath: string) =>
    sshService.listDirectory(profileId, remotePath),
  );

  ipcMain.handle(IPC_CHANNELS.sftpDownload, async (_event, profileId: string, remotePath: string) => {
    const mainWindow = getMainWindow();
    const options: SaveDialogOptions = {
      defaultPath: path.basename(remotePath),
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    await sshService.downloadFile(profileId, remotePath, result.filePath);
    return { success: true, path: result.filePath };
  });

  ipcMain.handle(
    IPC_CHANNELS.sftpSearchInDirectory,
    (_event, profileId: string, remotePath: string, query: string, options?: { recursive?: boolean; filePattern?: string }) =>
      sshService.searchInDirectory(profileId, remotePath, query, options),
  );

  ipcMain.handle(
    IPC_CHANNELS.bookmarksAdd,
    (_event, profileId: string, bookmark: { name: string; path: string; isLogDirectory: boolean }) =>
      profileStore.addBookmark(profileId, bookmark),
  );

  ipcMain.handle(IPC_CHANNELS.bookmarksRemove, (_event, profileId: string, bookmarkId: string) => {
    profileStore.removeBookmark(profileId, bookmarkId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.logsGetFileInfo, (_event, profileId: string, filePath: string) =>
    sshService.getFileInfo(profileId, filePath),
  );

  ipcMain.handle(
    IPC_CHANNELS.logsReadLines,
    (_event, profileId: string, filePath: string, options: { lines?: number; all?: boolean; fromStart?: boolean }) =>
      sshService.readLines(profileId, filePath, options),
  );

  ipcMain.handle(IPC_CHANNELS.logsStartTail, (_event, profileId: string, filePath: string, initialLines: number) =>
    sshService.startTail(profileId, filePath, initialLines),
  );

  ipcMain.handle(IPC_CHANNELS.logsStopTail, (_event, tailId: string) => sshService.stopTail(tailId));
  ipcMain.handle(IPC_CHANNELS.logsSearchByDateRange, (_event, profileId: string, filePath: string, startDate: string, endDate: string) =>
    sshService.searchByDateRange(profileId, filePath, startDate, endDate),
  );
  ipcMain.handle(IPC_CHANNELS.logsGrep, (_event, profileId: string, filePath: string, query: string, options?: { ignoreCase?: boolean; context?: number }) =>
    sshService.grep(profileId, filePath, query, options),
  );

  ipcMain.handle(IPC_CHANNELS.terminalStart, (_event, profileId: string) => sshService.startTerminal(profileId));
  ipcMain.handle(IPC_CHANNELS.terminalWrite, (_event, profileId: string, data: string) => {
    sshService.writeTerminal(profileId, data);
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.terminalResize, (_event, profileId: string, cols: number, rows: number) => {
    sshService.resizeTerminal(profileId, cols, rows);
    return true;
  });
  ipcMain.handle(IPC_CHANNELS.terminalStop, (_event, profileId: string) => {
    sshService.stopTerminal(profileId);
    return true;
  });

  sshService.on('connection-closed', (profileId: string) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send(IPC_CHANNELS.sshConnectionClosed, profileId);
  });

  sshService.on('log-data', (payload: { tailId: string; data: string }) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send(IPC_CHANNELS.logsData, payload);
  });

  sshService.on('terminal-data', (payload: { profileId: string; data: string }) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send(IPC_CHANNELS.terminalData, payload);
  });
}
