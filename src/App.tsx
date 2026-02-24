import { useAppStore } from './store/useAppStore';
import { ServerList } from './components/ServerList/ServerList';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { LogViewer } from './components/LogViewer/LogViewer';
import { Terminal } from './components/Terminal/Terminal';
import { Tab, TabType } from './types';

// Icons
const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const LogIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const isConnected = selectedProfileId ? connections.get(selectedProfileId)?.connected : false;

  const openTab = (type: TabType, title: string, data?: { path?: string; filePath?: string }) => {
    if (!selectedProfileId) return;

    // Check if tab already exists
    const existingTab = tabs.find(
      (t) => t.profileId === selectedProfileId && t.type === type && 
        (type === 'explorer' ? t.data?.path === data?.path : 
         type === 'logs' ? t.data?.filePath === data?.filePath : 
         type === 'terminal' ? true : false)
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

  return (
    <div className="flex h-screen bg-ssh-dark text-gray-200">
      {/* Sidebar - Server List */}
      <ServerList />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Action Bar */}
        {selectedProfile && isConnected && (
          <div className="p-2 border-b border-gray-700 flex items-center gap-2 bg-ssh-darker">
            <span className="text-sm text-gray-400 mr-2">
              Conectado a <span className="text-white font-medium">{selectedProfile.name}</span>
            </span>
            <button
              onClick={() => openTab('explorer', 'Explorador', { path: '/' })}
              className="flex items-center gap-2 px-3 py-1.5 bg-ssh-light hover:bg-gray-600 rounded text-sm transition-colors"
            >
              <FolderIcon />
              Explorador
            </button>
            <button
              onClick={() => openTab('terminal', 'Terminal', { path: currentPath })}
              className="flex items-center gap-2 px-3 py-1.5 bg-ssh-light hover:bg-gray-600 rounded text-sm transition-colors"
            >
              <TerminalIcon />
              Terminal
            </button>

            {/* Quick bookmarks */}
            {selectedProfile.bookmarks.filter((b) => b.isLogDirectory).length > 0 && (
              <>
                <div className="w-px h-6 bg-gray-600 mx-2" />
                <span className="text-xs text-gray-500">Logs rápidos:</span>
                {selectedProfile.bookmarks
                  .filter((b) => b.isLogDirectory)
                  .slice(0, 3)
                  .map((bookmark) => (
                    <button
                      key={bookmark.id}
                      onClick={() => openTab('explorer', bookmark.name, { path: bookmark.path })}
                      className="px-2 py-1 bg-ssh-warning/20 text-ssh-warning hover:bg-ssh-warning/30 rounded text-xs transition-colors"
                    >
                      {bookmark.name}
                    </button>
                  ))}
              </>
            )}
          </div>
        )}

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex border-b border-gray-700 bg-ssh-darker overflow-x-auto">
            {tabs.map((tab) => {
              const tabProfile = profiles.find(p => p.id === tab.profileId);
              return (
                <div
                  key={tab.id}
                  className={`
                    flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-gray-700
                    ${activeTabId === tab.id ? 'bg-ssh-dark text-white' : 'text-gray-400 hover:bg-ssh-light/50'}
                  `}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {getTabIcon(tab.type)}
                  <div className="flex flex-col">
                    <span className="text-sm truncate max-w-[150px]">{tab.title}</span>
                    {tabProfile && (
                      <span className="text-[10px] text-gray-500 truncate max-w-[150px]">{tabProfile.name}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                    className="ml-1 p-0.5 hover:bg-gray-600 rounded"
                  >
                    <CloseIcon />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0 flex flex-col bg-ssh-darker"
              style={{ 
                visibility: activeTabId === tab.id ? 'visible' : 'hidden',
                zIndex: activeTabId === tab.id ? 10 : 0
              }}
            >
              {(() => {
                const isActive = activeTabId === tab.id;
                switch (tab.type) {
                  case 'explorer':
                    return <FileExplorer profileId={tab.profileId} initialPath={tab.data?.path || '/'} onOpenLog={handleOpenLog} onOpenTerminal={handleOpenTerminal} />;
                  case 'logs':
                    return tab.data?.filePath ? (
                      <LogViewer profileId={tab.profileId} filePath={tab.data.filePath} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
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
          
          {tabs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {!selectedProfile ? (
                <>
                  <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                  <p className="text-lg">Selecciona un servidor</p>
                  <p className="text-sm text-gray-600 mt-1">o agrega uno nuevo desde el panel izquierdo</p>
                </>
              ) : !isConnected ? (
                <>
                  <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg">Doble clic para conectar</p>
                  <p className="text-sm text-gray-600 mt-1">al servidor "{selectedProfile.name}"</p>
                </>
              ) : (
                <>
                  <svg className="w-16 h-16 mb-4 text-ssh-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg text-ssh-success">Conectado</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Usa los botones de arriba para abrir el explorador o terminal
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
