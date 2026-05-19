import { safeStorage } from 'electron';
import Store from 'electron-store';
import { generateAgentToken } from './token';

interface StoredAgentIntegration {
  enabled?: boolean;
  tokenEncrypted?: string;
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

export function getAgentIntegrationState(): { enabled: boolean; token: string | null } {
  const stored = store.get('agentIntegration', {});
  const token = typeof stored.tokenEncrypted === 'string' && stored.tokenEncrypted
    ? decryptSecret(stored.tokenEncrypted)
    : null;

  return {
    enabled: Boolean(stored.enabled),
    token,
  };
}

export function ensureAgentIntegrationToken(): string {
  const current = getAgentIntegrationState();
  if (current.token) {
    return current.token;
  }

  const token = generateAgentToken();
  store.set('agentIntegration', {
    enabled: current.enabled,
    tokenEncrypted: encryptSecret(token),
  });
  return token;
}

export function setAgentIntegrationEnabled(enabled: boolean): { enabled: boolean; token: string | null } {
  const current = getAgentIntegrationState();
  const token = enabled ? current.token || ensureAgentIntegrationToken() : current.token;
  store.set('agentIntegration', {
    enabled,
    ...(token ? { tokenEncrypted: encryptSecret(token) } : {}),
  });

  return { enabled, token };
}

export function regenerateAgentIntegrationToken(): string {
  const current = getAgentIntegrationState();
  const token = generateAgentToken();
  store.set('agentIntegration', {
    enabled: current.enabled,
    tokenEncrypted: encryptSecret(token),
  });

  return token;
}
