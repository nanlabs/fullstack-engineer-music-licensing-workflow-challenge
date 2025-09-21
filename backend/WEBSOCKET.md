# 🔌 WebSocket Implementation - Music Licensing System

## Overview

El sistema de licencias musicales incluye WebSocket para actualizaciones en tiempo real usando Socket.IO.

## ✅ Configuración Completada

### 1. Gateway de WebSocket
- **Archivo**: `src/common/gateways/license-update.gateway.ts`
- **Puerto**: Mismo que el servidor HTTP (3001 por defecto)
- **CORS**: Configurado para permitir conexiones desde el frontend

### 2. Eventos Disponibles

#### `licenseStatusUpdate`
Se emite cuando cambia el estado de una licencia:
```javascript
{
  trackId: number,
  sceneId: number,
  movieId: number,
  newStatus: LicenseStatus,
  updatedBy?: string
}
```

#### `trackCreated`
Se emite cuando se crea un nuevo track:
```javascript
{
  track: Track,
  sceneId: string,
  movieId: string
}
```

#### `movieStatisticsUpdate`
Se emite cuando se actualizan las estadísticas de una película:
```javascript
{
  movieId: string,
  statistics: any
}
```

### 3. Funcionalidades de Rooms
- **Unirse a una sala de película**: `joinMovieRoom(client, movieId)`
- **Salir de una sala**: `leaveMovieRoom(client, movieId)`
- **Emitir a sala específica**: `emitToMovieRoom(movieId, event, data)`

## 🧪 Como Probar

### Opción 1: Cliente HTML (Navegador)
```bash
# Abrir en el navegador
open test-websocket.html
```

### Opción 2: Cliente Node.js
```bash
# Terminal 1: Iniciar servidor
npm run start:dev

# Terminal 2: Conectar cliente WebSocket
node test-websocket-client.js

# Terminal 3: Ejecutar pruebas de API
node test-api-websocket.js
```

### Opción 3: Cliente JavaScript básico
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Conectado!');
});

socket.on('licenseStatusUpdate', (data) => {
  console.log('Estado actualizado:', data);
});

socket.on('trackCreated', (data) => {
  console.log('Track creado:', data);
});
```

## 🛠️ Integración en Servicios

### LicensesService
El servicio de licencias ya emite eventos cuando:
- Se actualiza el estado de una licencia (`updateTrackLicenseStatus`)

### TracksService
El servicio de tracks emite eventos cuando:
- Se crea un nuevo track (`create`)

### Uso en otros servicios
```typescript
// Inyectar el gateway
constructor(
  @Inject(LicenseUpdateGateway)
  private readonly licenseUpdateGateway: LicenseUpdateGateway,
) {}

// Emitir eventos
this.licenseUpdateGateway.emitLicenseStatusUpdate({
  trackId: 1,
  sceneId: 1,
  movieId: 1,
  newStatus: licenseStatus,
});
```

## 🌐 Frontend Integration

### React/Vue/Angular
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Escuchar eventos
socket.on('licenseStatusUpdate', (data) => {
  // Actualizar UI
  updateLicenseStatus(data);
});

socket.on('trackCreated', (data) => {
  // Actualizar lista de tracks
  addTrackToList(data.track);
});
```

### Connection Management
```javascript
// Conectar
const socket = io('http://localhost:3001', {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Manejar eventos de conexión
socket.on('connect', () => {
  console.log('Conectado al WebSocket');
});

socket.on('disconnect', () => {
  console.log('Desconectado del WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('Error de conexión:', error);
});
```

## 🔧 Configuración

### Servidor
- **Puerto**: 3001 (configurable via `PORT` env var)
- **CORS**: Configurado para desarrollo (`*`)
- **Transporte**: WebSocket + polling fallback

### Cliente
- **URL**: `http://localhost:3001`
- **Opciones recomendadas**:
  ```javascript
  {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  }
  ```

## 📝 Notas de Desarrollo

1. **Logging**: Todos los eventos están loggeados en el servidor
2. **Error Handling**: Los errores en WebSocket no interrumpen el flujo principal
3. **Performance**: Los eventos se emiten de forma asíncrona sin bloquear
4. **Escalabilidad**: Preparado para usar Redis adapter si es necesario

## 🚀 Próximos Pasos

1. **Authentication**: Agregar autenticación a las conexiones WebSocket
2. **Room Management**: Implementar UI para gestión de rooms
3. **Reconnection**: Mejorar la lógica de reconexión automática
4. **Rate Limiting**: Implementar límites de eventos por cliente

## 🐛 Debugging

### Verificar conexión
```bash
# Logs del servidor
npm run start:dev

# Buscar logs de WebSocket
# ✅ "WebSocket Gateway initialized"
# ✅ "Client connected: [socket-id]"
```

### Problemas comunes
1. **CORS Error**: Verificar configuración en `main.ts`
2. **Puerto ocupado**: Cambiar `PORT` en `.env`
3. **No eventos**: Verificar que los servicios estén inyectando el gateway
