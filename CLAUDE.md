# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (Electron + React)
npm run build     # TypeScript check + Vite build + Electron packaging
npm run lint      # ESLint with TypeScript (zero warnings allowed)
npm run preview   # Preview production build
```

## Architecture

**JaviServer** is an Electron desktop app for managing SSH connections, browsing remote files via SFTP, and streaming logs in real-time.

### Stack
- **Electron + Vite** (`vite-plugin-electron`) for desktop packaging
- **React 18 + TypeScript** (strict mode, no unused locals/params)
- **Zustand** for global state
- **Tailwind CSS** with a custom SSH-themed palette (`ssh-dark`, `ssh-accent`, etc.)
- **ssh2** for SSH/SFTP connections, **xterm.js** for the terminal emulator
- **electron-store** for persisting server profiles

### Process Architecture
The app uses standard Electron IPC:
- **Renderer process:** React UI in `src/` communicates via `window.api.*` calls
- **Main process:** `electron/main.ts` handles SSH/SFTP operations and forwards data back to renderer
- **Preload:** `electron/preload.ts` bridges the two processes
- `ssh2` and `electron-store` are externalized from the Vite bundle (run only in main process)

### UI Structure
- `src/App.tsx` — Root layout: left sidebar (ServerList) + tab-based content area
- `src/store/useAppStore.ts` — Zustand store: profiles, connections, tabs, file state
- `src/types/index.ts` — All shared TypeScript interfaces (`ServerProfile`, `Tab`, `FileInfo`, etc.)

### Components (each in its own subdirectory under `src/components/`)
| Component | Role |
|---|---|
| `ServerList` | Sidebar with connect/disconnect, right-click context menu |
| `ServerForm` | Modal for creating/editing server profiles (password or SSH keyfile auth) |
| `FileExplorer` | SFTP file browser — navigation, bookmarks, search, log file detection |
| `LogViewer` | Real-time `tail -f` streaming, grep search, pattern highlighting, date filtering |
| `Terminal` | xterm.js SSH terminal with auto-resize and path sync |

### Data Flow
```
React Components → Zustand Store → IPC (window.api.*) → Electron Main → SSH/SFTP Server
```

### Key Design Decisions
- **Read-only by design:** The app only reads remote files; no write operations over SFTP
- **Tab system:** Multiple tabs per server (explorer, logs, terminal), managed in Zustand
- **Bookmarks and log patterns** are stored per `ServerProfile` in `electron-store`
