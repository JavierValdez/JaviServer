import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_COMMAND_OUTPUT_BYTES,
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_COMMAND_OUTPUT_BYTES,
  MAX_COMMAND_TIMEOUT_MS,
  classifyCommand,
  normalizeRunCommandOptions,
} from '../electron/agent/command-policy';

test('command policy allows clear read-only investigation commands', () => {
  assert.equal(classifyCommand('ls -la /var/log').requiresConfirmation, false);
  assert.equal(classifyCommand('journalctl -u nginx -n 200').requiresConfirmation, false);
  assert.equal(classifyCommand('systemctl status nginx').requiresConfirmation, false);
  assert.equal(classifyCommand('docker ps --format json').requiresConfirmation, false);
  assert.equal(classifyCommand('git diff -- README.md').requiresConfirmation, false);
});

test('command policy requires confirmation for mutable or ambiguous commands', () => {
  assert.equal(classifyCommand('rm -rf /tmp/cache').requiresConfirmation, true);
  assert.equal(classifyCommand('systemctl restart nginx').requiresConfirmation, true);
  assert.equal(classifyCommand('sed -i s/a/b/g config.txt').requiresConfirmation, true);
  assert.equal(classifyCommand('cat app.log > copy.log').requiresConfirmation, true);
  assert.equal(classifyCommand('ps aux | grep node').requiresConfirmation, true);
  assert.equal(classifyCommand('custom-maintenance --inspect').requiresConfirmation, true);
});

test('command options normalize defaults and cap limits', () => {
  assert.deepEqual(normalizeRunCommandOptions({}), {
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_COMMAND_OUTPUT_BYTES,
    cwd: undefined,
  });

  assert.deepEqual(normalizeRunCommandOptions({
    cwd: ' /var/log ',
    timeoutMs: MAX_COMMAND_TIMEOUT_MS + 10_000,
    maxOutputBytes: MAX_COMMAND_OUTPUT_BYTES + 10,
  }), {
    cwd: '/var/log',
    timeoutMs: MAX_COMMAND_TIMEOUT_MS,
    maxOutputBytes: MAX_COMMAND_OUTPUT_BYTES,
  });
});
