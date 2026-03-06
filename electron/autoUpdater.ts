import { spawnSync } from 'node:child_process';
import { app, BrowserWindow, dialog, shell, type MessageBoxOptions } from 'electron';
import { autoUpdater } from 'electron-updater';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASES_URL = 'https://github.com/JavierValdez/JaviServer/releases/latest';

function isMacAppSigned(): boolean {
  if (process.platform !== 'darwin') {
    return true;
  }

  const result = spawnSync('codesign', ['-dv', process.execPath], {
    stdio: 'ignore',
  });

  return result.status === 0;
}

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
    const canInstallInPlace = isMacAppSigned();
    const options: MessageBoxOptions = canInstallInPlace
      ? {
          type: 'info',
          buttons: ['Instalar ahora', 'Más tarde'],
          defaultId: 0,
          cancelId: 1,
          title: 'Actualización lista',
          message: `JaviServer ${info.version} ya se descargó.`,
          detail: 'La aplicación se reiniciará para completar la instalación.',
        }
      : {
          type: 'warning',
          buttons: ['Abrir release', 'Más tarde'],
          defaultId: 0,
          cancelId: 1,
          title: 'Actualización descargada',
          message: `JaviServer ${info.version} ya está disponible.`,
          detail: 'Esta copia de macOS no está firmada, así que la instalación automática no puede reemplazar la app actual. Se abrirá la página de releases para descargarla e instalarla manualmente.',
        };
    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) {
      if (canInstallInPlace) {
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
      } else {
        await shell.openExternal(RELEASES_URL);
      }
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
