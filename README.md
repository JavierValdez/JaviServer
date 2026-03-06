# JaviServer

Aplicación de escritorio para gestionar conexiones SSH a servidores, explorar archivos mediante SFTP y analizar logs en tiempo real.

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
cd javiserver

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build
```

## 🔄 Actualizaciones automáticas

- La app ahora busca actualizaciones automáticamente al iniciar.
- Si encuentra una nueva versión publicada en GitHub Releases, la descarga en segundo plano.
- Cuando la descarga termina, muestra un diálogo para reiniciar e instalar.
- En modo empaquetado, vuelve a revisar actualizaciones cada 6 horas.

Importante:

- Windows auto-update funciona con el instalador `NSIS`.
- En macOS, el auto-update requiere que la app esté firmada. Si compilas sin certificados, el `.dmg` se genera, pero la actualización automática no quedará operativa.

## 🚀 Releases en GitHub

El repositorio incluye un workflow en [`.github/workflows/release.yml`](/Users/javier/Documents/GitHub/JaviServer/.github/workflows/release.yml) que publica instaladores para Windows y macOS en GitHub Releases.

Flujo recomendado:

1. Actualiza la versión en [`package.json`](/Users/javier/Documents/GitHub/JaviServer/package.json).
2. Haz commit de los cambios.
3. Crea y publica un tag con el mismo número de versión, por ejemplo `v1.0.1`.
4. GitHub Actions construirá y subirá:
   - `JaviServer-Mac-x.y.z-Installer.dmg`
   - `JaviServer-Mac-x.y.z-Installer.zip`
   - `JaviServer-Windows-x.y.z-Setup.exe`
   - archivos `latest*.yml` y `*.blockmap` para el updater

Comandos:

```bash
git add .
git commit -m "release: 1.0.1"
git tag v1.0.1
git push origin main --tags
```

## 🔐 Secrets recomendados para CI

Para publicar releases desde GitHub Actions no necesitas más que `GITHUB_TOKEN`, que GitHub ya inyecta en el workflow.

Para que macOS quede firmado y el auto-update funcione correctamente, configura además estos secrets:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## 📦 Estructura del Proyecto

```
javiserver/
├── electron/
│   ├── main.ts              # Proceso principal de Electron
│   ├── preload.ts           # API expuesta al renderer
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
- Los perfiles se guardan en `%APPDATA%/javiserver/server-profiles.json`
- Compatible con servidores que usan algoritmos MAC: hmac-sha2-256, hmac-sha2-512, hmac-sha1
- Los releases publicados en GitHub son la fuente del sistema de auto-actualización

## 🔐 Seguridad

- Las credenciales se guardan localmente en tu máquina
- No se transmiten datos a servicios externos
- Diseñada para uso personal/local
