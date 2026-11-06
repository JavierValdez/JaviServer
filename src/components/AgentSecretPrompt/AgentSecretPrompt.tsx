import { type FormEvent, useEffect, useState } from 'react';
import type { AgentSecretPromptRequest } from '../../types';
import { Modal } from '../ui/Modal';

const LockIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

/**
 * Solicitudes de secretos de clientes MCP. Los valores se escriben aqui, viajan
 * al proceso principal y de ahi al servidor por stdin; el cliente MCP nunca los ve.
 */
export function AgentSecretPrompt() {
  const [queue, setQueue] = useState<AgentSecretPromptRequest[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const offPrompt = window.api.agentIntegration.onSecretPrompt((request) => {
      setQueue((current) => [...current, request]);
    });
    const offClosed = window.api.agentIntegration.onSecretPromptClosed((id) => {
      setQueue((current) => current.filter((request) => request.id !== id));
    });
    return () => {
      offPrompt();
      offClosed();
    };
  }, []);

  const current = queue[0];

  useEffect(() => {
    setValues({});
    setRemember(false);
    setBusy(false);
  }, [current?.id]);

  if (!current) {
    return null;
  }

  const cached = new Set(current.cachedFields);
  const missing = current.fields.filter((field) => !cached.has(field.name) && !values[field.name]);

  const finish = async (response: { values: Record<string, string>; remember: boolean } | null) => {
    setBusy(true);
    try {
      await window.api.agentIntegration.respondSecretPrompt(current.id, response);
    } finally {
      setValues({});
      setQueue((items) => items.filter((item) => item.id !== current.id));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (missing.length > 0 || busy) {
      return;
    }
    void finish({ values, remember });
  };

  return (
    <Modal
      title="Un cliente IA necesita credenciales"
      description="Escribe los valores aqui. Se envian al servidor por SSH sin mostrarse al cliente IA y se ocultan en la salida."
      onClose={() => void finish(null)}
      widthClassName="max-w-2xl"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={() => void finish(null)} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="agent-secret-form" className="btn-primary" disabled={busy || missing.length > 0}>
            <LockIcon />
            Ejecutar con estas credenciales
          </button>
        </>
      }
    >
      <form id="agent-secret-form" className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
        <div className="panel-surface space-y-2 px-4 py-3 text-sm">
          <div>
            <span className="text-[var(--text-secondary)]">Cliente: </span>
            <span className="font-medium text-[var(--text-primary)]">{current.clientName}</span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">Servidor: </span>
            <span className="font-medium text-[var(--text-primary)]">{current.server}</span>
          </div>
          {current.cwd ? (
            <div>
              <span className="text-[var(--text-secondary)]">Directorio: </span>
              <span className="font-mono text-[var(--text-primary)]">{current.cwd}</span>
            </div>
          ) : null}
          {current.reason ? (
            <div>
              <span className="text-[var(--text-secondary)]">Motivo: </span>
              <span className="text-[var(--text-primary)]">{current.reason}</span>
            </div>
          ) : null}
          <div>
            <div className="text-[var(--text-secondary)]">Comando que se ejecutara:</div>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[var(--surface-sunken,rgba(0,0,0,0.2))] p-2 font-mono text-xs text-[var(--text-primary)]">
              {current.command}
            </pre>
          </div>
        </div>

        <div className="grid gap-4">
          {current.fields.map((field, index) => (
            <div key={field.name}>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]" htmlFor={`secret-${field.name}`}>
                {field.label}
                <span className="ml-2 font-mono text-xs text-[var(--text-secondary)]">${field.name}</span>
              </label>
              <input
                id={`secret-${field.name}`}
                type={field.sensitive ? 'password' : 'text'}
                value={values[field.name] || ''}
                onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))}
                placeholder={cached.has(field.name) ? 'Recordado en esta sesion: deja vacio para reutilizarlo' : ''}
                className="input"
                autoFocus={index === 0}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <label className="muted-surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">Recordar mientras ArtiShell este abierto</div>
            <div className="mt-1 body-xs">Solo en memoria y para este servidor. Igual se pedira confirmar cada comando.</div>
          </div>
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>
      </form>
    </Modal>
  );
}
