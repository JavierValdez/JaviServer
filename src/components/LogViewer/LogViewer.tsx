import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LogPattern } from '../../types';

interface LogViewerProps {
  profileId: string;
  filePath: string;
}

interface LogFileInfo {
  lines: number;
  size: string;
  lastModified: string;
}

const PlayIcon = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const FilterIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const LoadIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const quickFilters = [
  { label: 'Errores', pattern: 'ERROR|SEVERE|Exception|FATAL', color: '#ff8b9f' },
  { label: 'Warnings', pattern: 'WARN|WARNING', color: '#f4c971' },
  { label: 'Excepciones', pattern: 'Exception|Caused by|at \\w+\\.', color: '#ff8b9f' },
  { label: 'Stack trace', pattern: 'at .*\\(.*\\.java:\\d+\\)', color: '#ff8b9f' },
  { label: 'HTTP 5xx', pattern: 'HTTP.*\\s5\\d{2}|status[=:]\\s*5\\d{2}', color: '#ff8b9f' },
  { label: 'HTTP 4xx', pattern: 'HTTP.*\\s4\\d{2}|status[=:]\\s*4\\d{2}', color: '#f4c971' },
  { label: 'Deploys', pattern: 'Deploying|deployed|undeploying|Starting|Started|Stopping|Stopped', color: '#79bbff' },
  { label: 'Memoria', pattern: 'OutOfMemory|heap|GC|memory', color: '#c6a8ff' },
];

const lineOptions = [
  { value: 100, label: '100 lineas' },
  { value: 200, label: '200 lineas' },
  { value: 500, label: '500 lineas' },
  { value: 1000, label: '1,000 lineas' },
  { value: 5000, label: '5,000 lineas' },
  { value: -1, label: 'Todo el archivo' },
];

