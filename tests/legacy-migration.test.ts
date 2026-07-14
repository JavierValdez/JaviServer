import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LegacyMigrationService } from '../electron/services/LegacyMigrationService';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(join(filePath, '..'), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('migrates all application data, preserves the source and backs up target data', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'artishell-migration-test-'));
  tempDirs.push(root);
  const legacy = join(root, 'JaviServer');
  const target = join(root, 'ArtiShell');
  const legacyProfiles = { profiles: [{ id: 'legacy-profile', name: 'Produccion' }] };
  const targetProfiles = { profiles: [{ id: 'new-profile', name: 'Temporal' }] };
  const agentIntegration = { agentIntegration: { enabled: true, tokenEncrypted: 'encrypted-token' } };
  const activity = [{ id: 'activity-1', action: 'list_servers' }];

  await writeJson(join(legacy, 'server-profiles.json'), legacyProfiles);
  await writeJson(join(legacy, 'server-profiles.staged.json'), { profiles: [] });
  await writeJson(join(legacy, 'server-profiles.json.bak.2026-07-01'), legacyProfiles);
  await writeJson(join(legacy, 'agent-integration.json'), agentIntegration);
  await writeJson(join(legacy, 'javiserver-agent-activity.json'), activity);
  await writeJson(join(legacy, 'Preferences'), { language: 'es' });
  await fs.mkdir(join(legacy, 'Local Storage', 'leveldb'), { recursive: true });
  await fs.writeFile(join(legacy, 'Local Storage', 'leveldb', '000003.log'), 'javiserver-theme=dark', 'utf8');
  await fs.writeFile(join(legacy, '.updaterId'), 'legacy-updater-id', 'utf8');
  await writeJson(join(target, 'server-profiles.json'), targetProfiles);
  await writeJson(join(target, 'javiserver-agent-activity.json'), [{ id: 'target-activity' }]);
  await writeJson(join(target, 'artishell-agent-activity.json'), [{ id: 'current-artishell-activity' }]);
  await fs.mkdir(join(target, 'Local Storage', 'leveldb'), { recursive: true });
  await fs.writeFile(join(target, 'Local Storage', 'leveldb', 'target-only.log'), 'target-only', 'utf8');

  const service = new LegacyMigrationService({
    targetUserDataPath: target,
    legacyUserDataPaths: [legacy],
    now: () => new Date('2026-07-13T18:20:30.000Z'),
  });

  const available = await service.getStatus();
  assert.equal(available.state, 'available');
  assert.deepEqual(available.items.map((item) => item.id), [
    'profiles',
    'agent-integration',
    'activity',
    'preferences',
  ]);

  const pending = await service.prepareMigration();
  assert.equal(pending.state, 'pending');
  assert.equal(await service.runPendingMigration(), true);

  assert.deepEqual(JSON.parse(await fs.readFile(join(target, 'server-profiles.json'), 'utf8')), legacyProfiles);
  assert.deepEqual(JSON.parse(await fs.readFile(join(target, 'agent-integration.json'), 'utf8')), agentIntegration);
  assert.deepEqual(JSON.parse(await fs.readFile(join(target, 'artishell-agent-activity.json'), 'utf8')), activity);
  await assert.rejects(fs.access(join(target, 'javiserver-agent-activity.json')));
  await assert.rejects(fs.access(join(target, 'Local Storage', 'leveldb', 'target-only.log')));
  assert.equal(await fs.readFile(join(target, 'Local Storage', 'leveldb', '000003.log'), 'utf8'), 'javiserver-theme=dark');
  assert.equal(await fs.readFile(join(target, '.updaterId'), 'utf8'), 'legacy-updater-id');
  assert.deepEqual(JSON.parse(await fs.readFile(join(legacy, 'server-profiles.json'), 'utf8')), legacyProfiles);

  const backupFile = join(
    target,
    'migration-backups',
    '2026-07-13T18-20-30-000Z',
    'server-profiles.json',
  );
  assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')), targetProfiles);
  assert.deepEqual(
    JSON.parse(await fs.readFile(join(
      target,
      'migration-backups',
      '2026-07-13T18-20-30-000Z',
      'artishell-agent-activity.json',
    ), 'utf8')),
    [{ id: 'current-artishell-activity' }],
  );

  const completed = await service.getStatus();
  assert.equal(completed.state, 'completed');
  assert.equal(completed.backupCreated, true);
  assert.equal(completed.acknowledged, false);

  const acknowledged = await service.acknowledgeCompletion();
  assert.equal(acknowledged.state, 'completed');
  assert.equal(acknowledged.acknowledged, true);
});

test('reports unavailable when no JaviServer data exists', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'artishell-migration-empty-test-'));
  tempDirs.push(root);
  const service = new LegacyMigrationService({
    targetUserDataPath: join(root, 'ArtiShell'),
    legacyUserDataPaths: [join(root, 'JaviServer')],
  });

  assert.equal((await service.getStatus()).state, 'unavailable');
  assert.equal((await service.prepareMigration()).state, 'unavailable');
  assert.equal(await service.runPendingMigration(), false);
});
