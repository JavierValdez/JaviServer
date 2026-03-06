import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ServerProfile } from '../../types';
import { ServerForm } from '../ServerForm/ServerForm';
import { Modal } from '../ui/Modal';

const ServerIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const MoreIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlugIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-3 3m0 0l-4.5-4.5M16 10l2.5 2.5a2.121 2.121 0 010 3l-3 3a2.121 2.121 0 01-3 0L10 16m6-6L9 17m0 0l-3-3m3 3L6.5 19.5a2.121 2.121 0 01-3 0l-1-1a2.121 2.121 0 010-3L5 13" />
  </svg>
);

function getStatusMeta(status: 'connected' | 'connecting' | 'disconnected') {
  if (status === 'connected') {
    return {
      label: 'Conectado',
      dot: 'var(--success)',
      badgeClass: 'badge-success',
      actionClass: 'btn-secondary',
      actionLabel: 'Desconectar',
    };
  }

  if (status === 'connecting') {
    return {
      label: 'Conectando',
      dot: 'var(--warning)',
      badgeClass: 'badge-warning',
      actionClass: 'btn-secondary',
      actionLabel: 'Conectando...',
    };
  }

  return {
    label: 'Inactivo',
    dot: 'var(--text-muted)',
    badgeClass: 'badge-neutral',
    actionClass: 'btn-primary',
    actionLabel: 'Conectar',
  };
}

