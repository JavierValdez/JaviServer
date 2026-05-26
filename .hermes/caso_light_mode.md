# Caso: Rediseno Light Mode - JaviServer

## Contexto
JaviServer es una app Electron + React + TypeScript + Tailwind para gestionar conexiones SSH, SFTP y streaming de logs. Actualmente solo tiene modo oscuro. Se necesita agregar un modo claro profesional, colorido y hermoso, con toggle para cambiar entre ambos.

## Arquitectura actual del tema

### Sistema de variables CSS (~30 vars en index.css :root)
```css
:root {
  color-scheme: dark;
  --surface-app: #09111f;
  --surface-sidebar: rgba(11, 19, 34, 0.9);
  --surface-panel: rgba(14, 24, 40, 0.88);
  --surface-panel-strong: rgba(17, 28, 46, 0.96);
  --surface-panel-muted: rgba(42, 56, 84, 0.58);
  --surface-elevated: rgba(18, 29, 49, 0.98);
  --surface-contrast: rgba(5, 12, 24, 0.96);
  --border-subtle: rgba(132, 153, 188, 0.18);
  --border-strong: rgba(132, 153, 188, 0.3);
  --text-primary: #edf3fb;
  --text-secondary: #a7b7ce;
  --text-muted: #7284a0;
  --accent: #79bbff;
  --accent-strong: #b9dbff;
  --accent-soft: rgba(121, 187, 255, 0.18);
  --success: #68d8aa;
  --success-soft: rgba(104, 216, 170, 0.18);
  --warning: #f4c971;
  --warning-soft: rgba(244, 201, 113, 0.18);
  --danger: #ff95a7;
  --danger-soft: rgba(255, 149, 167, 0.18);
  --focus-ring: rgba(121, 187, 255, 0.36);
  --shadow-panel: 0 18px 60px rgba(2, 7, 18, 0.42);
  --shadow-soft: 0 10px 30px rgba(2, 7, 18, 0.24);
}
```

### Estructura de archivos
- index.css: 608 lineas, define `:root` vars + ~70 clases de componentes (@layer components)
- App.tsx: 428 lineas, usa clases como text-[var(--text-primary)], inline styles
- tailwind.config.cjs: solo 6 colores custom (ssh-dark, ssh-accent, etc.) - casi no se usan
- 10 archivos TSX con componentes (ServerList, ServerForm, FileExplorer, LogViewer, Terminal, UpdateStatus, AgentIntegrationDialog, Modal)

### Como se usan los colores
1. CSS variables via `var(--nombre)` en:
   - Clases de componentes (`.btn-primary`, `.panel-surface`, `.input`, etc.)
   - Utility classes de Tailwind: `text-[var(--text-primary)]`, `bg-[var(--surface-panel)]`, `border-[var(--border-subtle)]`
   - Inline styles: `style={{ color: 'var(--accent)' }}`
2. Colores hardcodeados en clases (NO usan variables):
   - `.btn-primary`: `color: #08111f` (texto oscuro sobre gradiente azul)
   - `.badge-success`: `color: #b8ffe0`
   - `.badge-warning`: `color: #ffe7b4`  
   - `.badge-danger`: `color: #ffd9df`
   - `.notice-danger`: `color: #ffd9df; background: rgba(255,149,167,0.12)`
   - `.notice-success`: `color: #b8ffe0; background: rgba(104,216,170,0.12)`
   - Muchos fondos hardcodeados: `rgba(8,15,28,0.66)`, `rgba(22,32,49,0.74)`, etc.
3. Gradientes hardcodeados en body, .app-shell, .workbench-header, .modal-card
4. Sombras y scrollbars hardcodeadas

### Componentes por archivo
- ServerList.tsx: Sidebar con lista de perfiles, badges, botones de accion
- ServerForm.tsx: Modal con formulario, inputs, segmented control
- FileExplorer.tsx: Tabla de archivos con iconos, breadcrumbs, busqueda
- LogViewer.tsx: Visor de logs con filtros rapidos, busqueda, streaming
- Terminal.tsx: Terminal xterm.js
- UpdateStatus.tsx: Badge de actualizacion
- AgentIntegrationDialog.tsx: Dialogo de integracion MCP
- Modal.tsx: Componente modal reutilizable

### Tailwind config
```js
colors: {
  'ssh-dark': '#1a1b26',
  'ssh-darker': '#13141c', 
  'ssh-light': '#24283b',
  'ssh-accent': '#7aa2f7',
  'ssh-success': '#9ece6a',
  'ssh-warning': '#e0af68',
  'ssh-error': '#f7768e',
}
```

### Estado (Zustand)
No tiene estado de tema actualmente. Habra que agregarlo o usar un Context separado.

## Requerimientos del Light Mode

1. Toggle visible en la UI para cambiar dark/light
2. Light mode debe ser profesional, colorido y hermoso - paleta fresca y moderna
3. TODOS los componentes deben adaptarse correctamente
4. Mantener la misma estructura visual (paneles, bordes, sombras, glassmorphism)
5. El tema debe persistir entre sesiones (localStorage)
6. Respetar `prefers-color-scheme` del sistema como default
7. Los colores de sintaxis del LogViewer deben verse bien en ambos temas
8. xterm.js debe adaptar su tema

## Enfoque propuesto
1. Mover `:root` → `[data-theme="dark"]`
2. Crear `[data-theme="light"]` con nueva paleta
3. Reemplazar colores hardcodeados por referencias a variables CSS
4. Agregar ThemeProvider con React Context
5. Boton toggle en la UI
6. Persistencia en localStorage
7. Adaptar xterm.js

## Preguntas para kiro
1. Analiza TODOS los archivos y encuentra cada color hardcodeado que deba migrarse a variable CSS
2. Propone una paleta de light mode profesional y moderna - con nombres de variables si hacen falta nuevas
3. Identifica clases CSS que necesitan adaptacion adicional para light mode (sombras, gradientes, glass effects)
4. Sugiere la ubicacion del toggle en la UI
5. Revisa si hay problemas de contraste o legibilidad previsibles
