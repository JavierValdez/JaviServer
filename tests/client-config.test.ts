import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAgentClientLaunchConfig } from '../electron/agent/client-config';

test('client config clears ELECTRON_RUN_AS_NODE on macOS', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'darwin',
    execPath: '/Applications/ArtiShell.app/Contents/MacOS/ArtiShell',
    launchArgs: ['--mcp-stdio'],
  }), {
    command: '/usr/bin/env',
    args: [
      '-u',
      'ELECTRON_RUN_AS_NODE',
      '/Applications/ArtiShell.app/Contents/MacOS/ArtiShell',
      '--mcp-stdio',
    ],
  });
});

test('client config clears ELECTRON_RUN_AS_NODE on Windows through cmd.exe', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'win32',
    execPath: 'D:\\Users\\javier\\AppData\\Local\\Programs\\ArtiShell\\ArtiShell.exe',
    launchArgs: ['--mcp-stdio'],
    comSpec: 'C:\\Windows\\System32\\cmd.exe',
  }), {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: [
      '/d',
      '/s',
      '/c',
      'set "ELECTRON_RUN_AS_NODE=" && "D:\\Users\\javier\\AppData\\Local\\Programs\\ArtiShell\\ArtiShell.exe" "--mcp-stdio"',
    ],
  });
});

test('client config uses direct launch on other platforms', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'linux',
    execPath: '/opt/ArtiShell/artishell',
    launchArgs: ['--mcp-stdio'],
  }), {
    command: '/opt/ArtiShell/artishell',
    args: ['--mcp-stdio'],
  });
});
