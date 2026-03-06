import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { setupAutoUpdater } from './autoUpdater';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { ProfileStore } from './services/ProfileStore';
import { SSHService } from './services/SSHService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#1a1b26',
    title: 'JaviServer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.javierserver.app');

  const profileStore = new ProfileStore();
  const sshService = new SSHService();
  const updater = setupAutoUpdater();

  mainWindow = createMainWindow();
  registerIpcHandlers(() => mainWindow, profileStore, sshService, updater);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
