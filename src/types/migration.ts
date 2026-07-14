export type LegacyMigrationState = 'unavailable' | 'available' | 'pending' | 'completed' | 'failed';

export type LegacyMigrationItemId = 'profiles' | 'agent-integration' | 'activity' | 'preferences';

export interface LegacyMigrationItem {
  id: LegacyMigrationItemId;
  label: string;
}

export interface LegacyMigrationStatus {
  state: LegacyMigrationState;
  sourceAppName: 'JaviServer';
  targetAppName: 'ArtiShell';
  sourceDirectoryName: string | null;
  items: LegacyMigrationItem[];
  migratedAt: string | null;
  backupCreated: boolean;
  acknowledged: boolean;
  error: string | null;
}
