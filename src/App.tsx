import { useEffect, useState } from 'react';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { LogViewer } from './components/LogViewer/LogViewer';
import { ServerList } from './components/ServerList/ServerList';
import { Terminal } from './components/Terminal/Terminal';
import { UpdateStatus } from './components/UpdateStatus/UpdateStatus';
import { useAppStore } from './store/useAppStore';
import { Tab, TabType } from './types';
import type { AppUpdateState } from './types/updater';

const FolderIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const LogIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function App() {
  const {
    profiles,
    selectedProfileId,
    connections,
    tabs,
    activeTabId,
    currentPath,
    addTab,
    removeTab,
    setActiveTab,
  } = useAppStore();
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const isConnected = selectedProfileId ? connections.get(selectedProfileId)?.connected : false;
  const quickLogBookmarks = selectedProfile?.bookmarks.filter((bookmark) => bookmark.isLogDirectory).slice(0, 3) ?? [];

  useEffect(() => {
    let isMounted = true;

    const syncInitialState = async () => {
      const state = await window.api.updater.getState();
      if (isMounted) {
        setUpdateState(state);
      }
    };

    void syncInitialState();

    const unsubscribe = window.api.updater.onStateChange((state) => {
      if (isMounted) {
        setUpdateState(state);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const openTab = (type: TabType, title: string, data?: { path?: string; filePath?: string }) => {
    if (!selectedProfileId) return;

    const existingTab = tabs.find(
      (tab) =>
        tab.profileId === selectedProfileId &&
        tab.type === type &&
        (type === 'explorer'
          ? tab.data?.path === data?.path
          : type === 'logs'
            ? tab.data?.filePath === data?.filePath
            : type === 'terminal'),
    );

    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    const newTab: Tab = {
      id: `${type}-${Date.now()}`,
      type,
      title,
      profileId: selectedProfileId,
      data,
    };

    addTab(newTab);
  };

  const handleOpenLog = (filePath: string, fileName: string) => {
    openTab('logs', fileName, { filePath });
  };

  const handleOpenTerminal = (path: string) => {
    openTab('terminal', 'Terminal', { path });
  };

  const handleUpdateAction = async () => {
    if (!updateState) {
      return;
    }

    if (updateState.status === 'available') {
      await window.api.updater.downloadInstaller();
      return;
    }

    if (updateState.status === 'downloaded') {
      await window.api.updater.revealInstaller();
      return;
    }

    if (updateState.status === 'checking' || updateState.status === 'downloading' || updateState.status === 'disabled') {
      return;
    }

    await window.api.updater.checkForUpdates();
  };

  const getTabIcon = (type: TabType) => {
    switch (type) {
      case 'explorer':
        return <FolderIcon />;
      case 'logs':
        return <LogIcon />;
      case 'terminal':
        return <TerminalIcon />;
    }
  };

  const connectionBadgeClass = isConnected ? 'badge-success' : selectedProfile ? 'badge-accent' : 'badge-neutral';
  const connectionBadgeLabel = isConnected ? 'Sesion activa' : selectedProfile ? 'Perfil listo' : 'Sin conexion';

  return (
    <div className="app-shell">
      <ServerList />

      <div className="workbench-shell">
        <div className="workbench-header">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0">
                <div className="section-label">SSH Workbench</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">JaviServer</div>
                  <span className={connectionBadgeClass}>{connectionBadgeLabel}</span>
                  {selectedProfile ? (
                    <span className="badge-neutral max-w-full truncate">{selectedProfile.username}@{selectedProfile.host}</span>
                  ) : null}
                </div>
              </div>

              {selectedProfile ? (
                <div className="min-w-0">
                  <div className="section-label">Perfil activo</div>
                  <div className="mt-1 body-sm truncate">{selectedProfile.name}</div>
                </div>
              ) : null}
            </div>

            <div className="mt-2 body-sm max-w-3xl">
              {selectedProfile
                ? isConnected
                  ? 'Accede a archivos, logs y terminal desde una superficie compacta y continua.'
                  : 'Conecta este perfil desde la barra lateral para abrir explorador, terminal y analisis de logs.'
                : 'Administra conexiones SSH, inspecciona archivos remotos y analiza logs desde una sola vista.'}
            </div>

            {selectedProfile && isConnected ? (
              <div className="toolbar-row mt-4">
                <button onClick={() => openTab('explorer', 'Explorador', { path: '/' })} className="btn-secondary">
                  <FolderIcon />
                  Explorar archivos
                </button>
                <button onClick={() => openTab('terminal', 'Terminal', { path: currentPath })} className="btn-secondary">
                  <TerminalIcon />
                  Abrir terminal
                </button>

                {quickLogBookmarks.length > 0 ? <div className="toolbar-divider" /> : null}
                {quickLogBookmarks.length > 0 ? <span className="section-label">Accesos log</span> : null}
                {quickLogBookmarks.map((bookmark) => (
                  <button
                    key={bookmark.id}
                    onClick={() => openTab('explorer', bookmark.name, { path: bookmark.path })}
                    className="btn-chip"
                  >
                    <LogIcon />
                    {bookmark.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <UpdateStatus state={updateState} onAction={handleUpdateAction} />
        </div>

        {tabs.length > 0 ? (
          <div className="tab-strip app-scroll">
            {tabs.map((tab) => {
              const tabProfile = profiles.find((profile) => profile.id === tab.profileId);
              return (
                <div key={tab.id} className="tab-item shrink-0" data-active={activeTabId === tab.id}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setActiveTab(tab.id)}>
                    <span className="text-[var(--accent)]">{getTabIcon(tab.type)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--text-primary)]">{tab.title}</div>
                      {tabProfile ? <div className="truncate text-[11px] text-[var(--text-muted)]">{tabProfile.name}</div> : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTab(tab.id)}
                    className="btn-icon-quiet shrink-0"
                    aria-label={`Cerrar ${tab.title}`}
                    title={`Cerrar ${tab.title}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="relative flex-1 min-h-0 p-4">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-4 flex flex-col overflow-hidden"
              style={{
                visibility: activeTabId === tab.id ? 'visible' : 'hidden',
                zIndex: activeTabId === tab.id ? 10 : 0,
              }}
            >
              {(() => {
                const isActive = activeTabId === tab.id;

                switch (tab.type) {
                  case 'explorer':
                    return (
                      <FileExplorer
                        profileId={tab.profileId}
                        initialPath={tab.data?.path || '/'}
                        onOpenLog={handleOpenLog}
                        onOpenTerminal={handleOpenTerminal}
                      />
                    );
                  case 'logs':
                    return tab.data?.filePath ? (
                      <LogViewer profileId={tab.profileId} filePath={tab.data.filePath} />
                    ) : (
                      <div className="panel-surface-strong flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
                        Selecciona un archivo de log
                      </div>
                    );
                  case 'terminal':
                    return (
                      <Terminal
                        profileId={tab.profileId}
                        initialPath={tab.data?.path}
                        currentPath={currentPath}
                        isActive={isActive}
                      />
                    );
                  default:
                    return null;
                }
              })()}
            </div>
          ))}

          {tabs.length === 0 ? (
            <div className="panel-surface-strong flex h-full items-center justify-center">
              {!selectedProfile ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">Selecciona un servidor</div>
                  <p className="body-sm max-w-md">
                    Empieza desde la barra lateral. Puedes crear un perfil nuevo o retomar un servidor existente.
                  </p>
                </div>
              ) : !isConnected ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">Conecta el perfil activo</div>
                  <p className="body-sm max-w-md">
                    Usa el boton de conectar en la barra lateral para empezar a trabajar con <span className="font-medium text-[var(--text-primary)]">{selectedProfile.name}</span>.
                  </p>
                </div>
              ) : (
                <div className="empty-state">
                  <div
                    className="empty-state-icon"
                    style={{
                      color: 'var(--success)',
                      background: 'var(--success-soft)',
                      borderColor: 'rgba(104, 216, 170, 0.2)',
                    }}
                  >
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--text-primary)]">Sesion lista</div>
                  <p className="body-sm max-w-md">
                    Abre el explorador, lanza una terminal o entra directo a una ruta de logs desde la barra superior.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default App;
