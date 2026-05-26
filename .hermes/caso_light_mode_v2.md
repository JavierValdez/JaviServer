# Caso - Iteracion 2: Auditoria del Light Mode

## Estado actual
Se implemento el sistema de tema dual para JaviServer. Los cambios principales:

### Archivos modificados
1. **src/store/ThemeContext.tsx** (nuevo): React Context con persistencia localStorage, deteccion prefers-color-scheme, y toggle
2. **src/index.css** (refactorizado): 
   - `:root` → `[data-theme="dark"]` con todas las variables
   - Nuevo `[data-theme="light"]` con paleta profesional azul/gris
   - Todas las clases de componentes migradas a usar CSS variables
   - Nuevas clases: `.terminal-bg`, `.terminal-grid`, `.theme-toggle`
   - ~30 variables nuevas para cubrir todos los casos hardcodeados
3. **src/App.tsx**: Integrado ThemeContext, boton toggle sol/luna en el header
4. **src/main.tsx**: Envuelto App con ThemeProvider
5. **src/components/Terminal/Terminal.tsx**: 
   - Temas xterm dinamicos (dark/light) con MutationObserver
   - Reemplazado ~10 clases `border-white/* bg-white/*` con CSS variables
   - Gradiente de fondo y grid responsive al tema
6. **src/components/LogViewer/LogViewer.tsx**:
   - Patrones de highlight ahora usan CSS variables (var(--danger), etc.)
   - QuickFilters usan CSS variables para colores
   - Reemplazados hardcodeados rgba con variables
7. **src/components/ServerList/ServerList.tsx**: Hardcodeados rgba reemplazados
8. **src/components/FileExplorer/FileExplorer.tsx**: Todos los hardcodeados reemplazados
9. **tailwind.config.cjs**: Agregados colores light theme, darkMode selector

### Variables nuevas introducidas
--accent-surface, --accent-border, --success-strong, --warning-strong, --danger-strong, --shadow-button, --btn-secondary-bg, --btn-secondary-hover, --btn-icon-bg, --btn-icon-hover, --btn-ghost-hover, --btn-chip-bg, --input-bg, --segmented-bg, --segmented-active, --tab-strip-bg, --tab-item-bg/hover/active, --table-head-bg, --table-row-hover/selected, --modal-backdrop, --modal-card-top, --modal-border-top, --agent-*, --scrollbar-*, --body-gradient, --app-shell-gradient, --workbench-header-bg, --modal-card-bg, --xterm-*

## Tarea para kiro
Lee TODOS los archivos modificados y audita:
1. Hay colores hardcodeados que se me escaparon?
2. El contraste en light mode es adecuado (WCAG AA)?
3. Las variables de light mode tienen sentido semantico?
4. Hay alguna clase CSS que no use variables y se vea mal en light mode?
5. El toggle del tema funciona correctamente? (ThemeContext, persistencia, sistema)
6. El terminal xterm se actualiza correctamente con MutationObserver?
7. Los colores de log (quickFilters, patterns) son legibles en light mode?
8. Las sombras y gradientes son apropiados para light mode?
9. Hay algun componente que no responda al tema?
10. Sugerencias de mejora estetica para light mode?

Responde en espanol. NO uses write_file. Se especifico.
