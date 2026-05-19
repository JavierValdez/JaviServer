import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAgentClientLaunchConfig } from '../electron/agent/client-config';

test('client config clears ELECTRON_RUN_AS_NODE on macOS', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'darwin',
    execPath: '/Applications/JaviServer.app/Contents/MacOS/JaviServer',
    launchArgs: ['--mcp-stdio'],
  }), {
    command: '/usr/bin/env',
    args: [
      '-u',
      'ELECTRON_RUN_AS_NODE',
      '/Applications/JaviServer.app/Contents/MacOS/JaviServer',
      '--mcp-stdio',
    ],
  });
});

test('client config clears ELECTRON_RUN_AS_NODE on Windows through cmd.exe', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'win32',
    execPath: 'D:\\Users\\javier\\AppData\\Local\\Programs\\javiserver\\JaviServer.exe',
    launchArgs: ['--mcp-stdio'],
    comSpec: 'C:\\Windows\\System32\\cmd.exe',
  }), {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: [
      '/d',
      '/s',
      '/c',
      'set "ELECTRON_RUN_AS_NODE=" && "D:\\Users\\javier\\AppData\\Local\\Programs\\javiserver\\JaviServer.exe" "--mcp-stdio"',
    ],
  });
});

test('client config uses direct launch on other platforms', () => {
  assert.deepEqual(buildAgentClientLaunchConfig({
    platform: 'linux',
    execPath: '/opt/JaviServer/javiserver',
    launchArgs: ['--mcp-stdio'],
  }), {
    command: '/opt/JaviServer/javiserver',
    args: ['--mcp-stdio'],
  });
});
