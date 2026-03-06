export type AppUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateState {
  currentVersion: string;
  status: AppUpdateStatus;
  latestVersion: string | null;
  message: string;
  checkedAt: string | null;
  downloadProgress: number | null;
  downloadedInstallerPath: string | null;
  downloadedVersion: string | null;
}
