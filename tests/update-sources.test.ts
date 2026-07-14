import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkWithUpdateSourceFallback,
  resolveUpdateAssetUrl,
  UpdateSourcesUnavailableError,
} from '../electron/services/updateSources';

test('uses GitHub without consulting Cloud Storage when GitHub succeeds', async () => {
  const calls: string[] = [];
  const selected = await checkWithUpdateSourceFallback(async (source) => {
    calls.push(source);
    return { version: '2.3.0' };
  });

  assert.equal(selected.source, 'github');
  assert.deepEqual(selected.result, { version: '2.3.0' });
  assert.deepEqual(calls, ['github']);
});

test('falls back to Cloud Storage only when GitHub fails', async () => {
  const calls: string[] = [];
  const fallbackErrors: unknown[] = [];
  const selected = await checkWithUpdateSourceFallback(async (source) => {
    calls.push(source);
    if (source === 'github') throw new Error('GitHub unavailable');
    return { version: '2.3.0' };
  }, (error) => fallbackErrors.push(error));

  assert.equal(selected.source, 'gcs');
  assert.deepEqual(calls, ['github', 'gcs']);
  assert.equal(fallbackErrors.length, 1);
});

test('treats an empty GitHub result as a failure and reports both source errors', async () => {
  await assert.rejects(
    checkWithUpdateSourceFallback(async (source) => {
      if (source === 'github') return null;
      throw new Error('GCS unavailable');
    }),
    (error: unknown) => {
      assert.ok(error instanceof UpdateSourcesUnavailableError);
      assert.match(error.message, /GitHub Releases no devolvio una respuesta valida/);
      assert.match(error.message, /GCS unavailable/);
      return true;
    },
  );
});

test('resolves relative assets against the selected update source', () => {
  assert.equal(
    resolveUpdateAssetUrl({
      assetUrl: 'ArtiShell Windows 2.3.0.exe',
      source: 'github',
      version: '2.3.0',
      tag: 'v2.3.0',
    }),
    'https://github.com/JavierValdez/JaviServer/releases/download/v2.3.0/ArtiShell-Windows-2.3.0.exe',
  );

  assert.equal(
    resolveUpdateAssetUrl({
      assetUrl: 'v2.3.0/ArtiShell-Windows-2.3.0.exe',
      source: 'gcs',
      version: '2.3.0',
    }),
    'https://storage.googleapis.com/artictools-releases/javiserver/releases/v2.3.0/ArtiShell-Windows-2.3.0.exe',
  );
});

test('preserves absolute asset URLs', () => {
  const absoluteUrl = 'https://cdn.example.com/ArtiShell.dmg';
  assert.equal(resolveUpdateAssetUrl({
    assetUrl: absoluteUrl,
    source: 'github',
    version: '2.3.0',
  }), absoluteUrl);
});
