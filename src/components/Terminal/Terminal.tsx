import React, { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import type { TerminalSuggestion } from '../../types';

interface TerminalProps {
  profileId: string;
  initialPath?: string;
  currentPath?: string;
  isActive?: boolean;
}

interface AutocompleteContext {
  mode: 'command' | 'path';
  rawToken: string;
  query: string;
  directoryOnly: boolean;
  currentCommand: string;
  quotePrefix: '' | '"' | "'";
}

const PATH_FRIENDLY_COMMANDS = new Set([
  'cd',
  'ls',
  'cat',
  'tail',
  'head',
  'less',
  'vim',
  'nano',
  'rm',
  'mv',
  'cp',
  'mkdir',
  'touch',
  'chmod',
  'chown',
  'grep',
  'find',
  'du',
  'tar',
]);

const isMacPlatform =
  typeof navigator !== 'undefined' && /(mac|iphone|ipad)/i.test(navigator.platform || navigator.userAgent);

const TerminalIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 9h10v10H9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
  </svg>
);

const PasteIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3h6m-5 0a1 1 0 00-1 1v1h6V4a1 1 0 00-1-1m-4 0h4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 6h10a2 2 0 012 2v11a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7l1 12h6l1-12" />
  </svg>
);

const ResizeIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3H3v5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 3h5v5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16v5h5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 16v5h-5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 8L3 3" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 8l5-5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16l-5 5" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 16l5 5" />
  </svg>
);

const SuggestionIcon = ({ type }: { type: TerminalSuggestion['type'] }) => (
  type === 'command' ? (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h5l2 2h11v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
);

const ControlButton = ({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
  >
    {icon}
    <span>{label}</span>
  </button>
);

function normalizePosixPath(pathValue: string): string {
  const isAbsolute = pathValue.startsWith('/');
  const segments = pathValue.split('/').filter(Boolean);
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }

    stack.push(segment);
  }

  if (!isAbsolute) {
    return stack.join('/');
  }

  return stack.length > 0 ? `/${stack.join('/')}` : '/';
}

function resolveRelativeRemotePath(basePath: string, targetPath: string): string {
  if (!targetPath) {
    return basePath;
  }

  if (targetPath.startsWith('/')) {
    return normalizePosixPath(targetPath);
  }

  if (targetPath.startsWith('~/') || targetPath === '~') {
    return targetPath;
  }

  if (!basePath || basePath === '~') {
    return targetPath;
  }

  return normalizePosixPath(`${basePath.replace(/\/+$/, '')}/${targetPath}`);
}

function deriveAutocompleteContext(buffer: string): AutocompleteContext | null {
  const trimmedStart = buffer.trimStart();
  const trailingWhitespace = /\s$/.test(buffer);

  if (!trimmedStart) {
    return null;
  }

  const parts = trimmedStart.split(/\s+/);
  const tokenIndex = trailingWhitespace ? parts.length : parts.length - 1;
  const rawToken = trailingWhitespace ? '' : (parts[parts.length - 1] ?? '');
  const currentCommand = (parts[0] ?? '').replace(/^['"]|['"]$/g, '');
  const quotePrefix = rawToken.startsWith('"') || rawToken.startsWith("'")
    ? (rawToken[0] as '"' | "'")
    : '';
  const query = quotePrefix ? rawToken.slice(1) : rawToken;

  if (tokenIndex === 0) {
    return {
      mode: 'command',
      rawToken,
      query,
      directoryOnly: false,
      currentCommand,
      quotePrefix,
    };
  }

  if (rawToken.startsWith('-')) {
    return null;
  }

  const wantsPathSuggestions =
    PATH_FRIENDLY_COMMANDS.has(currentCommand) ||
    query.startsWith('/') ||
    query.startsWith('./') ||
    query.startsWith('../') ||
    query.startsWith('~/') ||
    query === '~' ||
    query.includes('/');

  if (!wantsPathSuggestions) {
    return null;
  }

  return {
    mode: 'path',
    rawToken,
    query,
    directoryOnly: currentCommand === 'cd',
    currentCommand,
    quotePrefix,
  };
}

function applyTypedData(
  previousBuffer: string,
  data: string,
  onCommit: (command: string) => void,
): string {
  if (!data || data.startsWith('\u001b')) {
    return previousBuffer;
  }

  let nextBuffer = previousBuffer;

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      const committedCommand = nextBuffer.trim();
      if (committedCommand) {
        onCommit(committedCommand);
      }
      nextBuffer = '';
      continue;
    }

    if (char === '\u007f' || char === '\b') {
      nextBuffer = nextBuffer.slice(0, -1);
      continue;
    }

    if (char === '\u0003' || char === '\u0015') {
      nextBuffer = '';
      continue;
    }

    if (char >= ' ') {
      nextBuffer += char;
    }
  }

  return nextBuffer;
}

