import path from 'node:path';
import { createWriteStream, promises as fs } from 'node:fs';
import { EventEmitter } from 'node:events';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { app, shell } from 'electron';
import { autoUpdater, type UpdateInfo, type UpdateFileInfo } from 'electron-updater';
import type { AppUpdateState } from '../src/types/updater';

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RELEASE_DOWNLOADS_URL = 'https://github.com/JavierValdez/JaviServer/releases/download';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/JavierValdez/JaviServer/releases/latest';

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  name?: string;
  body?: string | null;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubReleaseAsset[];
}

export interface UpdateController {
  getState: () => AppUpdateState;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadInstaller: () => Promise<AppUpdateState>;
  revealInstaller: () => Promise<boolean>;
  onStateChange: (listener: (state: AppUpdateState) => void) => () => void;
}

const stateEmitter = new EventEmitter();

let updateState: AppUpdateState = {
  currentVersion: app.getVersion(),
  status: app.isPackaged ? 'idle' : 'disabled',
  latestVersion: null,
  message: app.isPackaged
    ? 'Listo para revisar actualizaciones.'
    : 'Las actualizaciones solo funcionan en la app instalada.',
  checkedAt: null,
  downloadProgress: null,
  downloadedInstallerPath: null,
  downloadedVersion: null,
};

let latestUpdateInfo: UpdateInfo | null = null;
let checkPromise: Promise<AppUpdateState> | null = null;
let downloadPromise: Promise<AppUpdateState> | null = null;

function getState(): AppUpdateState {
  return { ...updateState };
}

function setState(partial: Partial<AppUpdateState>): AppUpdateState {
  updateState = {
    ...updateState,
    ...partial,
  };

  const snapshot = getState();
  stateEmitter.emit('state-changed', snapshot);
  return snapshot;
}

