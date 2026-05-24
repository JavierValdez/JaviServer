import { safeStorage } from 'electron';
import Store from 'electron-store';
import {
  DEFAULT_COMMAND_PERMISSION_SETTINGS,
  type CommandPermissionSettings,
} from './command-policy';
import { generateAgentToken } from './token';

interface StoredAgentIntegration {
  enabled?: boolean;
  tokenEncrypted?: string;
  permissions?: Partial<CommandPermissionSettings>;
}

interface AgentIntegrationStoreSchema {
  agentIntegration: StoredAgentIntegration;
}

const store = new Store<AgentIntegrationStoreSchema>({
  name: 'agent-integration',
  defaults: {
    agentIntegration: {},
  },
});

function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }

  return safeStorage.encryptString(value).toString('base64');
}

function decryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }

  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return value;
  }
}

function normalizePermissionSettings(input?: Partial<CommandPermissionSettings>): CommandPermissionSettings {
  return {
    autoApproveReadCommands: typeof input?.autoApproveReadCommands === 'boolean'
      ? input.autoApproveReadCommands
      : DEFAULT_COMMAND_PERMISSION_SETTINGS.autoApproveReadCommands,
    autoApproveWriteCommands: typeof input?.autoApproveWriteCommands === 'boolean'
      ? input.autoApproveWriteCommands
      : DEFAULT_COMMAND_PERMISSION_SETTINGS.autoApproveWriteCommands,
  };
}

function persistAgentIntegration(input: {
  enabled: boolean;
  token: string | null;
  permissions: CommandPermissionSettings;
}): void {
  store.set('agentIntegration', {
    enabled: input.enabled,
    permissions: input.permissions,
    ...(input.token ? { tokenEncrypted: encryptSecret(input.token) } : {}),
  });
}

export function getAgentIntegrationState(): {
  enabled: boolean;
  token: string | null;
  permissions: CommandPermissionSettings;
} {
  const stored = store.get('agentIntegration', {});
  const token = typeof stored.tokenEncrypted === 'string' && stored.tokenEncrypted
    ? decryptSecret(stored.tokenEncrypted)
    : null;

  return {
    enabled: Boolean(stored.enabled),
    token,
    permissions: normalizePermissionSettings(stored.permissions),
  };
}

export function ensureAgentIntegrationToken(): string {
  const current = getAgentIntegrationState();
  if (current.token) {
    return current.token;
  }

  const token = generateAgentToken();
  persistAgentIntegration({ enabled: current.enabled, token, permissions: current.permissions });
  return token;
}

export function setAgentIntegrationEnabled(enabled: boolean): {
  enabled: boolean;
  token: string | null;
  permissions: CommandPermissionSettings;
} {
  const current = getAgentIntegrationState();
  const token = enabled ? current.token || ensureAgentIntegrationToken() : current.token;
  persistAgentIntegration({ enabled, token, permissions: current.permissions });

  return { enabled, token, permissions: current.permissions };
}

export function setAgentIntegrationPermissions(
  permissions: Partial<CommandPermissionSettings>,
): { enabled: boolean; token: string | null; permissions: CommandPermissionSettings } {
  const current = getAgentIntegrationState();
  const nextPermissions = normalizePermissionSettings({
    ...current.permissions,
    ...permissions,
  });
  persistAgentIntegration({
    enabled: current.enabled,
    token: current.token,
    permissions: nextPermissions,
  });

  return {
    enabled: current.enabled,
    token: current.token,
    permissions: nextPermissions,
  };
}

export function regenerateAgentIntegrationToken(): string {
  const current = getAgentIntegrationState();
  const token = generateAgentToken();
  persistAgentIntegration({ enabled: current.enabled, token, permissions: current.permissions });

  return token;
}
