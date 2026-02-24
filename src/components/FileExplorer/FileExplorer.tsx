import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileInfo, PathBookmark } from '../../types';

// Iconos
const FolderIcon = () => (
  <svg className="w-5 h-5 text-ssh-warning" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const LogIcon = () => (
  <svg className="w-5 h-5 text-ssh-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ViewLogIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg className={`w-4 h-4 ${filled ? 'text-ssh-warning fill-current' : 'text-gray-400'}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SortIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

type SortField = 'name' | 'date' | 'size';
type SortOrder = 'asc' | 'desc';

interface SearchResult {
  filename: string;
  filepath: string;
  matches: { line: number; content: string }[];
}

interface FileExplorerProps {
  profileId: string;
  initialPath?: string;
  onOpenLog?: (filePath: string, fileName: string) => void;
  onOpenTerminal?: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ profileId, initialPath = '/', onOpenLog, onOpenTerminal }) => {
  const { profiles, updateProfile } = useAppStore();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [pathInput, setPathInput] = useState(initialPath);
  
  // Modal de bookmark
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkIsLog, setBookmarkIsLog] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Búsqueda en carpeta
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const profile = profiles.find((p) => p.id === profileId);
  const bookmarks = profile?.bookmarks || [];

  // Ordenar archivos
  const sortedFiles = React.useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      // Directorios siempre primero
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.modifyTime).getTime() - new Date(b.modifyTime).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [files, sortField, sortOrder]);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);

    try {
      const fileList = await window.api.sftp.listDirectory(profileId, path);
      setFiles(fileList);
      setCurrentPath(path);
      setPathInput(path);
    } catch (err: any) {
      setError(err.message || 'Error al cargar directorio');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadDirectory(initialPath);
  }, [profileId, initialPath, loadDirectory]);

  const handleNavigate = (file: FileInfo) => {
    if (file.isDirectory) {
      loadDirectory(file.path);
    } else {
      setSelectedFile(file);
    }
  };

  const handleGoUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parentPath);
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      await window.api.sftp.download(profileId, file.path);
    } catch (err: any) {
      alert(`Error al descargar: ${err.message}`);
    }
  };

  const openBookmarkModal = () => {
    setBookmarkName(currentPath.split('/').pop() || 'Bookmark');
    setBookmarkIsLog(false);
    setShowBookmarkModal(true);
  };

  const handleAddBookmark = async () => {
    if (!profile || !bookmarkName.trim()) {
      return;
    }

    setSavingBookmark(true);
    try {
      console.log('Adding bookmark:', { name: bookmarkName, path: currentPath, isLogDirectory: bookmarkIsLog });
      const result = await window.api.bookmarks.add(profileId, {
        name: bookmarkName.trim(),
        path: currentPath,
        isLogDirectory: bookmarkIsLog,
      });
      console.log('Bookmark added result:', result);

      // Recargar perfil
      const updated = await window.api.profiles.get(profileId);
      console.log('Updated profile:', updated);
      if (updated) {
        updateProfile(profileId, { bookmarks: updated.bookmarks });
      }
      
      setShowBookmarkModal(false);
    } catch (err) {
      console.error('Error adding bookmark:', err);
      alert('Error al guardar la ruta: ' + (err as Error).message);
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleRemoveBookmark = async (bookmark: PathBookmark) => {
    await window.api.bookmarks.remove(profileId, bookmark.id);
    
    const updated = await window.api.profiles.get(profileId);
    if (updated) {
      updateProfile(profileId, { bookmarks: updated.bookmarks });
    }
  };

  // Buscar texto en archivos de la carpeta actual
  const handleSearchInDirectory = async () => {
    if (!searchText.trim()) return;
    
    setSearching(true);
    setSearchResults([]);
    
    try {
      const results = await window.api.sftp.searchInDirectory(
        profileId,
        currentPath,
        searchText,
        { recursive: false, filePattern: '*' }
      );
      setSearchResults(results);
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setSearching(false);
    }
  };

  // Toggle ordenamiento
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const isCurrentPathBookmarked = bookmarks.some((b) => b.path === currentPath);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isLogFile = (name: string): boolean => {
    // Detectar archivos que terminan en .log, .out, .err
    // O que contienen .log. (como serverGft.log.2025-07-16-AM)
    // O nombres típicos de Tomcat
    const logPatterns = [
      /\.(log|out|err)$/i,                    // Termina en .log, .out, .err
      /\.log\./i,                              // Contiene .log. (logs rotados)
      /catalina/i,                             // Logs de Tomcat
      /localhost/i,                            // Logs de Tomcat
      /server.*\.log/i,                        // serverXxx.log
      /access.*\.log/i,                        // access logs
      /error.*\.log/i,                         // error logs
      /\d{4}-\d{2}-\d{2}/,                    // Fecha en el nombre (logs rotados)
      /\.txt$/i,                               // Archivos .txt (a veces son logs)
    ];
    
    return logPatterns.some(pattern => pattern.test(name));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-ssh-dark">
      {/* Toolbar */}
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <button
          onClick={handleGoUp}
          disabled={currentPath === '/'}
          className="p-2 hover:bg-ssh-light rounded transition-colors disabled:opacity-50"
          title="Subir nivel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>

        <form onSubmit={handlePathSubmit} className="flex-1">
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            className="w-full bg-ssh-darker border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-ssh-accent focus:outline-none"
          />
        </form>

        <button
          onClick={() => loadDirectory(currentPath)}
          className="p-2 hover:bg-ssh-light rounded transition-colors"
          title="Actualizar"
        >
          <RefreshIcon />
        </button>

        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-2 rounded transition-colors ${showSearch ? 'bg-ssh-accent text-ssh-darker' : 'hover:bg-ssh-light'}`}
          title="Buscar en archivos"
        >
          <SearchIcon />
        </button>

        <button
          onClick={openBookmarkModal}
          disabled={isCurrentPathBookmarked}
          className={`p-2 hover:bg-ssh-light rounded transition-colors ${isCurrentPathBookmarked ? 'opacity-50' : ''}`}
          title={isCurrentPathBookmarked ? 'Ruta guardada' : 'Guardar ruta'}
        >
          <BookmarkIcon filled={isCurrentPathBookmarked} />
        </button>

        {onOpenTerminal && (
          <button
            onClick={() => onOpenTerminal(currentPath)}
            className="p-2 hover:bg-ssh-light rounded transition-colors text-ssh-accent"
            title="Abrir terminal en esta ruta"
          >
            <TerminalIcon />
          </button>
        )}

        {/* Ordenar */}
        <div className="flex items-center gap-1 ml-2 border-l border-gray-600 pl-2">
          <SortIcon />
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
              setSortField(field);
              setSortOrder(order);
            }}
            className="bg-ssh-darker border border-gray-600 rounded px-2 py-1 text-xs focus:border-ssh-accent focus:outline-none"
          >
            <option value="name-asc">Nombre ↑</option>
            <option value="name-desc">Nombre ↓</option>
            <option value="date-desc">Fecha ↓ (recientes)</option>
            <option value="date-asc">Fecha ↑ (antiguos)</option>
            <option value="size-desc">Tamaño ↓</option>
            <option value="size-asc">Tamaño ↑</option>
          </select>
        </div>
      </div>

      {/* Barra de búsqueda */}
      {showSearch && (
        <div className="p-3 border-b border-gray-700 bg-ssh-darker">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchInDirectory()}
              placeholder="Buscar texto en archivos de esta carpeta..."
              className="flex-1 bg-ssh-dark border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-ssh-accent focus:outline-none"
            />
            <button
              onClick={handleSearchInDirectory}
              disabled={searching || !searchText.trim()}
              className="px-4 py-1.5 bg-ssh-accent text-ssh-darker rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          
          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              <div className="text-sm text-gray-400 mb-2">
                {searchResults.length} archivo(s) encontrado(s) con "{searchText}"
              </div>
              {searchResults.map((result, i) => (
                <div
                  key={i}
                  className="bg-ssh-dark p-2 rounded cursor-pointer hover:bg-ssh-light/50 transition-colors"
                  onClick={() => {
                    if (onOpenLog) {
                      onOpenLog(result.filepath, result.filename);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ssh-accent truncate">
                      {result.filename}
                    </span>
                    <span className="text-xs bg-ssh-warning/20 text-ssh-warning px-2 py-0.5 rounded">
                      {result.matches.length} coincidencias
                    </span>
                  </div>
                  {result.matches.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1 truncate font-mono">
                      L{result.matches[0].line}: {result.matches[0].content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Bookmark */}
      {showBookmarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ssh-darker border border-gray-600 rounded-lg p-4 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Guardar Ruta</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Ruta</label>
              <div className="bg-ssh-dark px-3 py-2 rounded text-sm text-gray-300 truncate">
                {currentPath}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input
                type="text"
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                className="w-full bg-ssh-dark border border-gray-600 rounded px-3 py-2 text-sm focus:border-ssh-accent focus:outline-none"
                placeholder="Nombre del bookmark"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookmarkIsLog}
                  onChange={(e) => setBookmarkIsLog(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Esta ruta contiene archivos de log</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBookmarkModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddBookmark}
                disabled={!bookmarkName.trim() || savingBookmark}
                className="px-4 py-2 bg-ssh-accent text-ssh-darker rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
              >
                {savingBookmark ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700 flex flex-wrap gap-2">
          {bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group flex items-center gap-1 bg-ssh-light px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-600"
              onClick={() => loadDirectory(bookmark.path)}
            >
              {bookmark.isLogDirectory ? <LogIcon /> : <FolderIcon />}
              <span>{bookmark.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveBookmark(bookmark);
                }}
                className="ml-1 text-gray-500 hover:text-ssh-error opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-2">Cargando...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-ssh-error">
            <p>{error}</p>
            <button
              onClick={() => loadDirectory(currentPath)}
              className="mt-2 text-ssh-accent hover:underline text-sm"
            >
              Reintentar
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            Directorio vacío
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-ssh-darker sticky top-0">
              <tr className="text-left text-sm text-gray-400">
                <th 
                  className="px-3 py-2 font-medium cursor-pointer hover:text-gray-200"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Nombre
                    {sortField === 'name' && (
                      <span className="text-ssh-accent">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 font-medium w-24 cursor-pointer hover:text-gray-200"
                  onClick={() => toggleSort('size')}
                >
                  <div className="flex items-center gap-1">
                    Tamaño
                    {sortField === 'size' && (
                      <span className="text-ssh-accent">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 py-2 font-medium w-40 cursor-pointer hover:text-gray-200"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Modificado
                    {sortField === 'date' && (
                      <span className="text-ssh-accent">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-3 py-2 font-medium w-16">Permisos</th>
                <th className="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file.path}
                  className={`
                    border-b border-gray-700/50 hover:bg-ssh-light/50 cursor-pointer
                    ${selectedFile?.path === file.path ? 'bg-ssh-light' : ''}
                  `}
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => handleNavigate(file)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {file.isDirectory ? (
                        <FolderIcon />
                      ) : isLogFile(file.name) ? (
                        <LogIcon />
                      ) : (
                        <FileIcon />
                      )}
                      <span className="truncate">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-400">
                    {file.isDirectory ? '-' : formatSize(file.size)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-400">
                    {formatDate(file.modifyTime)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-500 font-mono">
                    {file.permissions}
                  </td>
                  <td className="px-3 py-2">
                    {!file.isDirectory && (
                      <div className="flex items-center gap-1">
                        {isLogFile(file.name) && onOpenLog && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenLog(file.path, file.name);
                            }}
                            className="p-1 hover:bg-ssh-success/20 rounded text-gray-400 hover:text-ssh-success"
                            title="Ver log en tiempo real"
                          >
                            <ViewLogIcon />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                          className="p-1 hover:bg-ssh-accent/20 rounded text-gray-400 hover:text-ssh-accent"
                          title="Descargar"
                        >
                          <DownloadIcon />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t border-gray-700 text-sm text-gray-500 flex justify-between">
        <span>{sortedFiles.length} elementos</span>
        {selectedFile && !selectedFile.isDirectory && (
          <span>
            {selectedFile.name} • {formatSize(selectedFile.size)}
          </span>
        )}
      </div>
    </div>
  );
};
