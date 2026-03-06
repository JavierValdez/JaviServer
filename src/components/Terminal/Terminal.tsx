import React, { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';

interface TerminalProps {
  profileId: string;
  initialPath?: string;
  currentPath?: string;
  isActive?: boolean;
}

const TerminalIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export const Terminal: React.FC<TerminalProps> = ({ profileId, initialPath, currentPath, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const lastSyncedPath = useRef<string | undefined>(initialPath);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [statusMessage, setStatusMessage] = useState('Preparando terminal SSH');

  useEffect(() => {
    if (isActive && currentPath && currentPath !== lastSyncedPath.current && xtermRef.current) {
      window.api.terminal.write(profileId, `cd "${currentPath}"\n`);
      lastSyncedPath.current = currentPath;
    }
  }, [currentPath, isActive, profileId]);

  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const fitAddon = new FitAddon();
    const term = new XTerm({
      theme: {
        background: '#050c18',
        foreground: '#edf3fb',
        cursor: '#79bbff',
        cursorAccent: '#09111f',
        selectionBackground: '#1d3c60',
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
      lineHeight: 1.3,
      fontFamily: '"SF Mono", "IBM Plex Mono", Consolas, monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      cols: 80,
      rows: 24,
    });

    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    xtermRef.current = term;

    const syncSize = () => {
      if (!xtermRef.current || !fitAddonRef.current) {
        return;
      }

      fitAddonRef.current.fit();
      window.api.terminal.resize(profileId, xtermRef.current.cols, xtermRef.current.rows);
    };

    const startShell = async () => {
      try {
        setStatus('connecting');
        setStatusMessage('Conectando shell remota');
        await window.api.terminal.start(profileId);

        if (initialPath) {
          window.api.terminal.write(profileId, `cd "${initialPath}"\n`);
          lastSyncedPath.current = initialPath;
        }

        setStatus('ready');
        setStatusMessage('Sesion interactiva lista');

        window.requestAnimationFrame(() => {
          syncSize();
        });
      } catch (err) {
        setStatus('error');
        setStatusMessage(`Error al iniciar terminal: ${String(err)}`);
      }
    };

    void startShell();

    const removeListener = window.api.terminal.onData((data: { profileId: string; data: string }) => {
      if (data.profileId === profileId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    });

    term.onData((data: string) => {
      window.api.terminal.write(profileId, data);
    });

    const handleResize = () => {
      syncSize();
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      syncSize();
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      removeListener();
      fitAddonRef.current = null;
      xtermRef.current = null;
      window.api.terminal.stop(profileId);
    };
  }, [initialPath, profileId]);

  const statusClass = status === 'ready' ? 'badge-success' : status === 'error' ? 'badge-danger' : 'badge-warning';

  return (
    <div className="panel-surface-strong flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="section-label">Terminal SSH</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="text-lg font-semibold text-[var(--text-primary)]">Sesion interactiva</div>
              <span className={statusClass}>{statusMessage}</span>
            </div>
            <div className="mt-2 body-sm truncate font-mono">{currentPath || initialPath || '~'}</div>
          </div>

          <div className="muted-surface flex items-center gap-2 px-3 py-2">
            <TerminalIcon />
            <span className="body-xs">Ajuste automatico activo</span>
          </div>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 bg-[var(--surface-contrast)]"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
};
