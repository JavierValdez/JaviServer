import type { AppUpdateState } from '../../types/updater';

interface UpdateStatusProps {
  state: AppUpdateState | null;
  onAction: () => void;
}

function getButtonLabel(state: AppUpdateState | null): string {
  if (!state) {
    return 'Cargando';
  }

  switch (state.status) {
    case 'available':
      return `Descargar ${state.latestVersion ?? 'update'}`;
    case 'checking':
      return 'Buscando...';
    case 'downloading':
      return state.downloadProgress !== null ? `Descargando ${state.downloadProgress}%` : 'Descargando...';
    case 'downloaded':
      return 'Ver instalador';
    case 'disabled':
      return 'Solo app instalada';
    default:
      return 'Buscar updates';
  }
}

function getStatusCopy(state: AppUpdateState | null): string {
  if (!state) {
    return 'Sincronizando estado del updater';
  }

  switch (state.status) {
    case 'available':
      return `Version ${state.latestVersion ?? ''} disponible`;
    case 'up-to-date':
      return 'Aplicacion al dia';
    case 'checking':
      return 'Buscando nueva version';
    case 'downloading':
      return 'Descargando instalador';
    case 'downloaded':
      return 'Instalador listo en Descargas';
    case 'error':
      return state.message;
    case 'disabled':
      return 'Disponible solo en app instalada';
    default:
      return state.message;
  }
}

function getBadgeClass(state: AppUpdateState | null): string {
  if (!state) {
    return 'badge-neutral';
  }

  if (state.status === 'available') {
    return 'badge-success';
  }

  if (state.status === 'error') {
    return 'badge-danger';
  }

  if (state.status === 'checking' || state.status === 'downloading') {
    return 'badge-warning';
  }

  return 'badge-neutral';
}

function getButtonClass(state: AppUpdateState | null): string {
  if (!state || state.status === 'checking' || state.status === 'downloading' || state.status === 'disabled') {
    return 'btn-secondary opacity-70';
  }

  if (state.status === 'available') {
    return 'btn-primary';
  }

  if (state.status === 'downloaded') {
    return 'btn-secondary';
  }

  if (state.status === 'error') {
    return 'btn-danger';
  }

  return 'btn-secondary';
}

export function UpdateStatus({ state, onAction }: UpdateStatusProps) {
  const isDisabled = !state || state.status === 'checking' || state.status === 'downloading' || state.status === 'disabled';

  return (
    <div className="muted-surface shrink-0 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="section-label">Release</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--text-primary)]">v{state?.currentVersion ?? '--'}</div>
            <span className={getBadgeClass(state)}>{getStatusCopy(state)}</span>
          </div>
        </div>

        <button type="button" onClick={onAction} disabled={isDisabled} className={`${getButtonClass(state)} ml-auto shrink-0`}>
          {getButtonLabel(state)}
        </button>
      </div>

      {state?.latestVersion && state.latestVersion !== state.currentVersion ? (
        <div className="mt-1 body-xs">Nueva version: v{state.latestVersion}</div>
      ) : null}
    </div>
  );
}