function replaceTrailingToken(buffer: string, rawToken: string, replacement: string): string {
  if (!rawToken) {
    return `${buffer}${replacement}`;
  }

  const tokenIndex = buffer.lastIndexOf(rawToken);
  if (tokenIndex < 0) {
    return `${buffer}${replacement}`;
  }

  return `${buffer.slice(0, tokenIndex)}${replacement}${buffer.slice(tokenIndex + rawToken.length)}`;
}

function resolveNextWorkingPath(command: string, currentPath: string): string | null {
  const match = command.match(/^cd(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }

  const rawTarget = match[1]?.trim() ?? '';
  if (!rawTarget || rawTarget === '~') {
    return '~';
  }

  if (rawTarget === '-') {
    return currentPath;
  }

  const targetPath = rawTarget.replace(/^['"]|['"]$/g, '');
  if (!targetPath) {
    return currentPath;
  }

  return resolveRelativeRemotePath(currentPath, targetPath);
}

function formatSuggestionInsertText(
  suggestion: TerminalSuggestion,
  context: AutocompleteContext,
): string {
  const trailingSpace = suggestion.insertText.endsWith(' ') ? ' ' : '';
  const baseInsertText = suggestion.insertText.trimEnd();

  if (context.quotePrefix) {
    if (suggestion.type === 'path' && !suggestion.isDirectory) {
      return `${context.quotePrefix}${baseInsertText}${context.quotePrefix}${trailingSpace}`;
    }

    return `${context.quotePrefix}${baseInsertText}${trailingSpace}`;
  }

  if (suggestion.type === 'path' && /\s/.test(baseInsertText)) {
    if (suggestion.isDirectory) {
      return `"${baseInsertText}`;
    }

    return `"${baseInsertText}"${trailingSpace}`;
  }

  return suggestion.insertText;
}

function isCopyShortcut(event: KeyboardEvent, term: XTerm): boolean {
  const key = event.key.toLowerCase();

  if (isMacPlatform) {
    return event.metaKey && key === 'c';
  }

  return event.ctrlKey && key === 'c' && (event.shiftKey || term.hasSelection());
}

function isPasteShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();

  if (isMacPlatform) {
    return event.metaKey && key === 'v';
  }

  return (event.ctrlKey && key === 'v') || (event.shiftKey && key === 'insert');
}

export const Terminal: React.FC<TerminalProps> = ({ profileId, initialPath, currentPath, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const resizeFrameRef = useRef<number | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const scheduleFitRef = useRef<() => void>(() => undefined);
  const lastSyncedPath = useRef<string | undefined>(initialPath);
  const terminalPathRef = useRef(currentPath || initialPath || '~');
  const inputBufferRef = useRef('');
  const suggestionsRef = useRef<TerminalSuggestion[]>([]);
  const activeSuggestionIndexRef = useRef(0);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [statusMessage, setStatusMessage] = useState('Preparando terminal SSH');
  const [terminalPath, setTerminalPath] = useState(currentPath || initialPath || '~');
  const [inputBuffer, setInputBuffer] = useState('');
  const [suggestions, setSuggestions] = useState<TerminalSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    terminalPathRef.current = terminalPath;
  }, [terminalPath]);

  useEffect(() => {
    inputBufferRef.current = inputBuffer;
  }, [inputBuffer]);

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    activeSuggestionIndexRef.current = activeSuggestionIndex;
  }, [activeSuggestionIndex]);

  useEffect(() => {
    if (isActive && currentPath && currentPath !== lastSyncedPath.current && xtermRef.current) {
      void window.api.terminal.write(profileId, `cd "${currentPath}"\n`);
      lastSyncedPath.current = currentPath;
      terminalPathRef.current = currentPath;
      setTerminalPath(currentPath);
      scheduleFitRef.current();
    }
  }, [currentPath, isActive, profileId]);

  useEffect(() => {
    const context = isActive && status === 'ready' ? deriveAutocompleteContext(inputBuffer) : null;
    if (!context) {
      setSuggestions([]);
      setActiveSuggestionIndex(0);
      setIsSuggestionLoading(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSuggestionLoading(true);
        const nextSuggestions = await window.api.terminal.getSuggestions(profileId, {
          mode: context.mode,
          query: context.query,
          currentPath: terminalPath,
          directoryOnly: context.directoryOnly,
        });

        if (!isCancelled) {
          setSuggestions(nextSuggestions);
          setActiveSuggestionIndex(0);
        }
      } catch {
        if (!isCancelled) {
          setSuggestions([]);
          setActiveSuggestionIndex(0);
        }
      } finally {
        if (!isCancelled) {
          setIsSuggestionLoading(false);
        }
      }
    }, 160);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [inputBuffer, isActive, profileId, status, terminalPath]);

  useEffect(() => {
    if (!terminalRef.current || !viewportRef.current || initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const fitAddon = new FitAddon();
    const term = new XTerm({
      theme: {
        background: '#08111f',
        foreground: '#edf3fb',
        cursor: '#7dd3fc',
        cursorAccent: '#09111f',
        selectionBackground: '#20446e',
        black: '#08111f',
        red: '#ff8b9f',
        green: '#68d8aa',
        yellow: '#f4c971',
        blue: '#79bbff',
        magenta: '#c6a8ff',
        cyan: '#7ce2ff',
        white: '#dfe7f5',
        brightBlack: '#51627e',
        brightRed: '#ff9cac',
        brightGreen: '#7ae3b6',
        brightYellow: '#ffd88d',
        brightBlue: '#9dd0ff',
        brightMagenta: '#d5beff',
        brightCyan: '#9be8ff',
        brightWhite: '#f8fbff',
      },
      fontSize: 13,
      lineHeight: 1.32,
      letterSpacing: 0.2,
      fontFamily: '"SF Mono", "IBM Plex Mono", Consolas, monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline',
      scrollback: 7000,
      cols: 80,
      rows: 24,
    });

    const syncSize = () => {
      const host = viewportRef.current;
      if (!host || !xtermRef.current || !fitAddonRef.current) {
        return;
      }

      if (host.clientWidth < 120 || host.clientHeight < 120) {
        return;
      }

      fitAddonRef.current.fit();
      void window.api.terminal.resize(profileId, xtermRef.current.cols, xtermRef.current.rows);
    };

    const scheduleFit = () => {
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeTimeoutRef.current = window.setTimeout(() => {
          syncSize();
        }, 40);
      });
    };

    scheduleFitRef.current = scheduleFit;
    fitAddonRef.current = fitAddon;
    xtermRef.current = term;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    term.focus();
    scheduleFit();

    const commitCommand = (command: string) => {
      const nextPath = resolveNextWorkingPath(command, terminalPathRef.current);
      if (nextPath) {
        terminalPathRef.current = nextPath;
        setTerminalPath(nextPath);
      }
    };

    const copySelection = async () => {
      if (!term.hasSelection()) {
        return;
      }

      await Promise.resolve(window.api.clipboard.writeText(term.getSelection()));
      setHasSelection(false);
      term.clearSelection();
      term.focus();
    };

    const pasteClipboard = async () => {
      const clipboardText = await Promise.resolve(window.api.clipboard.readText());
      if (!clipboardText) {
        return;
      }

      term.paste(clipboardText);
      term.focus();
    };

    const moveSuggestionSelection = (direction: 1 | -1) => {
      const availableSuggestions = suggestionsRef.current;
      if (availableSuggestions.length === 0) {
        return;
      }

      setActiveSuggestionIndex((currentIndex) => {
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0) {
          return availableSuggestions.length - 1;
        }

        if (nextIndex >= availableSuggestions.length) {
          return 0;
        }

        return nextIndex;
      });
    };

    const applySuggestion = async (suggestion: TerminalSuggestion | undefined) => {
      if (!suggestion) {
        return;
      }

      const context = deriveAutocompleteContext(inputBufferRef.current);
      if (!context) {
        return;
      }

      const insertText = formatSuggestionInsertText(suggestion, context);
      if (context.rawToken) {
        await window.api.terminal.write(profileId, '\u007f'.repeat(context.rawToken.length));
      }

      await window.api.terminal.write(profileId, insertText);

      setInputBuffer((currentBuffer) => replaceTrailingToken(currentBuffer, context.rawToken, insertText));
      setSuggestions([]);
      setActiveSuggestionIndex(0);
      term.focus();
    };

    const customKeyHandler = (event: KeyboardEvent) => {
      if (event.type !== 'keydown') {
        return true;
      }

      if (isPasteShortcut(event)) {
        event.preventDefault();
        void pasteClipboard();
        return false;
      }

      if (isCopyShortcut(event, term)) {
        if (term.hasSelection()) {
          event.preventDefault();
          void copySelection();
          return false;
        }

        if (isMacPlatform) {
          return false;
        }
      }

      if (suggestionsRef.current.length > 0) {
        if (event.key === 'Tab') {
          event.preventDefault();
          void applySuggestion(
            suggestionsRef.current[activeSuggestionIndexRef.current] ?? suggestionsRef.current[0],
          );
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          moveSuggestionSelection(1);
          return false;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          moveSuggestionSelection(-1);
          return false;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setSuggestions([]);
          setActiveSuggestionIndex(0);
          return false;
        }
      }

      return true;
    };

    const startShell = async () => {
      try {
        setStatus('connecting');
        setStatusMessage('Conectando shell remota');
        await window.api.terminal.start(profileId);

        if (initialPath) {
          await window.api.terminal.write(profileId, `cd "${initialPath}"\n`);
          lastSyncedPath.current = initialPath;
          terminalPathRef.current = initialPath;
          setTerminalPath(initialPath);
        }

        setStatus('ready');
        setStatusMessage('Sesion interactiva lista');
        scheduleFit();
      } catch (error) {
        setStatus('error');
        setStatusMessage(`Error al iniciar terminal: ${String(error)}`);
      }
    };

    void startShell();

    const removeListener = window.api.terminal.onData((data: { profileId: string; data: string }) => {
      if (data.profileId === profileId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    });

    term.attachCustomKeyEventHandler(customKeyHandler);
    term.onSelectionChange(() => {
      setHasSelection(term.hasSelection());
    });

    term.onData((data: string) => {
      setInputBuffer((previousBuffer) => applyTypedData(previousBuffer, data, commitCommand));
      void window.api.terminal.write(profileId, data);
    });

    const handleResize = () => {
      scheduleFit();
    };

    const handlePaste = (event: ClipboardEvent) => {
      const clipboardText = event.clipboardData?.getData('text');
      if (!clipboardText) {
        return;
      }

      event.preventDefault();
      term.paste(clipboardText);
      term.focus();
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });

    resizeObserver.observe(viewportRef.current);
    viewportRef.current.addEventListener('paste', handlePaste);

    const fontSet = document.fonts;
    void fontSet?.ready.then(() => {
      scheduleFit();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      viewportRef.current?.removeEventListener('paste', handlePaste);

      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      term.dispose();
      removeListener();
      fitAddonRef.current = null;
      xtermRef.current = null;
      void window.api.terminal.stop(profileId);
    };
  }, [initialPath, profileId]);

  useEffect(() => {
    if (!isActive || status !== 'ready') {
      return;
    }

    scheduleFitRef.current();
    xtermRef.current?.focus();
  }, [isActive, status]);

  const statusClass = status === 'ready' ? 'badge-success' : status === 'error' ? 'badge-danger' : 'badge-warning';
  const activeSuggestion = suggestions[activeSuggestionIndex];
  const shortcutCopy = isMacPlatform ? 'Cmd+C' : 'Ctrl+C';
  const shortcutPaste = isMacPlatform ? 'Cmd+V' : 'Ctrl+V';

  return (
    <div className="panel-surface-strong flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="section-label">Terminal SSH</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-[var(--text-primary)]">Consola operativa</div>
              <span className={statusClass}>{statusMessage}</span>
              <span className="badge-neutral">{suggestions.length > 0 ? `${suggestions.length} sugerencias` : 'Autocompletado activo'}</span>
            </div>
            <div className="mt-2 body-sm truncate font-mono">{terminalPath || currentPath || initialPath || '~'}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Tab autocompleta</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Rutas del servidor</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{shortcutCopy} copiar</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{shortcutPaste} pegar</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ControlButton icon={<CopyIcon />} label="Copiar" onClick={() => {
              const term = xtermRef.current;
              if (!term || !term.hasSelection()) {
                return;
              }

              void Promise.resolve(window.api.clipboard.writeText(term.getSelection())).then(() => {
                term.clearSelection();
                setHasSelection(false);
                term.focus();
              });
            }} disabled={!hasSelection} />
            <ControlButton icon={<PasteIcon />} label="Pegar" onClick={() => {
              const term = xtermRef.current;
              if (!term) {
                return;
              }

              void Promise.resolve(window.api.clipboard.readText()).then((clipboardText) => {
                if (!clipboardText) {
                  return;
                }

                term.paste(clipboardText);
                term.focus();
              });
            }} />
            <ControlButton icon={<ClearIcon />} label="Limpiar" onClick={() => {
              xtermRef.current?.clear();
              xtermRef.current?.focus();
            }} />
            <ControlButton icon={<ResizeIcon />} label="Ajustar" onClick={() => {
              scheduleFitRef.current();
              xtermRef.current?.focus();
            }} />
            <div className="muted-surface flex items-center gap-2 px-3 py-2">
              <TerminalIcon />
              <span className="body-xs">Responde al cambio de tamano</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.14),transparent_38%),linear-gradient(180deg,rgba(6,13,25,0.94),rgba(3,8,17,0.98))]">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(130,150,182,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(130,150,182,0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {suggestions.length > 0 || isSuggestionLoading ? (
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 flex justify-center">
            <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgba(6,13,25,0.94)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    Ayuda contextual
                  </div>
                  <div className="mt-1 truncate font-mono text-sm text-[var(--text-primary)]">
                    {inputBuffer || 'Escribe un comando para recibir ayuda'}
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                  {isSuggestionLoading ? 'Buscando...' : activeSuggestion ? 'Tab para aplicar' : 'Sin resultados'}
                </div>
              </div>

              {suggestions.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.label}-${index}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        const term = xtermRef.current;
                        if (!term) {
                          return;
                        }

                        const context = deriveAutocompleteContext(inputBufferRef.current);
                        if (!context) {
                          return;
                        }

                        const insertText = formatSuggestionInsertText(suggestion, context);
                        if (context.rawToken) {
                          void window.api.terminal.write(profileId, '\u007f'.repeat(context.rawToken.length));
                        }

                        void window.api.terminal.write(profileId, insertText).then(() => {
                          setInputBuffer((currentBuffer) => replaceTrailingToken(currentBuffer, context.rawToken, insertText));
                          setSuggestions([]);
                          setActiveSuggestionIndex(0);
                          term.focus();
                        });
                      }}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                        index === activeSuggestionIndex
                          ? 'border-[rgba(121,187,255,0.55)] bg-[rgba(121,187,255,0.12)] text-[var(--text-primary)]'
                          : 'border-white/6 bg-white/[0.03] text-[var(--text-secondary)] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-sm">
                          <SuggestionIcon type={suggestion.type} />
                          <span className="truncate">{suggestion.label}</span>
                        </div>
                        {suggestion.detail ? (
                          <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{suggestion.detail}</div>
                        ) : null}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.16em]">
                        {suggestion.type}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={viewportRef} className="relative h-full w-full p-3">
          <div
            className="h-full overflow-hidden rounded-2xl border border-white/10 bg-[rgba(5,12,24,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.35)]"
            onClick={() => xtermRef.current?.focus()}
          >
            <div ref={terminalRef} className="h-full w-full" style={{ minHeight: '320px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
