import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ServerProfile } from '../../types';
import { ServerForm } from '../ServerForm/ServerForm';

// Iconos simples en SVG
const ServerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ConnectedIcon = () => (
  <div className="w-2 h-2 rounded-full bg-ssh-success" />
);

const DisconnectedIcon = () => (
  <div className="w-2 h-2 rounded-full bg-gray-500" />
);

const LoadingIcon = () => (
  <div className="w-2 h-2 rounded-full bg-ssh-warning animate-pulse" />
);

export const ServerList: React.FC = () => {
  const { profiles, setProfiles, selectedProfileId, setSelectedProfileId, connections, setConnectionStatus } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ServerProfile | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: ServerProfile } | null>(null);

  const loadProfiles = async () => {
    const loaded = await window.api.profiles.getAll();
    setProfiles(loaded);
  };

  React.useEffect(() => {
    loadProfiles();

    // Escuchar desconexiones
    window.api.ssh.onConnectionClosed((profileId) => {
      setConnectionStatus(profileId, { connected: false, connecting: false });
    });
  }, []);

  const handleConnect = async (profile: ServerProfile) => {
    const status = connections.get(profile.id);
    
    if (status?.connected) {
      // Desconectar
      try {
        await window.api.ssh.disconnect(profile.id);
        setConnectionStatus(profile.id, { connected: false, connecting: false });
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    } else {
      // Conectar
      setConnectionStatus(profile.id, { connected: false, connecting: true });
      try {
        await window.api.ssh.connect(profile.id);
        setConnectionStatus(profile.id, { connected: true, connecting: false });
        setSelectedProfileId(profile.id);
      } catch (err: any) {
        setConnectionStatus(profile.id, { 
          connected: false, 
          connecting: false, 
          error: err.error || err.message 
        });
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, profile: ServerProfile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, profile });
  };

  const handleDelete = async (profile: ServerProfile) => {
    if (confirm(`¿Eliminar servidor "${profile.name}"?`)) {
      await window.api.profiles.delete(profile.id);
      loadProfiles();
    }
    setContextMenu(null);
  };

  const handleEdit = (profile: ServerProfile) => {
    setEditingProfile(profile);
    setShowForm(true);
    setContextMenu(null);
  };

  const getConnectionStatus = (profileId: string) => {
    const status = connections.get(profileId);
    if (status?.connecting) return 'connecting';
    if (status?.connected) return 'connected';
    return 'disconnected';
  };

  return (
    <div className="w-64 bg-ssh-darker border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-200">Servidores</h2>
        <button
          onClick={() => {
            setEditingProfile(undefined);
            setShowForm(true);
          }}
          className="p-1.5 hover:bg-ssh-light rounded transition-colors text-gray-400 hover:text-white"
          title="Agregar servidor"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto p-2">
        {profiles.length === 0 ? (
          <div className="text-center text-gray-500 py-8 px-4">
            <ServerIcon />
            <p className="mt-2 text-sm">No hay servidores configurados</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-ssh-accent hover:underline text-sm"
            >
              Agregar servidor
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {profiles.map((profile) => {
              const status = getConnectionStatus(profile.id);
              const isSelected = selectedProfileId === profile.id;
              const connectionInfo = connections.get(profile.id);

              return (
                <div
                  key={profile.id}
                  className={`
                    p-3 rounded cursor-pointer transition-colors
                    ${isSelected ? 'bg-ssh-light' : 'hover:bg-ssh-light/50'}
                  `}
                  onClick={() => setSelectedProfileId(profile.id)}
                  onDoubleClick={() => handleConnect(profile)}
                  onContextMenu={(e) => handleContextMenu(e, profile)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-gray-400">
                      <ServerIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{profile.name}</span>
                        {status === 'connecting' && <LoadingIcon />}
                        {status === 'connected' && <ConnectedIcon />}
                        {status === 'disconnected' && <DisconnectedIcon />}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {profile.username}@{profile.host}
                      </div>
                    </div>
                  </div>
                  
                  {/* Error message */}
                  {connectionInfo?.error && (
                    <div className="mt-2 text-xs text-ssh-error bg-red-500/10 rounded px-2 py-1">
                      {connectionInfo.error}
                    </div>
                  )}

                  {/* Bookmarks count */}
                  {profile.bookmarks.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {profile.bookmarks.length} ruta(s) guardada(s)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-ssh-dark border border-gray-600 rounded shadow-lg py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-ssh-light"
              onClick={() => handleConnect(contextMenu.profile)}
            >
              {connections.get(contextMenu.profile.id)?.connected ? 'Desconectar' : 'Conectar'}
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-ssh-light"
              onClick={() => handleEdit(contextMenu.profile)}
            >
              Editar
            </button>
            <hr className="my-1 border-gray-700" />
            <button
              className="w-full px-4 py-2 text-left text-sm text-ssh-error hover:bg-ssh-light"
              onClick={() => handleDelete(contextMenu.profile)}
            >
              Eliminar
            </button>
          </div>
        </>
      )}

      {/* Server Form Modal */}
      {showForm && (
        <ServerForm
          profile={editingProfile}
          onClose={() => {
            setShowForm(false);
            setEditingProfile(undefined);
          }}
          onSave={loadProfiles}
        />
      )}
    </div>
  );
};
