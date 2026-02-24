import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const LoadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Quick filter patterns for Tomcat and common logs
const quickFilters = [
  { label: 'Errores', pattern: 'ERROR|SEVERE|Exception|FATAL', color: '#ef4444' },
  { label: 'Warnings', pattern: 'WARN|WARNING', color: '#f59e0b' },
  { label: 'Excepciones', pattern: 'Exception|Caused by|at \\w+\\.', color: '#dc2626' },
  { label: 'Stack Trace', pattern: 'at .*\\(.*\\.java:\\d+\\)', color: '#dc2626' },
  { label: 'HTTP 5xx', pattern: 'HTTP.*\\s5\\d{2}|status[=:]\\s*5\\d{2}', color: '#ef4444' },
  { label: 'HTTP 4xx', pattern: 'HTTP.*\\s4\\d{2}|status[=:]\\s*4\\d{2}', color: '#f59e0b' },
  { label: 'Deployments', pattern: 'Deploying|deployed|undeploying|Starting|Started|Stopping|Stopped', color: '#3b82f6' },
  { label: 'Memory', pattern: 'OutOfMemory|heap|GC|memory', color: '#8b5cf6' },
];

// Opciones de cantidad de líneas
const lineOptions = [
  { value: 100, label: '100 líneas' },
  { value: 200, label: '200 líneas' },
  { value: 500, label: '500 líneas' },
  { value: 1000, label: '1,000 líneas' },
  { value: 5000, label: '5,000 líneas' },
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
  const logContainerRef = useRef<HTMLDivElement>(null);

  const profile = profiles.find((p) => p.id === profileId);
  const patterns = profile?.logPatterns || getDefaultPatterns();

  // Cargar información del archivo al montar
  useEffect(() => {
    const loadFileInfo = async () => {
      try {
        const info = await window.api.logs.getFileInfo(profileId, filePath);
        setFileInfo(info);
      } catch (err) {
        console.error('Error loading file info:', err);
      }
    };
    loadFileInfo();
  }, [profileId, filePath]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [lines, filteredLines, autoScroll]);

  // Filter lines based on liveFilter
  useEffect(() => {
    if (!liveFilter.trim()) {
      setFilteredLines(lines);
    } else {
      try {
        const regex = new RegExp(liveFilter, 'i');
        setFilteredLines(lines.filter(line => regex.test(line)));
      } catch {
        // If invalid regex, do simple string match
        setFilteredLines(lines.filter(line => 
          line.toLowerCase().includes(liveFilter.toLowerCase())
        ));
      }
    }
  }, [lines, liveFilter]);

  // Listen for log data
  useEffect(() => {
    const handleLogData = (data: { tailId: string; data: string }) => {
      if (data.tailId === tailId) {
        const newLines = data.data.split('\n').filter((l) => l.trim());
        setLines((prev) => [...prev, ...newLines].slice(-5000)); // Keep last 5000 lines
      }
    };

    window.api.logs.onData(handleLogData);

    return () => {
      // Cleanup: stop tail when component unmounts
      if (tailId) {
        window.api.logs.stopTail(tailId);
      }
    };
  }, [tailId]);

  const startTail = async () => {
    try {
      setLines([]);
      const id = await window.api.logs.startTail(profileId, filePath, initialLines);
      setTailId(id);
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Error starting tail:', err);
      setLines([`Error: ${err.message}`]);
    }
  };

  const stopTail = async () => {
    if (tailId) {
      await window.api.logs.stopTail(tailId);
      setTailId(null);
      setIsStreaming(false);
    }
  };

  // Cargar líneas del archivo (sin streaming)
  const loadLines = async (numLines: number) => {
    // Detener el streaming primero si está activo
    if (tailId) {
      await window.api.logs.stopTail(tailId);
      setTailId(null);
      setIsStreaming(false);
    }
    
    setIsLoading(true);
    setLines([]); // Limpiar líneas anteriores
    
    try {
      const all = numLines === -1;
      console.log('[LogViewer] loadLines called with numLines:', numLines, 'all:', all);
      const result = await window.api.logs.readLines(profileId, filePath, {
        lines: all ? undefined : numLines,
        all,
        fromStart: false
      });
      console.log('[LogViewer] readLines result length:', result?.length || 0, 'chars');
      
      // No filtrar líneas vacías si es el archivo completo para evitar perder líneas
      const loadedLines = result.split('\n');
      // Solo filtramos las vacías al final
      while (loadedLines.length > 0 && !loadedLines[loadedLines.length - 1]) {
        loadedLines.pop();
      }
      
      console.log('[LogViewer] Loaded lines count:', loadedLines.length);
      setLines(loadedLines);
      setSearchResults([]);
    } catch (err: any) {
      console.error('[LogViewer] Error loading lines:', err);
      setLines([`Error: ${err.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar por rango de fechas
  const searchByDateRange = async () => {
    if (!startDate || !endDate) return;
    
    setIsLoading(true);
    try {
      const result = await window.api.logs.searchByDateRange(profileId, filePath, startDate, endDate);
      const resultLines = result.split('\n').filter((l: string) => l.trim());
      setSearchResults(resultLines);
    } catch (err: any) {
      setSearchResults([`Error: ${err.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await window.api.logs.grep(profileId, filePath, searchQuery, {
        ignoreCase: true,
        context: 2,
      });

      const resultLines = results.split('\n').filter((l: string) => l.trim());
      setSearchResults(resultLines);
    } catch (err: any) {
      setSearchResults([`Error: ${err.message}`]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setLines([]);
  };

  const highlightLine = useCallback((line: string): React.ReactNode => {
    let highlighted = line;
    let color = '';

    // Find matching pattern
    for (const pattern of patterns) {
      if (line.toLowerCase().includes(pattern.pattern.toLowerCase())) {
        color = pattern.color;
        break;
      }
    }

    // Highlight timestamps (common format: 2024-01-15 10:30:45)
    const timestampRegex = /(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/g;
    highlighted = highlighted.replace(timestampRegex, '<span class="text-gray-500">$1</span>');

    return (
      <span
        style={{ color: color || 'inherit' }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }, [patterns]);

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="flex-1 flex flex-col h-full bg-ssh-dark">
      {/* Toolbar */}
      <div className="p-3 border-b border-gray-700 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 truncate max-w-[200px]" title={filePath}>
            {fileName}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${isStreaming ? 'bg-ssh-success/20 text-ssh-success' : 'bg-gray-600 text-gray-400'}`}>
            {isStreaming ? 'Live' : isLoading ? 'Cargando...' : 'Detenido'}
          </span>
          {fileInfo && (
            <span className="text-xs text-gray-500">
              ({fileInfo.lines.toLocaleString()} líneas, {fileInfo.size})
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Selector de líneas */}
        <div className="flex items-center gap-1">
          <LoadIcon />
          <select
            value={initialLines}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              setInitialLines(newValue);
              // Cargar automáticamente cuando cambia la selección
              loadLines(newValue);
            }}
            className="bg-ssh-darker border border-gray-600 rounded px-2 py-1 text-xs focus:border-ssh-accent focus:outline-none"
            disabled={isLoading}
          >
            {lineOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => loadLines(initialLines)}
            disabled={isLoading}
            className="px-2 py-1 bg-ssh-light hover:bg-gray-600 rounded text-xs transition-colors disabled:opacity-50"
            title="Cargar líneas sin streaming"
          >
            {isLoading ? 'Cargando...' : 'Cargar'}
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`p-2 rounded transition-colors ${showDateFilter ? 'bg-ssh-warning/30 text-ssh-warning' : 'hover:bg-ssh-light text-gray-400'}`}
          title="Filtrar por fecha"
        >
          <CalendarIcon />
        </button>

        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-2 rounded transition-colors ${showSearch ? 'bg-ssh-accent text-ssh-darker' : 'hover:bg-ssh-light text-gray-400'}`}
          title="Buscar"
        >
          <SearchIcon />
        </button>

        <button
          onClick={handleClear}
          className="p-2 hover:bg-ssh-light rounded transition-colors text-gray-400"
          title="Limpiar"
        >
          <ClearIcon />
        </button>

        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll
        </label>

        {isStreaming ? (
          <button
            onClick={stopTail}
            className="flex items-center gap-2 px-3 py-1.5 bg-ssh-error text-white rounded hover:bg-red-600 transition-colors"
          >
            <PauseIcon />
            Detener
          </button>
        ) : (
          <button
            onClick={startTail}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 bg-ssh-success text-ssh-darker rounded hover:bg-green-400 transition-colors disabled:opacity-50"
          >
            <PlayIcon />
            Live
          </button>
        )}
      </div>

      {/* Date filter bar */}
      {showDateFilter && (
        <div className="p-3 border-b border-gray-700 bg-ssh-darker flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Rango de fechas:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-ssh-dark border border-gray-600 rounded px-2 py-1 text-xs focus:border-ssh-accent focus:outline-none"
          />
          <span className="text-gray-500">hasta</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-ssh-dark border border-gray-600 rounded px-2 py-1 text-xs focus:border-ssh-accent focus:outline-none"
          />
          <button
            onClick={searchByDateRange}
            disabled={!startDate || !endDate || isLoading}
            className="px-3 py-1 bg-ssh-warning text-ssh-darker rounded text-xs hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            Buscar por fechas
          </button>
          <span className="text-xs text-gray-500 italic">
            (Formato: YYYY-MM-DD en los logs)
          </span>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div className="p-3 border-b border-gray-700 bg-ssh-darker">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar en el archivo (grep)..."
              className="flex-1 bg-ssh-dark border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-ssh-accent focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-1.5 bg-ssh-accent text-ssh-darker rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          
          {/* Quick filters */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-gray-500 flex items-center mr-1">
              <FilterIcon />
              <span className="ml-1">Filtros rápidos:</span>
            </span>
            {quickFilters.map((filter) => (
              <button
                key={filter.label}
                onClick={() => {
                  // Aplicar filtro tanto para búsqueda como para filtro en vivo
                  setLiveFilter(filter.pattern);
                  setActiveFilter(filter.label);
                }}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  activeFilter === filter.label 
                    ? 'ring-1 ring-white' 
                    : 'hover:opacity-80'
                }`}
                style={{ 
                  backgroundColor: filter.color + '30', 
                  color: filter.color,
                  borderColor: filter.color
                }}
              >
                {filter.label}
              </button>
            ))}
            {activeFilter && (
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setLiveFilter('');
                  setSearchResults([]);
                }}
                className="px-2 py-0.5 text-xs bg-gray-600 text-gray-300 rounded hover:bg-gray-500"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live filter - always available */}
      <div className="px-3 py-2 border-b border-gray-700 bg-ssh-darker/50 flex items-center gap-2">
        <span className="text-xs text-gray-500">
          {isStreaming ? '🔴 Filtro en vivo:' : 'Filtrar líneas:'}
        </span>
        <input
          type="text"
          value={liveFilter}
          onChange={(e) => setLiveFilter(e.target.value)}
          placeholder="Filtrar líneas mostradas (regex o texto)..."
          className="flex-1 bg-ssh-dark border border-gray-600 rounded px-2 py-1 text-xs focus:border-ssh-accent focus:outline-none"
        />
        {liveFilter && (
          <>
            <span className="text-xs text-gray-400">
              {filteredLines.length} de {lines.length} líneas
            </span>
            <button
              onClick={() => {
                setLiveFilter('');
                setActiveFilter(null);
              }}
              className="px-2 py-0.5 text-xs bg-gray-600 text-gray-300 rounded hover:bg-gray-500"
            >
              ×
            </button>
          </>
        )}
      </div>

      {/* Log content */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto font-mono text-sm p-3"
        onScroll={(e) => {
          const target = e.currentTarget;
          const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
          if (autoScroll !== isAtBottom) {
            setAutoScroll(isAtBottom);
          }
        }}
      >
        {showSearch && searchResults.length > 0 ? (
          // Show search results
          <div className="space-y-1">
            <div className="text-gray-400 mb-2">
              {searchResults.length} resultados para "{searchQuery}"
            </div>
            {searchResults.map((line, i) => (
              <div key={i} className="py-0.5 border-l-2 border-ssh-accent pl-2 bg-ssh-light/30">
                {highlightLine(line)}
              </div>
            ))}
          </div>
        ) : lines.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {isStreaming ? 'Esperando datos...' : 'Presiona "Iniciar" para ver logs en tiempo real'}
          </div>
        ) : (
          // Show log lines (filtered if liveFilter is active)
          <div className="space-y-0.5">
            {(liveFilter ? filteredLines : lines).map((line, i) => (
              <div key={i} className="py-0.5 hover:bg-ssh-light/30">
                {highlightLine(line)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 border-t border-gray-700 text-sm text-gray-500 flex justify-between">
        <span>{lines.length} líneas</span>
        <span>{filePath}</span>
      </div>
    </div>
  );
};

function getDefaultPatterns(): LogPattern[] {
  return [
    { pattern: 'SEVERE', color: '#ef4444', label: 'Severe' },
    { pattern: 'ERROR', color: '#ef4444', label: 'Error' },
    { pattern: 'WARN', color: '#f59e0b', label: 'Warning' },
    { pattern: 'WARNING', color: '#f59e0b', label: 'Warning' },
    { pattern: 'INFO', color: '#3b82f6', label: 'Info' },
    { pattern: 'DEBUG', color: '#6b7280', label: 'Debug' },
    { pattern: 'Exception', color: '#dc2626', label: 'Exception' },
  ];
}
