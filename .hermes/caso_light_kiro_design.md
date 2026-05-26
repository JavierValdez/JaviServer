# Caso: Kiro disena la paleta Light Mode de JaviServer

## Contexto
JaviServer es una app Electron + React para gestion SSH, SFTP, y logs. Tiene modo oscuro funcional. Se necesita un modo claro PROFESIONAL, BONITO, MODERNO y COLORIDO.

## Lo que hay ahora (dark mode - funciona bien)
Variables en [data-theme='dark']:
--surface-app: #09111f
--surface-sidebar: rgba(11,19,34,0.9)
--surface-panel: rgba(14,24,40,0.88)
--surface-panel-strong: rgba(17,28,46,0.96)
--text-primary: #edf3fb
--text-secondary: #a7b7ce
--text-muted: #7284a0
--accent: #79bbff
--success: #68d8aa
--warning: #f4c971
--danger: #ff95a7

El dark mode es solido. El light mode actual es generico y feo (azul/gris aburrido).

## Lo que necesito
Un light mode que sea HERMOSO. Piensa en:
- Linear.app - limpio, minimal, acentos vibrantes
- Vercel.com - elegante, geometrico, gradientes sutiles
- Stripe.com - profesional, colorido, gradientes audaces
- Raycast - moderno, blur effects, tipografia nitida

NO quiero:
- Gris generico de Bootstrap
- Azul corporativo aburrido
- Blanco puro everywhere

SI quiero:
- Una paleta con personalidad - algun color dominante interesante (purpura? teal? coral?)
- Gradientes hermosos en el fondo
- Glassmorphism que se vea bien (no lechoso)
- Sombras con color, no solo negro
- Que los componentes "pop" - tengan vida
- Los badges y acentos deben ser vibrantes
- La sidebar debe tener caracter
- El terminal debe verse integrado, no un rectangulo generico

## Estructura del CSS
El archivo index.css tiene ~70 clases de componentes que usan variables CSS. Las variables que DEBES definir para el light theme son exactamente las mismas que estan en dark. Lee el archivo src/index.css para ver la lista completa.

## Componentes principales
- Sidebar (ServerList) - lista de servidores SSH
- Workbench header - toolbar con botones
- FileExplorer - tabla de archivos SFTP
- LogViewer - streaming de logs con colores de sintaxis
- Terminal - xterm.js embebido
- Modales y formularios
- Badges, botones, inputs, tabs

## Instrucciones
1. Lee src/index.css completo. Estudia el dark theme.
2. Disena un light theme COMPLETO. Cada variable CSS.
3. Los colores de log (danger/warning/accent/info) deben ser legibles en light.
4. PIENSA como disenador, no como ingeniero.
5. Escribe el CSS completo para [data-theme='light'] con tus colores elegidos a mano.

Se audaz. Hazlo hermoso.
