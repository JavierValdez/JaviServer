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

## 🔐 Seguridad

- Las credenciales se guardan localmente en tu máquina
- No se transmiten datos a servicios externos
- Diseñada para uso personal/local