function encodeAssetPath(assetPath: string): string {
  return assetPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getReleaseAssetUrl(version: string, assetUrl: string): string {
  if (/^https?:\/\//.test(assetUrl)) {
    return assetUrl;
  }

  return `${RELEASE_DOWNLOADS_URL}/v${version}/${encodeAssetPath(assetUrl)}`;
}

function selectInstallerAsset(updateInfo: UpdateInfo): UpdateFileInfo | null {
  if (process.platform === 'darwin') {
    return updateInfo.files.find((file) => file.url.endsWith('.dmg')) ?? null;
  }

  if (process.platform === 'win32') {
    return updateInfo.files.find((file) => file.url.endsWith('.exe')) ?? null;
  }

  return null;
}

function normalizeVersion(value: string | null | undefined): string {
  return String(value || '').trim().replace(/^v/i, '');
}

function parseVersionParts(version: string): number[] {
  return normalizeVersion(version)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function isRemoteVersionNewer(remoteVersion: string, currentVersion: string): boolean {
  const remoteParts = parseVersionParts(remoteVersion);
  const currentParts = parseVersionParts(currentVersion);
  const maxLength = Math.max(remoteParts.length, currentParts.length, 3);

  for (let index = 0; index < maxLength; index += 1) {
    const remotePart = remoteParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (remotePart > currentPart) {
      return true;
    }
    if (remotePart < currentPart) {
      return false;
    }
  }

  return false;
}

function selectReleaseAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  if (process.platform === 'darwin') {
    return assets.find((asset) => asset.name.endsWith('.dmg')) ?? null;
  }

  if (process.platform === 'win32') {
    return assets.find((asset) => asset.name.endsWith('.exe')) ?? null;
  }

  return null;
}

function buildUpdateInfoFromRelease(release: GitHubReleasePayload): UpdateInfo | null {
  if (release.draft || release.prerelease) {
    return null;
  }

  const version = normalizeVersion(release.tag_name || release.name);
  const asset = selectReleaseAsset(release.assets || []);
  if (!version || !asset) {
    return null;
  }

  return {
    version,
    files: [{
      url: asset.browser_download_url || asset.name,
      size: asset.size,
      sha512: '',
    }],
    path: asset.browser_download_url || asset.name,
    sha512: '',
    releaseName: release.name || release.tag_name || null,
    releaseNotes: release.body || null,
    releaseDate: release.published_at || new Date().toISOString(),
  };
}

async function fetchLatestReleaseUpdateInfo(): Promise<UpdateInfo | null> {
  const response = await fetch(LATEST_RELEASE_API_URL, {
    headers: {
      'User-Agent': `${app.getName()}/${app.getVersion()}`,
      Accept: 'application/vnd.github+json',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases respondio con estado ${response.status}.`);
  }

  return buildUpdateInfoFromRelease(await response.json() as GitHubReleasePayload);
}

async function checkGitHubReleaseFallback(): Promise<AppUpdateState> {
  const updateInfo = await fetchLatestReleaseUpdateInfo();
  if (!updateInfo) {
    return setState({
      status: 'error',
      message: 'No se encontro un instalador compatible en el ultimo release.',
      checkedAt: new Date().toISOString(),
      downloadProgress: null,
    });
  }

  latestUpdateInfo = updateInfo;

  if (!isRemoteVersionNewer(updateInfo.version, app.getVersion())) {
    return setState({
      status: 'up-to-date',
      latestVersion: updateInfo.version,
      message: 'Ya tienes la ultima version.',
      checkedAt: new Date().toISOString(),
      downloadProgress: null,
      downloadedInstallerPath: null,
      downloadedVersion: null,
    });
  }

  const existingDownload = await syncExistingDownload(updateInfo);
  if (existingDownload) {
    return existingDownload;
  }

  return setState({
    status: 'available',
    latestVersion: updateInfo.version,
    message: `Hay una actualizacion disponible: ${updateInfo.version}.`,
    checkedAt: new Date().toISOString(),
    downloadProgress: null,
    downloadedInstallerPath: null,
    downloadedVersion: null,
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function syncExistingDownload(updateInfo: UpdateInfo): Promise<AppUpdateState | null> {
  const installerAsset = selectInstallerAsset(updateInfo);
  if (!installerAsset) {
    return null;
  }

  const downloadsPath = app.getPath('downloads');
  const targetPath = path.join(downloadsPath, path.basename(installerAsset.url));

  if (!(await fileExists(targetPath))) {
    return null;
  }

  if (typeof installerAsset.size === 'number') {
    const stats = await fs.stat(targetPath);
    if (stats.size !== installerAsset.size) {
      return null;
    }
  }

  return setState({
    status: 'downloaded',
    latestVersion: updateInfo.version,
    message: `El instalador ${path.basename(targetPath)} ya está en Descargas.`,
    checkedAt: new Date().toISOString(),
    downloadProgress: 100,
    downloadedInstallerPath: targetPath,
    downloadedVersion: updateInfo.version,
  });
}

function createDownloadProgressStream(totalBytes: number) {
  let receivedBytes = 0;

  return new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += chunk.length;

      setState({
        status: 'downloading',
        message:
          totalBytes > 0
            ? `Descargando instalador... ${Math.min(99, Math.round((receivedBytes / totalBytes) * 100))}%`
            : 'Descargando instalador...',
        downloadProgress: totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : null,
      });

      callback(null, chunk);
    },
  });
}

async function checkForUpdates(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    return setState({
      status: 'disabled',
      message: 'Las actualizaciones solo funcionan en la app instalada.',
      checkedAt: new Date().toISOString(),
    });
  }

  if (checkPromise) {
    return checkPromise;
  }

  if (downloadPromise) {
    return getState();
  }

  checkPromise = (async () => {
    setState({
      status: 'checking',
      message: 'Buscando actualizaciones...',
      downloadProgress: null,
    });

    try {
      try {
        return await checkGitHubReleaseFallback();
      } catch (releaseError) {
        console.warn('[updater] No se pudo consultar GitHub Releases API, usando metadata electron-updater:', releaseError);
      }

      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        return setState({
          status: 'error',
          message: 'No fue posible consultar actualizaciones en este momento.',
          checkedAt: new Date().toISOString(),
        });
      }

      latestUpdateInfo = result.updateInfo;

      if (!result.isUpdateAvailable) {
        return setState({
          status: 'up-to-date',
          latestVersion: result.updateInfo.version,
          message: 'Ya tienes la ultima version.',
          checkedAt: new Date().toISOString(),
          downloadProgress: null,
          downloadedInstallerPath: null,
          downloadedVersion: null,
        });
      }

      const existingDownload = await syncExistingDownload(result.updateInfo);
      if (existingDownload) {
        return existingDownload;
      }

      return setState({
        status: 'available',
        latestVersion: result.updateInfo.version,
        message: `Hay una actualizacion disponible: ${result.updateInfo.version}.`,
        checkedAt: new Date().toISOString(),
        downloadProgress: null,
        downloadedInstallerPath: null,
        downloadedVersion: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al buscar actualizaciones.';
      return setState({
        status: 'error',
        message,
        checkedAt: new Date().toISOString(),
        downloadProgress: null,
      });
    } finally {
      checkPromise = null;
    }
  })();

  return checkPromise;
}

async function downloadInstaller(): Promise<AppUpdateState> {
  if (!app.isPackaged) {
    return setState({
      status: 'disabled',
      message: 'Las actualizaciones solo funcionan en la app instalada.',
      checkedAt: new Date().toISOString(),
    });
  }

  if (downloadPromise) {
    return downloadPromise;
  }

  if (!latestUpdateInfo || updateState.status === 'idle' || updateState.status === 'error') {
    await checkForUpdates();
  }

  if (
    !latestUpdateInfo ||
    updateState.status === 'up-to-date' ||
    updateState.status === 'disabled' ||
    (updateState.status !== 'available' && updateState.status !== 'downloaded')
  ) {
    return getState();
  }

  if (
    updateState.status === 'downloaded' &&
    updateState.downloadedVersion === latestUpdateInfo.version &&
    updateState.downloadedInstallerPath &&
    (await fileExists(updateState.downloadedInstallerPath))
  ) {
    return getState();
  }

  const updateInfo = latestUpdateInfo;
  const installerAsset = selectInstallerAsset(updateInfo);
  if (!installerAsset) {
    return setState({
      status: 'error',
      message: 'No se encontro un instalador compatible para esta plataforma.',
      checkedAt: new Date().toISOString(),
    });
  }

  downloadPromise = (async () => {
    const downloadsPath = app.getPath('downloads');
    const targetPath = path.join(downloadsPath, path.basename(installerAsset.url));
    const tempPath = `${targetPath}.download`;

    setState({
      status: 'downloading',
      latestVersion: updateInfo.version,
      message: `Descargando ${path.basename(targetPath)}...`,
      downloadProgress: 0,
      downloadedInstallerPath: null,
      downloadedVersion: null,
    });

    try {
      const response = await fetch(getReleaseAssetUrl(updateInfo.version, installerAsset.url), {
        headers: {
          'User-Agent': `${app.getName()}/${app.getVersion()}`,
          Accept: 'application/octet-stream',
        },
        redirect: 'follow',
      });

      if (!response.ok || !response.body) {
        throw new Error(`La descarga fallo con estado ${response.status}.`);
      }

      const contentLength = Number(response.headers.get('content-length') ?? installerAsset.size ?? 0);
      const progressStream = createDownloadProgressStream(Number.isFinite(contentLength) ? contentLength : 0);

      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        progressStream,
        createWriteStream(tempPath),
      );

      await fs.rm(targetPath, { force: true });
      await fs.rename(tempPath, targetPath);

      return setState({
        status: 'downloaded',
        latestVersion: updateInfo.version,
        message: `Instalador descargado en Descargas: ${path.basename(targetPath)}.`,
        checkedAt: new Date().toISOString(),
        downloadProgress: 100,
        downloadedInstallerPath: targetPath,
        downloadedVersion: updateInfo.version,
      });
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      const message = error instanceof Error ? error.message : 'Error desconocido al descargar el instalador.';
      return setState({
        status: 'error',
        message,
        checkedAt: new Date().toISOString(),
        downloadProgress: null,
      });
    } finally {
      downloadPromise = null;
    }
  })();

  return downloadPromise;
}

async function revealInstaller(): Promise<boolean> {
  if (!updateState.downloadedInstallerPath || !(await fileExists(updateState.downloadedInstallerPath))) {
    setState({
      status: latestUpdateInfo ? 'available' : 'idle',
      message: 'No se encontro el instalador descargado. Puedes volver a descargarlo.',
      downloadedInstallerPath: null,
      downloadedVersion: null,
      downloadProgress: null,
    });
    return false;
  }

  shell.showItemInFolder(updateState.downloadedInstallerPath);
  return true;
}

export function setupAutoUpdater(): UpdateController {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.info('[updater] Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', (info) => {
    console.info(`[updater] Actualizacion disponible: ${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.info('[updater] No hay nuevas versiones disponibles.');
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] Error al buscar actualizaciones:', error);
  });

  if (app.isPackaged) {
    void checkForUpdates();
    setInterval(() => {
      void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);
  }

  return {
    getState,
    checkForUpdates,
    downloadInstaller,
    revealInstaller,
    onStateChange: (listener) => {
      stateEmitter.on('state-changed', listener);
      return () => stateEmitter.off('state-changed', listener);
    },
  };
}