export const ServerList: React.FC = () => {
  const { profiles, setProfiles, selectedProfileId, setSelectedProfileId, connections, setConnectionStatus } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ServerProfile | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ServerProfile } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ServerProfile | null>(null);

  const loadProfiles = async () => {
    const loaded = await window.api.profiles.getAll();
    setProfiles(loaded);
  };

  useEffect(() => {
    void loadProfiles();

    const unsubscribe = window.api.ssh.onConnectionClosed((profileId) => {
      setConnectionStatus(profileId, { connected: false, connecting: false });
    });

    return unsubscribe;
  }, [setConnectionStatus]);

  const handleConnect = async (profile: ServerProfile) => {
    const status = connections.get(profile.id);

    if (status?.connected) {
      try {
        await window.api.ssh.disconnect(profile.id);
        setConnectionStatus(profile.id, { connected: false, connecting: false });
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
      return;
    }

    setConnectionStatus(profile.id, { connected: false, connecting: true });
    try {
      await window.api.ssh.connect(profile.id);
      setConnectionStatus(profile.id, { connected: true, connecting: false });
      setSelectedProfileId(profile.id);
    } catch (err: any) {
      setConnectionStatus(profile.id, {
        connected: false,
        connecting: false,
        error: err.error || err.message,
      });
    }
  };

  const openMenu = (profile: ServerProfile, x: number, y: number) => {
    setContextMenu({ x, y, profile });
  };

  const handleOpenMenuFromButton = (event: React.MouseEvent<HTMLButtonElement>, profile: ServerProfile) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openMenu(profile, rect.right - 168, rect.bottom + 8);
  };

  const handleContextMenu = (event: React.MouseEvent, profile: ServerProfile) => {
    event.preventDefault();
    openMenu(profile, event.clientX, event.clientY);
  };

  const handleEdit = (profile: ServerProfile) => {
    setEditingProfile(profile);
    setShowForm(true);
    setContextMenu(null);
  };

  const handleDelete = async () => {
    if (!deleteCandidate) {
      return;
    }

    await window.api.profiles.delete(deleteCandidate.id);
    setDeleteCandidate(null);
    setContextMenu(null);
    await loadProfiles();
  };

  const getConnectionStatus = (profileId: string) => {
    const status = connections.get(profileId);
    if (status?.connecting) return 'connecting';
    if (status?.connected) return 'connected';
    return 'disconnected';
  };

  return (
    <aside className="sidebar-shell">
      <div className="border-b border-[var(--border-subtle)] px-5 py-5">
        <div className="section-label">Infraestructura</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Servidores</h2>
            <p className="mt-1 body-xs">Perfiles SSH y accesos guardados</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingProfile(undefined);
              setShowForm(true);
            }}
            className="btn-icon"
            title="Agregar servidor"
            aria-label="Agregar servidor"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto px-3 py-4">
        {profiles.length === 0 ? (
          <div className="panel-surface px-4 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(121,187,255,0.2)] bg-[rgba(121,187,255,0.08)] text-[var(--accent)]">
              <ServerIcon />
            </div>
            <div className="mt-4 text-base font-semibold text-[var(--text-primary)]">No hay servidores configurados</div>
            <p className="mt-2 body-sm">Crea tu primer perfil para empezar a explorar archivos y logs.</p>
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-5">
              <PlusIcon />
              Crear servidor
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => {
              const status = getConnectionStatus(profile.id);
              const connectionInfo = connections.get(profile.id);
              const isSelected = selectedProfileId === profile.id;
              const statusMeta = getStatusMeta(status);

              return (
                <div
                  key={profile.id}
                  className={`panel-surface cursor-pointer px-4 py-4 transition-all duration-150 ${
                    isSelected ? 'border-[rgba(121,187,255,0.28)] bg-[rgba(31,47,73,0.96)]' : 'hover:border-[var(--border-strong)]'
                  }`}
                  onClick={() => setSelectedProfileId(profile.id)}
                  onDoubleClick={() => handleConnect(profile)}
                  onContextMenu={(event) => handleContextMenu(event, profile)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] p-2 text-[var(--accent)]">
                          <ServerIcon />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{profile.name}</div>
                          <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                            {profile.username}@{profile.host}:{profile.port}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={statusMeta.badgeClass}>
                          <span className="status-dot mr-2" style={{ background: statusMeta.dot }} />
                          {statusMeta.label}
                        </span>
                        {profile.bookmarks.length > 0 ? <span className="badge-neutral">{profile.bookmarks.length} ruta(s)</span> : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-icon shrink-0"
                      onClick={(event) => handleOpenMenuFromButton(event, profile)}
                      title={`Acciones para ${profile.name}`}
                      aria-label={`Acciones para ${profile.name}`}
                    >
                      <MoreIcon />
                    </button>
                  </div>

                  {connectionInfo?.error ? <div className="notice-danger mt-3">{connectionInfo.error}</div> : null}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleConnect(profile);
                      }}
                      disabled={status === 'connecting'}
                      className={statusMeta.actionClass}
                    >
                      <PlugIcon />
                      {statusMeta.actionLabel}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(profile);
                      }}
                    >
                      <EditIcon />
                      Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] px-5 py-4">
        <div className="section-label">Resumen</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="badge-neutral">{profiles.length} perfil(es)</span>
          <span className="badge-neutral">{Array.from(connections.values()).filter((status) => status.connected).length} activo(s)</span>
        </div>
      </div>

      {contextMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setContextMenu(null)}
            aria-label="Cerrar menu contextual"
          />
          <div
            className="panel-surface-strong fixed z-50 min-w-[168px] p-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="btn-ghost w-full justify-start"
              onClick={() => void handleConnect(contextMenu.profile)}
            >
              <PlugIcon />
              {connections.get(contextMenu.profile.id)?.connected ? 'Desconectar' : 'Conectar'}
            </button>
            <button type="button" className="btn-ghost w-full justify-start" onClick={() => handleEdit(contextMenu.profile)}>
              <EditIcon />
              Editar
            </button>
            <button
              type="button"
              className="btn-ghost w-full justify-start text-[var(--danger)] hover:bg-[rgba(255,149,167,0.12)]"
              onClick={() => {
                setDeleteCandidate(contextMenu.profile);
                setContextMenu(null);
              }}
            >
              <DeleteIcon />
              Eliminar
            </button>
          </div>
        </>
      ) : null}

      {showForm ? (
        <ServerForm
          profile={editingProfile}
          onClose={() => {
            setShowForm(false);
            setEditingProfile(undefined);
          }}
          onSave={loadProfiles}
        />
      ) : null}

      {deleteCandidate ? (
        <Modal
          title="Eliminar servidor"
          description={`Se eliminara el perfil "${deleteCandidate.name}" y sus rutas guardadas.`}
          onClose={() => setDeleteCandidate(null)}
          widthClassName="max-w-md"
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={() => setDeleteCandidate(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
                <DeleteIcon />
                Eliminar perfil
              </button>
            </>
          }
        >
          <div className="notice-neutral">
            Esta accion no se puede deshacer. Si el perfil esta conectado, se volvera a cargar la lista de perfiles.
          </div>
        </Modal>
      ) : null}
    </aside>
  );
};
