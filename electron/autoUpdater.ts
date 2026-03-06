import { app, BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { autoUpdater } from 'electron-updater';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.info('[updater] Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', (info) => {
    console.info(`[updater] Actualización disponible: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.info('[updater] No hay nuevas versiones disponibles.');
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] Error al buscar actualizaciones:', error);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const mainWindow = getMainWindow();
    const options: MessageBoxOptions = {
      type: 'info',
      buttons: ['Instalar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `JaviServer ${info.version} ya se descargó.`,
      detail: 'La aplicación se reiniciará para completar la instalación.',
    };
    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  const checkForUpdates = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[updater] Falló la verificación automática:', error);
    }
  };

  void checkForUpdates();
  setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
}
