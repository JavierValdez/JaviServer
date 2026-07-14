import { useEffect, useState } from 'react';
import type { LegacyMigrationStatus } from '../../types/migration';
import { Modal } from '../ui/Modal';

const TransferIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="m5 12 4 4L19 6" />
  </svg>
);

export function LegacyMigrationDialog() {
  const [status, setStatus] = useState<LegacyMigrationStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.api.legacyMigration.getStatus()
      .then((nextStatus) => {
        if (mounted) setStatus(nextStatus);
      })
      .catch((error) => {
        if (mounted) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (dismissed || loadError || !status || status.state === 'unavailable') {
    return null;
  }

  if (status.state === 'completed' && status.acknowledged) {
    return null;
  }

  const isCompleted = status.state === 'completed';
  const isFailed = status.state === 'failed';
  const isPending = status.state === 'pending';

  const handleClose = async () => {
    if (isCompleted) {
      await window.api.legacyMigration.acknowledge();
    }
    setDismissed(true);
  };

  const handleMigrate = async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const nextStatus = await window.api.legacyMigration.start();
      setStatus(nextStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus((current) => current ? { ...current, state: 'failed', error: message } : current);
      setBusy(false);
    }
  };

  const title = isCompleted
    ? 'Migracion completada'
    : isFailed
      ? 'No se pudo completar la migracion'
      : 'Trae tus datos de JaviServer';

  const description = isCompleted
    ? 'ArtiShell ya esta usando tus perfiles y preferencias anteriores.'
    : isFailed
      ? 'Tus datos originales siguen intactos. Puedes volver a intentarlo.'
      : 'Encontramos una instalacion anterior. Puedes copiarla de forma segura a ArtiShell.';

  return (
    <Modal
      title={title}
      description={description}
      onClose={() => void handleClose()}
      widthClassName="max-w-2xl"
      footer={
        isCompleted ? (
          <button type="button" className="btn-primary" onClick={() => void handleClose()}>
            Continuar en ArtiShell
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setDismissed(true)} disabled={busy || isPending}>
              Ahora no
            </button>
            <button type="button" className="btn-primary" onClick={() => void handleMigrate()} disabled={busy || isPending}>
              <TransferIcon />
              {busy || isPending ? 'Reiniciando para migrar...' : isFailed ? 'Intentar de nuevo' : 'Migrar y reiniciar'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className={`rounded-2xl border p-4 ${isFailed ? 'border-[var(--danger)] bg-[var(--danger-soft)]' : 'border-[var(--accent-border)] bg-[var(--accent-surface)]'}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--surface-panel)] p-2 text-[var(--accent)]">
              <TransferIcon />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {status.sourceAppName} → {status.targetAppName}
              </div>
              <p className="mt-1 body-sm">
                {isCompleted
                  ? `Migrado el ${new Date(status.migratedAt || '').toLocaleString()}.`
                  : 'La aplicacion se reiniciara una vez para copiar los datos antes de abrir conexiones.'}
              </p>
            </div>
          </div>
        </div>

        {status.items.length > 0 ? (
          <div>
            <div className="section-label">Datos incluidos</div>
            <div className="mt-3 space-y-2">
              {status.items.map((item) => (
                <div key={item.id} className="panel-surface flex items-center gap-3 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                    <CheckIcon />
                  </span>
                  <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {status.backupCreated ? (
          <div className="notice-neutral">
            ArtiShell creo un respaldo de cualquier dato nuevo antes de importar la instalacion anterior.
          </div>
        ) : null}

        {status.error ? <div className="notice-danger">{status.error}</div> : null}

        {!isCompleted && !isFailed ? (
          <div className="notice-neutral">
            Cierra JaviServer antes de continuar. Los datos originales no se eliminaran y podras conservar la aplicacion anterior.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
