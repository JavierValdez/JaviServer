import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  LegacyMigrationItem,
  LegacyMigrationItemId,
  LegacyMigrationStatus,
} from '../../src/types/migration';

const MIGRATION_REQUEST_FILE = 'artishell-migration-request.json';
const MIGRATION_MARKER_FILE = 'artishell-migration.json';
const MIGRATION_BACKUP_DIRECTORY = 'migration-backups';

const ITEM_LABELS: Record<LegacyMigrationItemId, string> = {
  profiles: 'Perfiles SSH, credenciales, bookmarks y patrones de logs',
  'agent-integration': 'Configuracion, permisos y token de la integracion IA',
  activity: 'Historial local de actividad MCP',
  preferences: 'Tema y preferencias locales de la aplicacion',
};

const ITEM_ORDER: LegacyMigrationItemId[] = [
  'profiles',
  'agent-integration',
  'activity',
  'preferences',
];

const STATIC_MIGRATION_ENTRIES = new Set([
  'server-profiles.json',
  'server-profiles.staged.json',
  'agent-integration.json',
  'javiserver-agent-activity.json',
  'artishell-agent-activity.json',
  'Local Storage',
  'Preferences',
  '.updaterId',
]);

interface MigrationRequest {
  sourcePath: string;
  requestedAt: string;
}

interface MigrationMarker {
  status: 'completed' | 'failed';
  sourcePath: string;
  items: LegacyMigrationItem[];
  migratedAt: string;
  backupCreated: boolean;
  acknowledged: boolean;
  error: string | null;
}

interface LegacySource {
  path: string;
  items: LegacyMigrationItem[];
  modifiedAt: number;
}

export interface LegacyMigrationServiceOptions {
  targetUserDataPath: string;
  legacyUserDataPaths: string[];
  now?: () => Date;
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function isProfileEntry(name: string): boolean {
  return name === 'server-profiles.json'
    || name === 'server-profiles.staged.json'
    || /^server-profiles\.json\.bak\./.test(name);
}

function shouldMigrateEntry(name: string): boolean {
  return STATIC_MIGRATION_ENTRIES.has(name) || isProfileEntry(name);
}

function toPublicStatus(
  state: LegacyMigrationStatus['state'],
  source: LegacySource | null,
  marker?: MigrationMarker | null,
): LegacyMigrationStatus {
  return {
    state,
    sourceAppName: 'JaviServer',
    targetAppName: 'ArtiShell',
    sourceDirectoryName: source ? path.basename(source.path) : marker ? path.basename(marker.sourcePath) : null,
    items: marker?.items ?? source?.items ?? [],
    migratedAt: marker?.migratedAt ?? null,
    backupCreated: marker?.backupCreated ?? false,
    acknowledged: marker?.acknowledged ?? false,
    error: marker?.error ?? null,
  };
}

export class LegacyMigrationService {
  private readonly targetUserDataPath: string;
  private readonly legacyUserDataPaths: string[];
  private readonly now: () => Date;

  constructor(options: LegacyMigrationServiceOptions) {
    this.targetUserDataPath = path.resolve(options.targetUserDataPath);
    this.legacyUserDataPaths = options.legacyUserDataPaths.map((candidate) => path.resolve(candidate));
    this.now = options.now ?? (() => new Date());
  }

  async getStatus(): Promise<LegacyMigrationStatus> {
    const marker = await this.readMarker();
    if (marker?.status === 'completed') {
      return toPublicStatus('completed', null, marker);
    }

    const source = await this.findLegacySource();
    if (marker?.status === 'failed') {
      return toPublicStatus('failed', source, marker);
    }

    const request = await this.readRequest();
    if (request) {
      return toPublicStatus('pending', source);
    }

    return source
      ? toPublicStatus('available', source)
      : toPublicStatus('unavailable', null);
  }

  async prepareMigration(): Promise<LegacyMigrationStatus> {
    const source = await this.findLegacySource();
    if (!source) {
      return toPublicStatus('unavailable', null);
    }

    const request: MigrationRequest = {
      sourcePath: source.path,
      requestedAt: this.now().toISOString(),
    };
    await writeJson(this.requestPath, request);
    return toPublicStatus('pending', source);
  }

  async runPendingMigration(): Promise<boolean> {
    const request = await this.readRequest();
    if (!request) {
      return false;
    }

    const source = await this.inspectSource(request.sourcePath);
    if (!source || !await this.isAllowedSource(source.path)) {
      await this.writeFailureMarker(request.sourcePath, [], 'No se encontro una instalacion valida de JaviServer.');
      await this.removeRequest();
      return false;
    }

    let backupCreated = false;
    try {
      await fs.mkdir(this.targetUserDataPath, { recursive: true });
      const targetEntries = await this.listMigratableEntries(this.targetUserDataPath);
      if (targetEntries.length > 0) {
        const backupPath = path.join(
          this.targetUserDataPath,
          MIGRATION_BACKUP_DIRECTORY,
          this.now().toISOString().replace(/[:.]/g, '-'),
        );
        await this.copyEntries(this.targetUserDataPath, backupPath, targetEntries, false);
        backupCreated = true;
      }

      const sourceEntries = await this.listMigratableEntries(source.path);
      await this.copyEntries(source.path, this.targetUserDataPath, sourceEntries, true);
      await fs.rm(path.join(this.targetUserDataPath, 'javiserver-agent-activity.json'), { force: true });

      const marker: MigrationMarker = {
        status: 'completed',
        sourcePath: source.path,
        items: source.items,
        migratedAt: this.now().toISOString(),
        backupCreated,
        acknowledged: false,
        error: null,
      };
      await writeJson(this.markerPath, marker);
      await this.removeRequest();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.writeFailureMarker(source.path, source.items, message, backupCreated);
      await this.removeRequest();
      return false;
    }
  }

