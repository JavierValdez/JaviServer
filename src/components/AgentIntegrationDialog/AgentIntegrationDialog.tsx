import { useEffect, useMemo, useState } from 'react';
import type {
  AgentActivityEntry,
  AgentClientConfig,
  AgentIntegrationState,
  AgentPermissionSettings,
} from '../../types';
import { Modal } from '../ui/Modal';

interface AgentIntegrationDialogProps {
  onClose: () => void;
}

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0018.36 5.64M18.36 5.64H13m5.36 0V11M5.64 18.36H11m-5.36 0V13" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function buildConfigText(config: AgentClientConfig | null): string {
  if (!config) {
    return '';
  }

  return JSON.stringify({
    mcpServers: {
      artishell: config,
    },
  }, null, 2);
}

const DEFAULT_AGENT_PERMISSIONS: AgentPermissionSettings = {
  autoApproveReadCommands: true,
  autoApproveWriteCommands: false,
};

export function AgentIntegrationDialog({ onClose }: AgentIntegrationDialogProps) {
  const [state, setState] = useState<AgentIntegrationState | null>(null);
  const [config, setConfig] = useState<AgentClientConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const configText = useMemo(() => buildConfigText(config), [config]);
  const permissions = state?.permissions || DEFAULT_AGENT_PERMISSIONS;

  useEffect(() => {
    let mounted = true;

    void window.api.agentIntegration.getState().then((nextState) => {
      if (mounted) {
        setState(nextState);
      }
    });

    const unsubscribeState = window.api.agentIntegration.onState((nextState) => setState(nextState));
    const unsubscribeActivity = window.api.agentIntegration.onActivity((activity) => {
      setState((current) => current ? { ...current, activity } : current);
    });

    return () => {
      mounted = false;
      unsubscribeState();
      unsubscribeActivity();
    };
  }, []);

  useEffect(() => {
    if (!state?.enabled) {
      setConfig(null);
      return;
    }

    void window.api.agentIntegration.getClientConfig().then(setConfig);
  }, [state?.enabled]);

  const toggleEnabled = async () => {
    if (!state) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const nextState = await window.api.agentIntegration.setEnabled(!state.enabled);
      setState(nextState);
      setNotice({
        message: nextState.enabled ? 'Integracion IA activada.' : 'Integracion IA desactivada.',
        type: 'success',
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'No se pudo actualizar la integracion IA.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const regenerateToken = async () => {
    const confirmed = globalThis.confirm(
      'Regenerar el token MCP?\n\nLas configuraciones existentes dejaran de funcionar y las sesiones activas se cerraran.',
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const nextState = await window.api.agentIntegration.regenerateToken();
      const nextConfig = await window.api.agentIntegration.getClientConfig();
      setState(nextState);
      setConfig(nextConfig);
      setNotice({ message: 'Token regenerado.', type: 'success' });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'No se pudo regenerar el token.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const copyConfig = async () => {
    if (!configText) {
      return;
    }

    setNotice(null);
    try {
      await navigator.clipboard.writeText(configText);
      setNotice({ message: 'Configuracion MCP copiada.', type: 'success' });
    } catch {
      try {
        await window.api.clipboard.writeText(configText);
        setNotice({ message: 'Configuracion MCP copiada.', type: 'success' });
      } catch {
        setNotice({ message: 'No se pudo copiar la configuracion.', type: 'error' });
      }
    }
  };

  const clearActivity = async () => {
    setNotice(null);
    try {
      const activity = await window.api.agentIntegration.clearActivity();
      setState((current) => current ? { ...current, activity } : current);
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'No se pudo limpiar la actividad.',
        type: 'error',
      });
    }
  };

  const updatePermissions = async (updates: Partial<AgentPermissionSettings>) => {
    if (!state) {
      return;
    }

    if (updates.autoApproveWriteCommands === true && !permissions.autoApproveWriteCommands) {
      const confirmed = globalThis.confirm(
        'Activar escritura sin confirmacion?\n\nLos clientes MCP podran ejecutar comandos que modifiquen el servidor sin pedir autorizacion en ArtiShell.',
      );
      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    setNotice(null);
    try {
      const nextState = await window.api.agentIntegration.setPermissions({
        ...permissions,
        ...updates,
      });
      setState(nextState);
      setNotice({ message: 'Permisos MCP actualizados.', type: 'success' });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'No se pudieron actualizar los permisos MCP.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const activity = state?.activity.slice().reverse() || [];

  return (
    <Modal
      title="Integracion IA"
      description="Broker MCP local para consultar y administrar servidores SSH guardados."
      onClose={onClose}
      widthClassName="max-w-5xl"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="space-y-4">
        {notice ? (
          <div className={notice.type === 'success' ? 'notice-success' : 'notice-danger'}>
            {notice.message}
          </div>
        ) : null}

        <div className="agent-header-panel">
          <div className="min-w-0">
            <div className="headline-sm">{state?.enabled ? 'Integracion activada' : 'Integracion desactivada'}</div>
            <div className="mt-1 body-xs">
              {state?.brokerRunning ? 'Broker local activo' : 'Broker local detenido'}
            </div>
          </div>

          <button
            type="button"
            className={`agent-toggle ${state?.enabled ? 'active' : ''}`}
            onClick={() => void toggleEnabled()}
            disabled={!state || busy}
            aria-label={state?.enabled ? 'Desactivar integracion IA' : 'Activar integracion IA'}
          >
            <span />
          </button>
        </div>

        <section className="panel-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="headline-sm">Permisos MCP</div>
              <div className="mt-1 body-xs">Controla cuando ArtiShell pide confirmacion antes de ejecutar comandos SSH.</div>
            </div>
            <span className={permissions.autoApproveWriteCommands ? 'badge-danger' : 'badge-neutral'}>
              {permissions.autoApproveWriteCommands ? 'Escritura activa' : 'Lectura controlada'}
            </span>
          </div>

          <div className="agent-permission-list">
            <div className="agent-permission-row">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">Lectura sin confirmacion</div>
                <div className="body-xs mt-1">Comandos clasificados como lectura se ejecutan sin dialogo.</div>
              </div>
              <button
                type="button"
                className={`agent-toggle ${permissions.autoApproveReadCommands ? 'active' : ''}`}
                onClick={() => void updatePermissions({
                  autoApproveReadCommands: !permissions.autoApproveReadCommands,
                })}
                disabled={!state || busy}
                aria-label={permissions.autoApproveReadCommands ? 'Desactivar lectura sin confirmacion' : 'Activar lectura sin confirmacion'}
              >
                <span />
              </button>
            </div>

            <div className="agent-permission-row">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">Escritura sin confirmacion</div>
                <div className="body-xs mt-1">Permite comandos mutables o no clasificados en el servidor sin pedir autorizacion.</div>
              </div>
              <button
                type="button"
                className={`agent-toggle ${permissions.autoApproveWriteCommands ? 'active' : ''}`}
                onClick={() => void updatePermissions({
                  autoApproveWriteCommands: !permissions.autoApproveWriteCommands,
                })}
                disabled={!state || busy}
                aria-label={permissions.autoApproveWriteCommands ? 'Desactivar escritura sin confirmacion' : 'Activar escritura sin confirmacion'}
              >
                <span />
              </button>
            </div>
          </div>
        </section>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)]">
          <section className="panel-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="headline-sm">Configuracion MCP</div>
              <button type="button" className="btn-secondary" onClick={() => void copyConfig()} disabled={!configText}>
                <CopyIcon />
                Copiar
              </button>
            </div>

            {configText ? (
              <pre className="agent-config app-scroll">{configText}</pre>
            ) : (
              <div className="notice-neutral mt-4">Activa la integracion para generar la configuracion del cliente MCP.</div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void regenerateToken()}
                disabled={!state?.enabled || busy}
              >
                <RefreshIcon />
                Regenerar token
              </button>
            </div>
          </section>

          <section className="panel-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="headline-sm">Clientes conectados</div>
                <div className="mt-1 body-xs">{state?.sessions.length || 0} sesion(es)</div>
              </div>
              <span className={state?.brokerRunning ? 'badge-success' : 'badge-neutral'}>
                {state?.brokerRunning ? 'Activo' : 'Detenido'}
              </span>
            </div>

            <div className="agent-list app-scroll">
              {state?.sessions.length ? state.sessions.map((session) => (
                <div key={session.id} className="agent-list-row">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">{session.clientName}</div>
                    <div className="body-xs truncate">{formatWhen(session.connectedAt)}</div>
                  </div>
                  {session.clientVersion ? <span className="body-xs shrink-0">{session.clientVersion}</span> : null}
                </div>
              )) : (
                <div className="notice-neutral">Sin clientes conectados.</div>
              )}
            </div>
          </section>
        </div>

        <section className="panel-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="headline-sm">Actividad reciente</div>
              <div className="mt-1 body-xs">{activity.length} evento(s)</div>
            </div>
            <button type="button" className="btn-ghost" onClick={() => void clearActivity()} disabled={activity.length === 0}>
              <TrashIcon />
              Limpiar
            </button>
          </div>

          <div className="agent-activity-list app-scroll">
            {activity.length ? activity.map((entry: AgentActivityEntry) => (
              <div key={entry.id} className="agent-activity-row">
                <span className={`agent-activity-dot ${entry.ok ? 'ok' : 'error'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-[var(--text-primary)]">{entry.clientName} - {entry.action}</div>
                  <div className="body-xs truncate">
                    {formatWhen(entry.at)}
                    {entry.target ? ` - ${entry.target}` : ''}
                    {typeof entry.durationMs === 'number' ? ` - ${entry.durationMs} ms` : ''}
                    {entry.error ? ` - ${entry.error}` : ''}
                  </div>
                </div>
              </div>
            )) : (
              <div className="notice-neutral">Sin actividad registrada.</div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
