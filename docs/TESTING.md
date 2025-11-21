# Guía de Testing - API Music Licensing Workflow

Esta guía te ayuda a probar la API usando Postman.

## Instalación de la colección

1. Abre Postman
2. Ve a **File → Import** (o arrastra el archivo)
3. Selecciona `postman-collection.json`
4. Listo! Ya tienes toda la colección lista para usar

## Flujo de pruebas recomendado

Sigue este orden para probar el flujo completo:

### 1. Crear una película

- Ejecuta `POST Create Movie`
- Copia el `id` de la respuesta
- En las variables de Postman, pega el valor en `MOVIE_ID`

### 2. Crear una escena

- Ejecuta `POST Create Scene` (ya usa `{{MOVIE_ID}}`)
- Copia el `id` de la respuesta
- Pega el valor en `SCENE_ID`

### 3. Crear una canción

- Ejecuta `POST Create Song`
- Copia el `id` de la respuesta
- Pega el valor en `SONG_ID`

### 4. Crear un track

- Ejecuta `POST Create Track` (usa `{{SCENE_ID}}` y `{{SONG_ID}}`)
- Copia el `id` de la respuesta
- Pega el valor en `TRACK_ID`

### 5. Crear una licencia

- Ejecuta `POST Create License` (usa `{{TRACK_ID}}`)
- Copia el `id` de la respuesta
- Pega el valor en `LICENSE_ID`

### 6. Cambiar estados de licencia

Ejecuta en orden:

- `PATCH Update License Status - NEGOTIATING`
- `PATCH Update License Status - APPROVED` (o `REJECTED`)

### 7. Escuchar actualizaciones en tiempo real

- Abre una pestaña nueva
- Ejecuta `GET Listen to License Updates` (SSE)
- En otra pestaña, cambia el estado de una licencia
- Verás los cambios en tiempo real en la pestaña SSE

## Cómo establecer variables en Postman

1. Click en la colección "Music Licensing Workflow API"
2. Tab **Variables**
3. En la columna `Current value`, pega los IDs que generes

## Ejemplos con curl

Si prefieres usar curl en lugar de Postman:

```bash
# Crear película
curl -X POST http://localhost:3000/api/movies \
  -H "Content-Type: application/json" \
  -d '{"title":"Inception","description":"A mind-bending thriller","releaseYear":2010}'

# Crear escena (usa el MOVIE_ID de arriba)
curl -X POST http://localhost:3000/api/scenes \
  -H "Content-Type: application/json" \
  -d '{"name":"Dream Within Dream","description":"Key action scene","sceneNumber":5,"movieId":"YOUR_MOVIE_ID"}'

# Crear canción
curl -X POST http://localhost:3000/api/songs \
  -H "Content-Type: application/json" \
  -d '{"title":"Time","artist":"Hans Zimmer","durationSeconds":540}'

# Crear track (usa SCENE_ID y SONG_ID)
curl -X POST http://localhost:3000/api/tracks \
  -H "Content-Type: application/json" \
  -d '{"name":"Background - Theme Music","sceneId":"YOUR_SCENE_ID","songId":"YOUR_SONG_ID","startTimeSeconds":0,"endTimeSeconds":180}'

# Crear licencia (usa TRACK_ID)
curl -X POST http://localhost:3000/api/licenses \
  -H "Content-Type: application/json" \
  -d '{"trackId":"YOUR_TRACK_ID"}'

# Cambiar estado a NEGOTIATING (usa LICENSE_ID)
curl -X PATCH http://localhost:3000/api/licenses/YOUR_LICENSE_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status":"NEGOTIATING","notes":"Contacted Hans Zimmer representatives"}'

# Cambiar estado a APPROVED
curl -X PATCH http://localhost:3000/api/licenses/YOUR_LICENSE_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","notes":"License agreement signed"}'

# Escuchar actualizaciones SSE
curl http://localhost:3000/api/licenses/updates/stream
```

## Validaciones importantes

La API valida ciertos casos:

- **Escenas únicas por película**: No puedes tener dos escenas con el mismo `sceneNumber` en una película
- **Flujo de estados**: `PENDING` → `NEGOTIATING` → `APPROVED/REJECTED`. No puedes saltar estados
- **Campos requeridos**: Todos los campos indicados son obligatorios

## Solucionar problemas

### "Connection refused"

Asegúrate de que el backend está corriendo:

```bash
docker-compose up
# o
npm run start:dev
```

### "Invalid UUID"

Los IDs son UUIDs. Asegúrate de copiar completo el `id` de la respuesta.

### "Cannot transition from PENDING to APPROVED"

El flujo es lineal: primero debe ir a `NEGOTIATING`, luego a `APPROVED/REJECTED`.

## Más información

- Ver `README.md` para instrucciones de setup
- Ver `POSTMAN_EXAMPLES.md` para ejemplos en texto plano
- Revisar los endpoints en `README.md` → sección "API Endpoints"