export const LogViewer: React.FC<LogViewerProps> = ({ profileId, filePath }) => {
  const { profiles } = useAppStore();
  const [lines, setLines] = useState<string[]>([]);
  const [filteredLines, setFilteredLines] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tailId, setTailId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchResultLabel, setSearchResultLabel] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [liveFilter, setLiveFilter] = useState('');
  const [initialLines, setInitialLines] = useState(200);
  const [isLoading, setIsLoading] = useState(false);
  const [fileInfo, setFileInfo] = useState<LogFileInfo | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const profile = profiles.find((entry) => entry.id === profileId);
  const patterns = profile?.logPatterns || getDefaultPatterns();
  const fileName = filePath.split('/').pop() || filePath;
  const shownLines = liveFilter ? filteredLines : lines;

  useEffect(() => {
    const loadFileInfo = async () => {
      try {
        const info = await window.api.logs.getFileInfo(profileId, filePath);
        setFileInfo(info);
      } catch (err) {
        console.error('Error loading file info:', err);
      }
    };

    void loadFileInfo();
  }, [filePath, profileId]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [autoScroll, filteredLines, lines, searchResults]);

  useEffect(() => {
    if (!liveFilter.trim()) {
      setFilteredLines(lines);
      return;
    }

    try {
      const regex = new RegExp(liveFilter, 'i');
      setFilteredLines(lines.filter((line) => regex.test(line)));
    } catch {
      setFilteredLines(lines.filter((line) => line.toLowerCase().includes(liveFilter.toLowerCase())));
    }
  }, [lines, liveFilter]);

  useEffect(() => {
    const handleLogData = (data: { tailId: string; data: string }) => {
      if (data.tailId === tailId) {
        const newLines = data.data.split('\n').filter((line) => line.trim());
        setLines((previous) => [...previous, ...newLines].slice(-5000));
      }
    };

    const unsubscribe = window.api.logs.onData(handleLogData);

    return () => {
      if (tailId) {
        window.api.logs.stopTail(tailId);
      }
      unsubscribe();
    };
  }, [tailId]);

  const clearResults = () => {
    setSearchResults([]);
    setSearchResultLabel(null);
    setError(null);
  };

  const startTail = async () => {
    try {
      clearResults();
      setLines([]);
      const id = await window.api.logs.startTail(profileId, filePath, initialLines);
      setTailId(id);
      setIsStreaming(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar el stream.');
      setLines([]);
    }
  };

  const stopTail = async () => {
    if (tailId) {
      await window.api.logs.stopTail(tailId);
      setTailId(null);
      setIsStreaming(false);
    }
  };

  const loadLines = async (numLines: number) => {
    if (tailId) {
      await window.api.logs.stopTail(tailId);
      setTailId(null);
      setIsStreaming(false);
    }

    setIsLoading(true);
    setLines([]);
    clearResults();

    try {
      const all = numLines === -1;
      const result = await window.api.logs.readLines(profileId, filePath, {
        lines: all ? undefined : numLines,
        all,
        fromStart: false,
      });

      const loadedLines = result.split('\n');
      while (loadedLines.length > 0 && !loadedLines[loadedLines.length - 1]) {
        loadedLines.pop();
      }

      setLines(loadedLines);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar las lineas.');
      setLines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchByDateRange = async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    clearResults();

    try {
      const result = await window.api.logs.searchByDateRange(profileId, filePath, startDate, endDate);
      setSearchResults(result.split('\n').filter((line: string) => line.trim()));
      setSearchResultLabel(`Resultados entre ${startDate} y ${endDate}`);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo buscar por rango de fechas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    clearResults();

    try {
      const results = await window.api.logs.grep(profileId, filePath, searchQuery, {
        ignoreCase: true,
        context: 2,
      });

      setSearchResults(results.split('\n').filter((line: string) => line.trim()));
      setSearchResultLabel(`Resultados para "${searchQuery}"`);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo ejecutar la busqueda.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setLines([]);
    clearResults();
    setActiveFilter(null);
  };

  const highlightLine = useCallback(
    (line: string): React.ReactNode => {
      const escaped = escapeHtml(line);
      let highlighted = escaped;
      let color = '';

      for (const pattern of patterns) {
        if (line.toLowerCase().includes(pattern.pattern.toLowerCase())) {
          color = pattern.color;
          break;
        }
      }

      const timestampRegex = /(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/g;
      highlighted = highlighted.replace(timestampRegex, '<span class="text-[var(--text-muted)]">$1</span>');

      return <span style={{ color: color || 'inherit' }} dangerouslySetInnerHTML={{ __html: highlighted }} />;
    },
    [patterns],
  );

  const streamBadgeClass = isStreaming ? 'badge-success' : isLoading ? 'badge-warning' : 'badge-neutral';
  const streamLabel = isStreaming ? 'Live' : isLoading ? 'Cargando' : 'Detenido';

  return (
    <div className="panel-surface-strong flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="section-label">Log stream</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="truncate text-base font-semibold text-[var(--text-primary)]">{fileName}</div>
              <span className={streamBadgeClass}>{streamLabel}</span>
              {fileInfo ? <span className="badge-neutral">{fileInfo.lines.toLocaleString()} lineas</span> : null}
              {fileInfo ? <span className="badge-neutral">{fileInfo.size}</span> : null}
            </div>
            <div className="mt-2 truncate font-mono text-xs text-[var(--text-secondary)]">{filePath}</div>
          </div>

          <div className="toolbar-row">
            <div className="muted-surface flex items-center gap-2 px-3 py-2">
              <LoadIcon />
              <span className="body-xs">Carga inicial</span>
              <select
                value={initialLines}
                onChange={(event) => {
                  const newValue = Number(event.target.value);
                  setInitialLines(newValue);
                  void loadLines(newValue);
                }}
                className="select min-h-0 border-transparent bg-transparent px-1 py-0"
                disabled={isLoading}
              >
                {lineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" onClick={() => setShowDateFilter((previous) => !previous)} className={showDateFilter ? 'btn-secondary' : 'btn-icon'} title="Filtrar por fecha" aria-label="Filtrar por fecha">
              <CalendarIcon />
              {showDateFilter ? 'Fechas' : null}
            </button>
            <button type="button" onClick={() => setShowSearch((previous) => !previous)} className={showSearch ? 'btn-secondary' : 'btn-icon'} title="Buscar" aria-label="Buscar">
              <SearchIcon />
              {showSearch ? 'Buscar' : null}
            </button>
            <button type="button" onClick={handleClear} className="btn-icon" title="Limpiar" aria-label="Limpiar">
              <ClearIcon />
            </button>

            <label className="muted-surface flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="body-xs">Auto-scroll</span>
            </label>

            {isStreaming ? (
              <button type="button" onClick={() => void stopTail()} className="btn-danger">
                <PauseIcon />
                Detener
              </button>
            ) : (
              <button type="button" onClick={() => void startTail()} disabled={isLoading} className="btn-primary">
                <PlayIcon />
                Live
              </button>
            )}
          </div>
        </div>

        {error ? <div className="notice-danger mt-3">{error}</div> : null}
      </div>

      {showDateFilter ? (
        <div className="border-b border-[var(--border-subtle)] px-3 py-3">
          <div className="section-label">Rango de fechas</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input w-auto min-w-[11rem]" />
            <span className="body-xs">hasta</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="input w-auto min-w-[11rem]" />
            <button type="button" onClick={() => void searchByDateRange()} disabled={!startDate || !endDate || isLoading} className="btn-secondary">
              Buscar por fechas
            </button>
            <span className="body-xs">(Formato esperado: YYYY-MM-DD)</span>
          </div>
        </div>
      ) : null}

      {showSearch ? (
        <div className="border-b border-[var(--border-subtle)] px-3 py-3">
          <div className="section-label">Busqueda y filtros</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void handleSearch()}
              placeholder="Buscar en el archivo con grep"
              className="input min-w-[18rem] flex-1"
            />
            <button type="button" onClick={() => void handleSearch()} disabled={isSearching || !searchQuery.trim()} className="btn-primary">
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
            {searchResults.length > 0 ? (
              <button type="button" onClick={clearResults} className="btn-ghost">
                Limpiar resultados
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="section-label">Filtros rapidos</span>
            {quickFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => {
                  setLiveFilter(filter.pattern);
                  setActiveFilter(filter.label);
                }}
                className="btn-chip"
                style={{
                  color: filter.color,
                  borderColor: activeFilter === filter.label ? `${filter.color}55` : undefined,
                  background: activeFilter === filter.label ? `${filter.color}22` : undefined,
                }}
              >
                <FilterIcon />
                {filter.label}
              </button>
            ))}
            {activeFilter ? (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter(null);
                  setLiveFilter('');
                  clearResults();
                }}
                className="btn-ghost"
              >
                Limpiar filtro
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="section-label">{isStreaming ? 'Filtro en vivo' : 'Filtrar lineas'}</span>
          <input
            type="text"
            value={liveFilter}
            onChange={(event) => setLiveFilter(event.target.value)}
            placeholder="Regex o texto libre"
            className="input min-w-[16rem] flex-1"
          />
          {liveFilter ? <span className="badge-neutral">{filteredLines.length} de {lines.length}</span> : null}
          {liveFilter ? (
            <button
              type="button"
              onClick={() => {
                setLiveFilter('');
                setActiveFilter(null);
              }}
              className="btn-ghost"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={logContainerRef}
        className="app-scroll flex-1 overflow-y-auto bg-[var(--surface-contrast)] px-3 py-3 font-mono text-[13px]"
        onScroll={(event) => {
          const target = event.currentTarget;
          const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
          if (autoScroll !== isAtBottom) {
            setAutoScroll(isAtBottom);
          }
        }}
      >
        {searchResults.length > 0 ? (
          <div className="space-y-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="badge-accent">{searchResultLabel || 'Resultados'}</span>
              <span className="badge-neutral">{searchResults.length} coincidencia(s)</span>
            </div>
            {searchResults.map((line, index) => (
              <div key={`${line}-${index}`} className="rounded-xl border border-[rgba(121,187,255,0.14)] bg-[rgba(121,187,255,0.08)] px-3 py-2">
                {highlightLine(line)}
              </div>
            ))}
          </div>
        ) : lines.length === 0 ? (
          <div className="empty-state h-full">
            <div className="empty-state-icon">
              <SearchIcon />
            </div>
            <div className="text-base font-semibold text-[var(--text-primary)]">
              {isStreaming ? 'Esperando datos...' : 'Carga lineas o inicia el stream'}
            </div>
            <p className="body-sm max-w-md">
              Usa carga inicial para revisar historial, o activa Live para seguir el archivo en tiempo real.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {shownLines.map((line, index) => (
              <div key={`${index}-${line.slice(0, 24)}`} className="rounded-lg px-2 py-1 hover:bg-[rgba(121,187,255,0.05)]">
                {highlightLine(line)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-neutral">{lines.length} linea(s) cargadas</span>
          {liveFilter ? <span className="badge-neutral">{filteredLines.length} visibles</span> : null}
        </div>
        {fileInfo?.lastModified ? <div className="body-xs">Actualizado: {fileInfo.lastModified}</div> : null}
      </div>
    </div>
  );
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultPatterns(): LogPattern[] {
  return [
    { pattern: 'SEVERE', color: '#ff8b9f', label: 'Severe' },
    { pattern: 'ERROR', color: '#ff8b9f', label: 'Error' },
    { pattern: 'WARN', color: '#f4c971', label: 'Warning' },
    { pattern: 'WARNING', color: '#f4c971', label: 'Warning' },
    { pattern: 'INFO', color: '#79bbff', label: 'Info' },
    { pattern: 'DEBUG', color: '#93a4c5', label: 'Debug' },
    { pattern: 'Exception', color: '#ff8b9f', label: 'Exception' },
  ];
}
