import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileInfo, PathBookmark } from '../../types';
import { Modal } from '../ui/Modal';

const FolderIcon = () => (
  <svg className="h-4 w-4 text-[var(--warning)]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const LogIcon = () => (
  <svg className="h-4 w-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ViewLogIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg className={`h-4 w-4 ${filled ? 'fill-current text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SortIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
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
  onPathChange?: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  profileId,
  initialPath = '/',
  onOpenLog,
  onOpenTerminal,
  onPathChange,
}) => {
  const { profiles, updateProfile } = useAppStore();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [pathInput, setPathInput] = useState(initialPath);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkIsLog, setBookmarkIsLog] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const profile = profiles.find((entry) => entry.id === profileId);
  const bookmarks = profile?.bookmarks || [];

  const sortedFiles = useMemo(() => {
    const sorted = [...files].sort((left, right) => {
      if (left.isDirectory && !right.isDirectory) return -1;
      if (!left.isDirectory && right.isDirectory) return 1;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = left.name.localeCompare(right.name);
          break;
        case 'date':
          comparison = new Date(left.modifyTime).getTime() - new Date(right.modifyTime).getTime();
          break;
        case 'size':
          comparison = left.size - right.size;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [files, sortField, sortOrder]);

  const loadDirectory = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      setSelectedFile(null);

      try {
        const fileList = await window.api.sftp.listDirectory(profileId, path);
        setFiles(fileList);
        setCurrentPath(path);
        setPathInput(path);
        onPathChange?.(path);
      } catch (err: any) {
        setError(err.message || 'No se pudo cargar el directorio.');
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [onPathChange, profileId],
  );

  useEffect(() => {
    void loadDirectory(initialPath);
  }, [initialPath, loadDirectory]);

  const handleNavigate = (file: FileInfo) => {
    if (file.isDirectory) {
      void loadDirectory(file.path);
      return;
    }

    setSelectedFile(file);
  };

  const handleGoUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    void loadDirectory(parentPath);
  };

  const handlePathSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pathInput.trim()) {
      void loadDirectory(pathInput.trim());
    }
  };

  const handleDownload = async (file: FileInfo) => {
    setActionError(null);
    try {
      await window.api.sftp.download(profileId, file.path);
    } catch (err: any) {
      setActionError(`No se pudo descargar "${file.name}": ${err.message}`);
    }
  };

  const openBookmarkModal = () => {
    setBookmarkName(currentPath.split('/').pop() || 'Ruta');
    setBookmarkIsLog(false);
    setShowBookmarkModal(true);
  };

  const handleAddBookmark = async () => {
    if (!profile || !bookmarkName.trim()) {
      return;
    }

    setSavingBookmark(true);
    setActionError(null);

    try {
      await window.api.bookmarks.add(profileId, {
        name: bookmarkName.trim(),
        path: currentPath,
        isLogDirectory: bookmarkIsLog,
      });

      const updated = await window.api.profiles.get(profileId);
      if (updated) {
        updateProfile(profileId, { bookmarks: updated.bookmarks });
      }

      setShowBookmarkModal(false);
    } catch (err) {
      setActionError(`No se pudo guardar la ruta: ${(err as Error).message}`);
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleRemoveBookmark = async (bookmark: PathBookmark) => {
    setActionError(null);
    try {
      await window.api.bookmarks.remove(profileId, bookmark.id);
      const updated = await window.api.profiles.get(profileId);
      if (updated) {
        updateProfile(profileId, { bookmarks: updated.bookmarks });
      }
    } catch (err) {
      setActionError(`No se pudo quitar la ruta: ${(err as Error).message}`);
    }
  };

  const handleSearchInDirectory = async () => {
    if (!searchText.trim()) return;

    setSearching(true);
    setSearchResults([]);
    setActionError(null);

    try {
      const results = await window.api.sftp.searchInDirectory(profileId, currentPath, searchText, {
        recursive: false,
        filePattern: '*',
      });
      setSearchResults(results);
    } catch (err) {
      setActionError(`No se pudo buscar en la carpeta actual: ${(err as Error).message}`);
    } finally {
      setSearching(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortOrder('asc');
  };

  const isCurrentPathBookmarked = bookmarks.some((bookmark) => bookmark.path === currentPath);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(1))} ${units[index]}`;
  };

  const formatDate = (date: Date): string =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const isLogFile = (name: string): boolean => {
    const logPatterns = [
      /\.(log|out|err)$/i,
      /\.log\./i,
      /catalina/i,
      /localhost/i,
      /server.*\.log/i,
      /access.*\.log/i,
      /error.*\.log/i,
      /\d{4}-\d{2}-\d{2}/,
      /\.txt$/i,
    ];

    return logPatterns.some((pattern) => pattern.test(name));
  };

  return (
    <div className="panel-surface-strong flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="section-label">Explorador remoto</div>
            <div className="max-w-[26rem] truncate text-sm font-semibold text-[var(--text-primary)]">{currentPath}</div>
            <span className="badge-neutral">{sortedFiles.length} elemento(s)</span>
            {selectedFile ? <span className="badge-accent max-w-[12rem] truncate">{selectedFile.name}</span> : null}
          </div>

          <div className="toolbar-row">
            <button type="button" onClick={handleGoUp} disabled={currentPath === '/'} className="btn-icon" title="Subir nivel" aria-label="Subir nivel">
              <ArrowUpIcon />
            </button>
            <button type="button" onClick={() => void loadDirectory(currentPath)} className="btn-icon" title="Actualizar" aria-label="Actualizar">
              <RefreshIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowSearch((previous) => !previous)}
              className={showSearch ? 'btn-secondary' : 'btn-icon'}
              title="Buscar en la carpeta"
              aria-label="Buscar en la carpeta"
            >
              <SearchIcon />
              {showSearch ? 'Busqueda' : null}
            </button>
            <button
              type="button"
              onClick={openBookmarkModal}
              disabled={isCurrentPathBookmarked}
              className={isCurrentPathBookmarked ? 'btn-secondary opacity-70' : 'btn-secondary'}
              title={isCurrentPathBookmarked ? 'Ruta guardada' : 'Guardar ruta'}
              aria-label={isCurrentPathBookmarked ? 'Ruta guardada' : 'Guardar ruta'}
            >
              <BookmarkIcon filled={isCurrentPathBookmarked} />
              {isCurrentPathBookmarked ? 'Guardada' : 'Guardar'}
            </button>
            {onOpenTerminal ? (
              <button type="button" onClick={() => onOpenTerminal(currentPath)} className="btn-secondary">
                <TerminalIcon />
                Terminal
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <form onSubmit={handlePathSubmit} className="min-w-[18rem] flex-1">
            <input
              type="text"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              className="input font-mono"
              placeholder="/var/log"
            />
          </form>

          <div className="muted-surface flex items-center gap-2 px-2.5 py-1.5">
            <SortIcon />
            <span className="body-xs">Orden</span>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(event) => {
                const [field, order] = event.target.value.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}
              className="select min-h-0 border-transparent bg-transparent px-1 py-0"
            >
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="date-desc">Fecha reciente</option>
              <option value="date-asc">Fecha antigua</option>
              <option value="size-desc">Tamano mayor</option>
              <option value="size-asc">Tamano menor</option>
            </select>
          </div>
        </div>

        {actionError ? <div className="notice-danger mt-2.5">{actionError}</div> : null}
      </div>

      {showSearch ? (
        <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
          <div className="section-label">Busqueda en carpeta</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleSearchInDirectory()}
              placeholder="Buscar texto dentro de los archivos de esta carpeta"
              className="input min-w-[18rem] flex-1"
            />
            <button type="button" onClick={() => void handleSearchInDirectory()} disabled={searching || !searchText.trim()} className="btn-primary">
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="app-scroll mt-2.5 max-h-44 space-y-2 overflow-y-auto">
              <div className="body-sm">{searchResults.length} archivo(s) encontrado(s)</div>
              {searchResults.map((result, index) => (
                <button
                  key={`${result.filepath}-${index}`}
                  type="button"
                  className="panel-surface block w-full px-4 py-3 text-left hover:border-[var(--border-strong)]"
                  onClick={() => {
                    if (onOpenLog) {
                      onOpenLog(result.filepath, result.filename);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[var(--accent-strong)]">{result.filename}</div>
                      {result.matches.length > 0 ? (
                        <div className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                          L{result.matches[0].line}: {result.matches[0].content}
                        </div>
                      ) : null}
                    </div>
                    <span className="badge-warning shrink-0">{result.matches.length} coincidencia(s)</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {bookmarks.length > 0 ? (
        <div className="border-b border-[var(--border-subtle)] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-label">Rutas guardadas</span>
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="btn-chip group">
                {bookmark.isLogDirectory ? <LogIcon /> : <FolderIcon />}
                <button type="button" className="truncate" onClick={() => void loadDirectory(bookmark.path)}>
                  {bookmark.name}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemoveBookmark(bookmark)}
                  className="btn-icon-quiet ml-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Quitar ${bookmark.name}`}
                  title={`Quitar ${bookmark.name}`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="app-scroll flex-1 overflow-y-auto">
        {loading ? (
          <div className="empty-state h-full">
            <div className="empty-state-icon">
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="text-base font-semibold text-[var(--text-primary)]">Cargando directorio</div>
          </div>
        ) : error ? (
          <div className="empty-state h-full">
            <div className="empty-state-icon" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', borderColor: 'rgba(255,149,167,0.18)' }}>
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <div className="text-base font-semibold text-[var(--text-primary)]">No se pudo abrir la ruta</div>
            <p className="body-sm max-w-md">{error}</p>
            <button type="button" onClick={() => void loadDirectory(currentPath)} className="btn-secondary">
              Reintentar
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="empty-state h-full">
            <div className="empty-state-icon">
              <FolderIcon />
            </div>
            <div className="text-base font-semibold text-[var(--text-primary)]">Directorio vacio</div>
            <p className="body-sm">No hay archivos visibles en esta ruta o el directorio esta vacio.</p>
          </div>
        ) : (
          <table className="table-shell">
            <thead className="table-head">
              <tr>
                <th className="table-header-cell">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                    Nombre
                    {sortField === 'name' ? <span className="text-[var(--accent)]">{sortOrder === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
                <th className="table-header-cell w-28">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('size')}>
                    Tamano
                    {sortField === 'size' ? <span className="text-[var(--accent)]">{sortOrder === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
                <th className="table-header-cell w-44">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort('date')}>
                    Modificado
                    {sortField === 'date' ? <span className="text-[var(--accent)]">{sortOrder === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
                <th className="table-header-cell w-20">Permisos</th>
                <th className="table-header-cell w-28 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file.path}
                  className="table-row cursor-pointer"
                  data-selected={selectedFile?.path === file.path}
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => handleNavigate(file)}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.03)] p-2">
                        {file.isDirectory ? <FolderIcon /> : isLogFile(file.name) ? <LogIcon /> : <FileIcon />}
                      </div>
                      <span className="truncate text-[var(--text-primary)]">{file.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-[var(--text-secondary)]">{file.isDirectory ? '-' : formatSize(file.size)}</td>
                  <td className="table-cell text-[var(--text-secondary)]">{formatDate(file.modifyTime)}</td>
                  <td className="table-cell font-mono text-[var(--text-muted)]">{file.permissions}</td>
                  <td className="table-cell">
                    {!file.isDirectory ? (
                      <div className="flex items-center justify-end gap-1">
                        {isLogFile(file.name) && onOpenLog ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenLog(file.path, file.name);
                            }}
                            className="btn-icon-quiet"
                            title="Abrir log"
                            aria-label={`Abrir log ${file.name}`}
                          >
                            <ViewLogIcon />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownload(file);
                          }}
                          className="btn-icon-quiet"
                          title="Descargar"
                          aria-label={`Descargar ${file.name}`}
                        >
                          <DownloadIcon />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-neutral">{sortedFiles.length} elemento(s)</span>
          <span className="badge-neutral font-mono">{currentPath}</span>
        </div>
        {selectedFile && !selectedFile.isDirectory ? (
          <div className="body-sm">
            {selectedFile.name} • {formatSize(selectedFile.size)}
          </div>
        ) : null}
      </div>

      {showBookmarkModal ? (
        <Modal
          title="Guardar ruta"
          description="Crea un acceso rapido para volver a esta carpeta desde cualquier sesion."
          onClose={() => setShowBookmarkModal(false)}
          widthClassName="max-w-lg"
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={() => setShowBookmarkModal(false)}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAddBookmark()}
                disabled={!bookmarkName.trim() || savingBookmark}
                className="btn-primary"
              >
                {savingBookmark ? 'Guardando...' : 'Guardar ruta'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Ruta actual</label>
              <div className="muted-surface px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{currentPath}</div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Nombre del acceso</label>
              <input
                type="text"
                value={bookmarkName}
                onChange={(event) => setBookmarkName(event.target.value)}
                className="input"
                placeholder="Logs tomcat"
                autoFocus
              />
            </div>

            <label className="muted-surface flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">Esta ruta contiene logs</div>
                <div className="mt-1 body-xs">Se mostrara como acceso rapido para exploracion de logs.</div>
              </div>
              <input
                type="checkbox"
                checked={bookmarkIsLog}
                onChange={(event) => setBookmarkIsLog(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};
