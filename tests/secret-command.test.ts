import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import {
  buildSecretStdin,
  buildSecretWrapper,
  normalizeSecretSpecs,
  redactSecrets,
  validateSecretValues,
} from '../electron/agent/secret-command';

test('normalizeSecretSpecs validates names and defaults sensitive to true', () => {
  const specs = normalizeSecretSpecs([
    { name: 'XWIKI_USER', label: 'Usuario', sensitive: false },
    { name: 'XWIKI_PASSWORD', label: 'Contraseña' },
  ]);
  assert.deepEqual(specs, [
    { name: 'XWIKI_USER', label: 'Usuario', sensitive: false },
    { name: 'XWIKI_PASSWORD', label: 'Contraseña', sensitive: true },
  ]);

  assert.throws(() => normalizeSecretSpecs([]), /al menos un secreto/);
  assert.throws(() => normalizeSecretSpecs([{ name: 'bad-name', label: 'x' }]), /invalido/);
  assert.throws(() => normalizeSecretSpecs([{ name: 'PATH', label: 'x' }]), /reservado/);
  assert.throws(() => normalizeSecretSpecs([{ name: 'ARTISHELL_X', label: 'x' }]), /invalido/);
  assert.throws(
    () => normalizeSecretSpecs([{ name: 'A_B', label: 'x' }, { name: 'A_B', label: 'y' }]),
    /duplicado/,
  );
  assert.throws(() => normalizeSecretSpecs('$(rm -rf /)'), /al menos un secreto/);
});

test('validateSecretValues rejects missing values and newlines', () => {
  const specs = normalizeSecretSpecs([{ name: 'TOKEN', label: 'Token' }]);
  assert.throws(() => validateSecretValues(specs, {}), /Falta el valor/);
  assert.throws(() => validateSecretValues(specs, { TOKEN: 'a\nb' }), /saltos de linea/);
  validateSecretValues(specs, { TOKEN: 'ok' });
});

test('wrapper exports secrets from stdin without putting them in the command line', () => {
  const specs = normalizeSecretSpecs([
    { name: 'XWIKI_USER', label: 'Usuario', sensitive: false },
    { name: 'XWIKI_PASSWORD', label: 'Contraseña' },
  ]);
  const values = { XWIKI_USER: 'javier', XWIKI_PASSWORD: `p@ss w'o"rd $(id) \`x\` ;|&` };
  const wrapper = buildSecretWrapper(specs, 'printf "%s|%s|" "$XWIKI_USER" "$XWIKI_PASSWORD"; cat; echo fin');
  assert.ok(!wrapper.includes('javier'));
  assert.ok(!wrapper.includes('p@ss'));

  for (const shell of ['/bin/sh', '/bin/bash', '/bin/zsh']) {
    const output = execFileSync(shell, ['-c', wrapper], { input: buildSecretStdin(specs, values) }).toString();
    // El comando ve los valores literales y su stdin queda cerrado (cat no lee nada).
    assert.equal(output, `javier|${values.XWIKI_PASSWORD}|fin\n`, shell);
  }
});

test('wrapper fails when stdin does not provide every secret', () => {
  const specs = normalizeSecretSpecs([{ name: 'A_1', label: 'a' }, { name: 'B_2', label: 'b' }]);
  assert.throws(
    () => execFileSync('/bin/sh', ['-c', buildSecretWrapper(specs, 'echo nunca')], { input: 'solo-uno\n', stdio: 'pipe' }),
    (error: NodeJS.ErrnoException & { status?: number }) => error.status === 97,
  );
});

test('redactSecrets hides sensitive values only', () => {
  const specs = normalizeSecretSpecs([
    { name: 'USER_NAME', label: 'Usuario', sensitive: false },
    { name: 'PASS_WORD', label: 'Contraseña' },
  ]);
  const values = { USER_NAME: 'javier', PASS_WORD: 's3cr3t' };
  assert.equal(
    redactSecrets('user=javier pass=s3cr3t again s3cr3t', specs, values),
    'user=javier pass=*** again ***',
  );
});
