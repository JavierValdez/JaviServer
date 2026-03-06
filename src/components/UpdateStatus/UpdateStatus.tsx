import type { AppUpdateState } from '../../types/updater';

interface UpdateStatusProps {
  state: AppUpdateState | null;
  onAction: () => void;
}

function getButtonLabel(state: AppUpdateState | null): string {
  if (!state) {
    return 'Cargando update';
  }

  switch (state.status) {
    case 'available':
      return `Descargar ${state.latestVersion ?? 'update'}`;
    case 'checking':
      return 'Buscando...';
    case 'downloading':
      return state.downloadProgress !== null
        ? `Descargando ${state.downloadProgress}%`
        : 'Descargando...';
    case 'downloaded':
      return 'Mostrar en Descargas';
    case 'disabled':
      return 'Solo app instalada';
    default:
      return 'Revisar updates';
  }
}

function getStatusCopy(state: AppUpdateState | null): string {
  if (!state) {
    return 'Sincronizando estado...';
  }

  switch (state.status) {
    case 'available':
      return `Update ${state.latestVersion ?? ''} disponible`;
    case 'up-to-date':
      return 'Sin updates pendientes';
    case 'checking':
      return 'Buscando nueva version';
    case 'downloading':
      return 'Descargando instalador';
    case 'downloaded':
      return 'Instalador listo en Descargas';
    case 'error':
      return state.message;
    case 'disabled':
      return 'Updates solo en la app instalada';
    default:
      return state.message;
  }
}

function getButtonClass(state: AppUpdateState | null): string {
  if (!state || state.status === 'checking' || state.status === 'downloading' || state.status === 'disabled') {
    return 'bg-gray-700 text-gray-400 cursor-not-allowed';
  }

  if (state.status === 'available') {
    return 'bg-ssh-success/90 text-white hover:bg-ssh-success';
  }

  if (state.status === 'downloaded') {
    return 'bg-ssh-warning/20 text-ssh-warning hover:bg-ssh-warning/30 border border-ssh-warning/30';
  }

  if (state.status === 'error') {
    return 'bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30';
  }

  return 'bg-ssh-light text-gray-100 hover:bg-gray-600';
}

export function UpdateStatus({ state, onAction }: UpdateStatusProps) {
  const isDisabled = !state || state.status === 'checking' || state.status === 'downloading' || state.status === 'disabled';

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Version</div>
        <div className="text-sm font-semibold text-white">v{state?.currentVersion ?? '--'}</div>
      </div>

      <div className="hidden lg:block text-right max-w-[280px]">
        <div className="text-xs text-gray-300 truncate">{getStatusCopy(state)}</div>
        {state?.latestVersion && state.latestVersion !== state.currentVersion && (
          <div className="text-[11px] text-gray-500">Nueva version: v{state.latestVersion}</div>
        )}
      </div>

      <button
        onClick={onAction}
        disabled={isDisabled}
        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${getButtonClass(state)}`}
      >
        {getButtonLabel(state)}
      </button>
    </div>
  );
}
