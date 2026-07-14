# ArtiShell

Cliente SSH visual para gestionar servidores, explorar archivos mediante SFTP, analizar logs en tiempo real e integrarse con agentes de IA mediante MCP.

## 🚀 Características

- **Gestión de Perfiles**: Guarda múltiples servidores con sus credenciales y rutas favoritas
- **Explorador de Archivos**: Navega por el sistema de archivos del servidor vía SFTP
- **Visor de Logs en Tiempo Real**: Monitorea logs con `tail -f` y búsqueda con `grep`
- **Terminal SSH**: Consola completa para comandos
- **Marcadores**: Guarda rutas frecuentes para acceso rápido
- **Patrones de Logs**: Búsqueda de patrones predefinidos (ERROR, WARN, Exception, etc.)

## 📋 Requisitos

- Node.js 18 o superior
- npm o yarn

## 🛠️ Instalación

```bash
# Clonar o acceder al directorio
cd <ruta-del-repositorio>

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## 🔄 Actualizaciones automáticas

- La app busca actualizaciones automáticamente al iniciar, usando GitHub Releases como fuente principal.
- Si GitHub devuelve un error o una respuesta inválida, reintenta automáticamente contra Cloud Storage.
- Si encuentra una nueva versión publicada, permite descargar el instalador desde la fuente seleccionada.
- Cuando la descarga termina, muestra un diálogo para reiniciar e instalar.
- En modo empaquetado, vuelve a revisar actualizaciones cada 6 horas.

Importante:

- Windows auto-update funciona con el instalador `NSIS`.
- En macOS, el auto-update requiere que la app esté firmada. Si compilas sin certificados, el `.dmg` se genera, pero la actualización automática no quedará operativa.

## Integración IA por MCP

ArtiShell incluye una integración MCP local opcional para que agentes de IA puedan consultar y operar los perfiles SSH ya guardados en la app, sin exponer credenciales.

1. Abre **Integración IA** desde el pie de la barra lateral.
2. Activa la integración.
3. Copia la configuración MCP generada en tu cliente compatible.
4. Mantén ArtiShell disponible; si el cliente inicia el MCP con la app cerrada, ArtiShell intentará abrirse automáticamente.

La integración expone operaciones para listar servidores, conectar/desconectar perfiles, listar directorios, leer archivos con límite de bytes, buscar contenido, revisar logs y ejecutar comandos SSH no interactivos. Los comandos claramente de lectura se ejecutan directo; los comandos desconocidos o potencialmente mutables requieren confirmación visible en la app.

Variables usadas por el modo MCP:

- `ARTISHELL_MCP_TOKEN`
- `ARTISHELL_MCP_DEBUG`
- `ARTISHELL_MCP_CLIENT_ID`
- `ARTISHELL_MCP_CLIENT_NAME`
- `ARTISHELL_MCP_CLIENT_VERSION`

Durante la transición también se aceptan las variables equivalentes con prefijo `JAVISERVER_` para no romper configuraciones MCP existentes.

## Migración desde JaviServer

En la primera apertura, ArtiShell detecta automáticamente una instalación anterior de JaviServer y muestra un aviso antes de importar datos. La migración incluye perfiles y credenciales SSH, bookmarks, patrones de logs, preferencias, configuración/token MCP e historial local de actividad. La app se reinicia una vez, deja intactos los datos originales y crea un respaldo si ArtiShell ya contenía datos.

## 🚀 Releases automáticos

El repositorio incluye un workflow en [`.github/workflows/release.yml`](/Users/javier/Documents/GitHub/JaviServer/.github/workflows/release.yml) que construye instaladores para Windows y macOS al publicar un tag `v*`. Cada release se publica primero en GitHub Releases y también se replica en Cloud Storage como respaldo:

- `https://github.com/JavierValdez/JaviServer/releases`
- `gs://artictools-releases/javiserver/releases/`
- `https://storage.googleapis.com/artictools-releases/javiserver/releases/`

Los archivos `latest.yml` y `latest-mac.yml` se adjuntan al GitHub Release y quedan también en la raíz del respaldo de Cloud Storage. En GCS, los instaladores y blockmaps se guardan por versión, por ejemplo `v2.2.3/`. El workflow conserva las 5 versiones más recientes en Cloud Storage y elimina carpetas de versiones anteriores.

Flujo recomendado:

1. Actualiza la versión en [`package.json`](/Users/javier/Documents/GitHub/JaviServer/package.json).
2. Haz commit de los cambios.
3. Crea y publica un tag con el mismo número de versión, por ejemplo `v1.0.1`.
4. GitHub Actions construirá y publicará:
   - `ArtiShell-Mac-x.y.z-Installer.dmg`
   - `ArtiShell-Mac-x.y.z-Installer.zip`
   - `ArtiShell-Windows-x.y.z-Setup.exe`
   - archivos `latest*.yml` y `*.blockmap` para el updater

Comandos:

```bash
git add .
git commit -m "release: 1.0.1"
git tag v1.0.1
git push origin main --tags
```

## 🔐 Secrets recomendados para CI

Para publicar releases en Cloud Storage, configura este secret del repositorio:

- `GCP_RELEASES_SERVICE_ACCOUNT_KEY`

Para que macOS quede firmado y el auto-update funcione correctamente, configura además estos secrets:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## 📦 Estructura del Proyecto

```
ArtiShell/
├── electron/
│   ├── main.ts              # Proceso principal de Electron
│   ├── preload.ts           # API expuesta al renderer
│   ├── agent/               # Broker local, MCP stdio, token y auditoría
│   ├── services/
│   │   ├── SSHService.ts    # Conexiones SSH/SFTP
│   │   └── ProfileManager.ts # Gestión de perfiles
│   └── ipc/
│       └── handlers.ts      # Handlers IPC
├── src/
│   ├── App.tsx              # Componente principal
│   ├── components/
│   │   ├── ServerList/      # Lista de servidores
│   │   ├── ServerForm/      # Formulario de servidor
│   │   ├── FileExplorer/    # Explorador SFTP
│   │   ├── LogViewer/       # Visor de logs
│   │   └── Terminal/        # Terminal SSH
│   ├── store/
│   │   └── useAppStore.ts   # Estado global (Zustand)
│   └── types/
│       └── index.ts         # Tipos TypeScript
└── package.json
```

## 🎯 Uso

1. **Agregar Servidor**: Haz clic en "+" para añadir un nuevo servidor
2. **Conectar**: Selecciona un servidor y pulsa "Conectar"
3. **Explorar**: Usa las pestañas para navegar archivos, ver logs o usar la terminal
4. **Guardar Rutas**: Usa el botón de marcador para guardar rutas frecuentes

## ⚙️ Tecnologías

- **Electron** + **Vite** - Framework de escritorio
- **React 18** + **TypeScript** - Frontend
- **Tailwind CSS** - Estilos
- **Zustand** - Estado global
- **ssh2** - Conexiones SSH/SFTP
- **xterm.js** - Emulador de terminal

## 📝 Notas

- La aplicación está diseñada para acceso de solo lectura
- Los perfiles se guardan en `%APPDATA%/ArtiShell/server-profiles.json`
- Compatible con servidores que usan algoritmos MAC: hmac-sha2-256, hmac-sha2-512, hmac-sha1
- GitHub Releases es la fuente principal del sistema de auto-actualización; Cloud Storage se usa solamente como fallback

## 🔐 Seguridad

- Las credenciales se guardan localmente en tu máquina
- No se transmiten datos a servicios externos
- Diseñada para uso personal/local
