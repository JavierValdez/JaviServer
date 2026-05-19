import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import {
  configureAgentIntegration,
  startAgentBrokerIfEnabled,
  stopAgentBroker,
} from './agent/integration';
import { runMcpServerMode } from './agent/mcp-server';
import { setupAutoUpdater } from './autoUpdater';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { ProfileStore } from './services/ProfileStore';
import { SSHService } from './services/SSHService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isMcpStdioMode = process.argv.includes('--mcp-stdio');

app.name = 'JaviServer';

if (isMcpStdioMode) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory');
  }
}

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
  if (isMcpStdioMode) {
    return;
  }

  app.setAppUserModelId('com.javierserver.app');

  const profileStore = new ProfileStore();
  const sshService = new SSHService();
  const updater = setupAutoUpdater();
  configureAgentIntegration(profileStore, sshService);

  mainWindow = createMainWindow();
  registerIpcHandlers(() => mainWindow, profileStore, sshService, updater);
  void startAgentBrokerIfEnabled().catch((error) => {
    console.error('[agent] No se pudo iniciar el broker MCP:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

if (isMcpStdioMode) {
  void runMcpServerMode().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo iniciar el MCP de JaviServer'}\n`);
    app.exit(1);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void stopAgentBroker();
});
