import path from 'node:path';
import os from 'node:os';
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
import { LegacyMigrationService } from './services/LegacyMigrationService';
import { ProfileStore } from './services/ProfileStore';
import { SSHService } from './services/SSHService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isMcpStdioMode = process.argv.includes('--mcp-stdio')
  || process.env.ARTISHELL_MCP_STDIO === '1'
  || process.env.JAVISERVER_MCP_STDIO === '1'
  || !!process.env.ARTISHELL_MCP_TOKEN
  || !!process.env.JAVISERVER_MCP_TOKEN;

app.name = 'ArtiShell';

if (isMcpStdioMode) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory');
  }
}

let mainWindow: BrowserWindow | null = null;
let hasSingleInstanceLock = true;
let guiReady = false;
let shouldFocusWhenGuiReady = false;

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#1a1b26',
    title: 'ArtiShell',
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

function focusMainWindow(): void {
  if (!app.isReady() || !guiReady) {
    shouldFocusWhenGuiReady = true;
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

if (!isMcpStdioMode) {
  hasSingleInstanceLock = app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      focusMainWindow();
    });
  }
}

function getLegacyUserDataPaths(): string[] {
  const appData = app.getPath('appData');
  const candidates = [
    path.join(appData, 'JaviServer'),
    path.join(appData, 'javiserver'),
  ];

  if (process.platform === 'linux') {
    const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
    candidates.push(path.join(dataHome, 'JaviServer'), path.join(dataHome, 'javiserver'));
  }

  return candidates;
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) {
    return;
  }

  if (isMcpStdioMode) {
    return;
  }

  app.setAppUserModelId('com.javierserver.app');

  const legacyMigration = new LegacyMigrationService({
    targetUserDataPath: app.getPath('userData'),
    legacyUserDataPaths: getLegacyUserDataPaths(),
  });
  await legacyMigration.runPendingMigration();

  const profileStore = new ProfileStore();
  const sshService = new SSHService();
  const updater = setupAutoUpdater();
  configureAgentIntegration(profileStore, sshService);

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }
  registerIpcHandlers(
    () => mainWindow,
    profileStore,
    sshService,
    updater,
    legacyMigration,
    () => {
      app.relaunch();
      app.exit(0);
    },
  );
  guiReady = true;
  if (shouldFocusWhenGuiReady) {
    shouldFocusWhenGuiReady = false;
    focusMainWindow();
  }

  void startAgentBrokerIfEnabled().catch((error) => {
    console.error('[agent] No se pudo iniciar el broker MCP:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      return;
    }

    focusMainWindow();
  });
});

if (isMcpStdioMode) {
  void runMcpServerMode().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo iniciar el MCP de ArtiShell'}\n`);
    app.exit(1);
  });
}

app.on('window-all-closed', () => {
  if (isMcpStdioMode) return;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void stopAgentBroker();
});