  async acknowledgeCompletion(): Promise<LegacyMigrationStatus> {
    const marker = await this.readMarker();
    if (!marker) {
      return this.getStatus();
    }

    marker.acknowledged = true;
    await writeJson(this.markerPath, marker);
    return toPublicStatus(marker.status === 'completed' ? 'completed' : 'failed', null, marker);
  }

  private get requestPath(): string {
    return path.join(this.targetUserDataPath, MIGRATION_REQUEST_FILE);
  }

  private get markerPath(): string {
    return path.join(this.targetUserDataPath, MIGRATION_MARKER_FILE);
  }

  private async readRequest(): Promise<MigrationRequest | null> {
    return readJson<MigrationRequest>(this.requestPath);
  }

  private async readMarker(): Promise<MigrationMarker | null> {
    return readJson<MigrationMarker>(this.markerPath);
  }

  private async removeRequest(): Promise<void> {
    await fs.rm(this.requestPath, { force: true });
  }

  private async writeFailureMarker(
    sourcePath: string,
    items: LegacyMigrationItem[],
    error: string,
    backupCreated = false,
  ): Promise<void> {
    await writeJson(this.markerPath, {
      status: 'failed',
      sourcePath,
      items,
      migratedAt: this.now().toISOString(),
      backupCreated,
      acknowledged: false,
      error,
    } satisfies MigrationMarker);
  }

  private async findLegacySource(): Promise<LegacySource | null> {
    const seen = new Set<string>();
    const sources: LegacySource[] = [];

    for (const candidate of this.legacyUserDataPaths) {
      if (!await pathExists(candidate)) continue;
      const realPath = await fs.realpath(candidate).catch(() => candidate);
      const normalized = path.normalize(realPath).toLowerCase();
      if (seen.has(normalized) || path.resolve(realPath) === this.targetUserDataPath) continue;
      seen.add(normalized);

      const source = await this.inspectSource(realPath);
      if (source) sources.push(source);
    }

    sources.sort((left, right) => {
      if (right.items.length !== left.items.length) return right.items.length - left.items.length;
      return right.modifiedAt - left.modifiedAt;
    });
    return sources[0] ?? null;
  }

  private async inspectSource(sourcePath: string): Promise<LegacySource | null> {
    if (!await pathExists(sourcePath)) return null;
    const entries = await this.listMigratableEntries(sourcePath);
    if (entries.length === 0) return null;

    const itemIds = new Set<LegacyMigrationItemId>();
    for (const name of entries) {
      if (isProfileEntry(name)) itemIds.add('profiles');
      if (name === 'agent-integration.json') itemIds.add('agent-integration');
      if (name === 'javiserver-agent-activity.json' || name === 'artishell-agent-activity.json') {
        itemIds.add('activity');
      }
      if (name === 'Local Storage' || name === 'Preferences' || name === '.updaterId') itemIds.add('preferences');
    }

    const stat = await fs.stat(sourcePath);
    return {
      path: sourcePath,
      items: ITEM_ORDER
        .filter((id) => itemIds.has(id))
        .map((id) => ({ id, label: ITEM_LABELS[id] })),
      modifiedAt: stat.mtimeMs,
    };
  }

  private async isAllowedSource(sourcePath: string): Promise<boolean> {
    const sourceRealPath = await fs.realpath(sourcePath).catch(() => path.resolve(sourcePath));
    for (const candidate of this.legacyUserDataPaths) {
      const candidateRealPath = await fs.realpath(candidate).catch(() => path.resolve(candidate));
      if (path.normalize(candidateRealPath).toLowerCase() === path.normalize(sourceRealPath).toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  private async listMigratableEntries(directory: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      return entries
        .filter((entry) => shouldMigrateEntry(entry.name))
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private async copyEntries(
    sourceRoot: string,
    targetRoot: string,
    entries: string[],
    renameActivity: boolean,
  ): Promise<void> {
    await fs.mkdir(targetRoot, { recursive: true });
    for (const entry of entries) {
      const source = path.join(sourceRoot, entry);
      const targetName = renameActivity && entry === 'javiserver-agent-activity.json'
        ? 'artishell-agent-activity.json'
        : entry;
      const target = path.join(targetRoot, targetName);
      if (renameActivity) {
        // Directorios como Local Storage contienen LevelDB y no deben mezclarse.
        await fs.rm(target, { recursive: true, force: true });
      }
      await fs.cp(source, target, {
        recursive: true,
        force: true,
        preserveTimestamps: true,
      });
    }
  }
}
