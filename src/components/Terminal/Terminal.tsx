import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';

interface TerminalProps {
  profileId: string;
  initialPath?: string;
  currentPath?: string;
  isActive?: boolean;
}

export const Terminal: React.FC<TerminalProps> = ({ profileId, initialPath, currentPath, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const initializedRef = useRef(false);
  const lastSyncedPath = useRef<string | undefined>(initialPath);

  // Sync path when active
  useEffect(() => {
    if (isActive && currentPath && currentPath !== lastSyncedPath.current) {
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[36mSyncing path: ${currentPath}\x1b[0m`);
        window.api.terminal.write(profileId, `cd "${currentPath}"\n`);
        lastSyncedPath.current = currentPath;
      }
    }
  }, [isActive, currentPath, profileId]);

  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) return;

    initializedRef.current = true;

    // Create terminal
    const term = new XTerm({
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      cols: 80,
      rows: 24,
    });

    term.open(terminalRef.current);
    term.writeln('\x1b[33mInitializing terminal interface...\x1b[0m');
    
    term.focus();

    xtermRef.current = term;

    // Start shell and handle data
    const startShell = async () => {
      try {
        term.writeln('\x1b[33mConnecting to SSH shell...\x1b[0m');
        await window.api.terminal.start(profileId);
        term.writeln('\x1b[32mShell session established.\x1b[0m');
        
        if (initialPath) {
           term.writeln(`\x1b[36mNavigating to: ${initialPath}\x1b[0m`);
           window.api.terminal.write(profileId, `cd "${initialPath}"\n`);
           lastSyncedPath.current = initialPath;
        }

        // Resize after shell starts
        setTimeout(() => {
          window.api.terminal.resize(profileId, 80, 24);
        }, 500);
      } catch (err) {
        term.writeln(`\r\n\x1b[31mError al iniciar terminal: ${err}\x1b[0m`);
      }
    };

    startShell();

    // Handle data from server
    const removeListener = window.api.terminal.onData((data: { profileId: string; data: string }) => {
      console.log('Terminal received data:', data.data.length, 'chars');
      if (data.profileId === profileId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    });

    // Handle user input
    term.onData((data: string) => {
      window.api.terminal.write(profileId, data);
    });

    // Handle resize
    const handleResize = () => {
      // Resize logic if needed
    };

    window.addEventListener('resize', handleResize);

    // ResizeObserver for container changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      removeListener();
      window.api.terminal.stop(profileId);
    };
  }, [profileId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-ssh-darker">
      <div className="p-2 border-b border-gray-700 text-sm text-gray-400">
        Terminal SSH
      </div>
      <div
        ref={terminalRef}
        className="flex-1 p-2 bg-black"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
};
