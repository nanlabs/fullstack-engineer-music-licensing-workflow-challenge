# Music Licensing Workflow

Backend API para gestionar workflows de licenciamiento de música en películas. El sistema permite organizar películas, escenas, canciones y tracks, además de manejar solicitudes de licencias con un flujo de estados definido.

## Características

- **CRUD completo** para películas, escenas, canciones y tracks
- **Gestión de licencias** con flujo de estados (PENDING → NEGOTIATING → APPROVED/REJECTED)
- **SSE updates** para notificaciones en tiempo real de cambios en licencias
- **Tests unitarios y e2e** con buena cobertura

## Tech Stack

- **Runtime**: Node.js
- **Framework**: NestJS 11
- **Database**: PostgreSQL 16
- **ORM**: TypeORM
- **Testing**: Jest
- **Validation**: class-validator
- **Real-time**: Server-Sent Events (SSE)
- **API Documentation**: Swagger

## Getting Started

### Requisitos

- Docker y Docker Compose
- Node.js 18+ (opcional, si quieres correr localmente sin Docker)

### Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/nanlabs/fullstack-engineer-music-licensing-workflow-challenge.git
cd fullstack-engineer-music-licensing-workflow-challenge
```

2. **Copiar variables de entorno**

```bash
cp .env.example .env
```

3. **Con Docker (recomendado)**

```bash
docker-compose up
```

El backend estará disponible en `http://localhost:3000`

La documentación interactiva de Swagger está disponible en `http://localhost:3000/api`

1. **Sin Docker**

```bash
npm install
npm run build
npm run start:dev
```

Necesitarás una instancia de PostgreSQL corriendo en `localhost:5432`.

## Scripts disponibles

```bash
# Desarrollo con hot reload
npm run start:dev

# Build para producción
npm run build

# Ejecutar en producción
npm run start:prod

# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov

# Linter + Prettier
npm run lint
npm run format
```

## Estructura del Proyecto

```
src/
├── entities/          # Modelos de datos (TypeORM)
├── modules/           # Módulos por dominio
│   ├── movies/        # Películas
│   ├── scenes/        # Escenas
│   ├── songs/         # Canciones
│   ├── tracks/        # Tracks (canción en escena)
│   └── licenses/      # Licencias
├── app.module.ts      # Módulo raíz
└── main.ts            # Entry point
```

Cada módulo sigue la estructura:
```
module/
├── dto/               # Data Transfer Objects
├── module.controller.ts
├── module.service.ts
├── module.repository.ts
└── module.spec.ts     # Tests
```

## API Endpoints

### Películas

- `GET /api/movies` - Listar todas
- `POST /api/movies` - Crear
- `GET /api/movies/:id` - Obtener una
- `PATCH /api/movies/:id` - Actualizar
- `DELETE /api/movies/:id` - Eliminar

### Escenas

- `GET /api/scenes` - Listar todas
- `GET /api/scenes/movie/:movieId` - Listar por película
- `POST /api/scenes` - Crear
- `GET /api/scenes/:id` - Obtener una
- `PATCH /api/scenes/:id` - Actualizar
- `DELETE /api/scenes/:id` - Eliminar

### Canciones

- `GET /api/songs` - Listar todas
- `POST /api/songs` - Crear
- `GET /api/songs/:id` - Obtener una
- `PATCH /api/songs/:id` - Actualizar
- `DELETE /api/songs/:id` - Eliminar

### Tracks

- `GET /api/tracks` - Listar todos
- `GET /api/tracks/scene/:sceneId` - Listar por escena
- `POST /api/tracks` - Crear
- `GET /api/tracks/:id` - Obtener uno
- `PATCH /api/tracks/:id` - Actualizar
- `DELETE /api/tracks/:id` - Eliminar

### Licencias

- `GET /api/licenses` - Listar todas
- `POST /api/licenses` - Crear
- `GET /api/licenses/:id` - Obtener una
- `GET /api/licenses/track/:trackId` - Obtener por track
- `PATCH /api/licenses/:id/status` - Cambiar estado
- `DELETE /api/licenses/:id` - Eliminar
- `SSE /api/licenses/updates/stream` - Stream de actualizaciones en tiempo real

## Testing

### Unit Tests

Tests de servicios usando mocks de repositories:

```bash
npm run test
```

### E2E Tests

Tests de endpoints completos:

```bash
npm run test:e2e
```

### Probar con Swagger

La forma más fácil de probar la API es usando la documentación interactiva de Swagger:

1. Inicia la aplicación: `docker-compose up`
2. Abre tu navegador en: `http://localhost:3000/api`
3. Explora todos los endpoints disponibles
4. Prueba directamente desde la interfaz haciendo click en "Try it out"

### Probar con Postman

En la carpeta `/docs` encontrarás:

- **postman-collection.json** - Colección completa para importar en Postman
- **TESTING.md** - Guía paso a paso para probar la API

Lee [TESTING.md](/docs/TESTING.md) para instrucciones detalladas.

## Decisiones Técnicas y Trade-offs

### ¿Por qué NestJS?

Elegí NestJS principalmente por su estructura opinada y patrón de módulos. El proyecto crece más fácil así porque cada dominio (películas, escenas, licencias) está aislado. Además, los decoradores y los servicios inyectados hacen que los tests sean más simples sin necesidad de reinventar la rueda.

Comparado con Express puro hubiera sido más rápido al inicio pero sin estructura tendríamos spaghetti code. Fastify es buena alternativa pero NestJS tiene mejor ecosistema de testing y documentación.

### ¿Por qué PostgreSQL?

Para este caso, PostgreSQL es la opción obvia. Tenemos relaciones claras entre películas → escenas → tracks → songs → licenses. Un documento en MongoDB no simplificaría nada aquí. Además, TypeORM maneja bien las relaciones.

### ¿Por qué REST y no GraphQL?

Inicialmente pensé en GraphQL para evitar over-fetching, pero acá el flujo es bastante directo: queremos listar, crear, actualizar y cambiar estados. REST es más que suficiente. GraphQL hubiera sido overkill y añadía complejidad sin beneficio real. Si eventualmente necesitamos filtros complejos o queries específicas desde frontend, podemos migrar a GraphQL después.

### Real-time con SSE

Para notificaciones en tiempo real de cambios de licencias elegí Server-Sent Events en lugar de WebSockets. Razones:

- **SSE es más simple**: HTTP estándar, maneja reconexión automática, no necesita cliente especial
- **Casos de uso del proyecto**: Solo notificamos cambios (unidireccional), no hay comunicación bidireccional
- **Menos overhead**: WebSockets es mejor para chat o aplicaciones muy interactivas

Si mañana tenemos miles de usuarios simultáneos podría ser cuello de botella, y ahí se podría migrar a algo como WS. Pero para esta escala está bien.

### Documentación con Swagger/OpenAPI

Se agregó Swagger para proporcionar documentación interactiva de la API. Beneficios:

- **Documentación automática**: Se genera automáticamente desde los decoradores `@ApiTags`, `@ApiOperation`, `@ApiProperty`
- **Interfaz interactiva**: Los desarrolladores pueden probar los endpoints directamente sin Postman
- **Estándar OpenAPI**: Es el estándar de facto para documentación de APIs REST
- **Bajo costo**: NestJS tiene soporte nativo y es fácil de mantener

## Notas y Consideraciones

- El DB está persistido en un volumen Docker para mantener datos entre reiniciadores
- No puede haber dos escenas con el mismo `sceneNumber` en la misma película
- El flujo de estados de licencias es `PENDING → NEGOTIATING → APPROVED/REJECTED`, y está validado en el servicio
- Las actualizaciones en tiempo real se propagan a través de SSE, conectados al endpoint `/api/licenses/updates/stream`
- Redis/Kakfa No se incluyen porque la complejidad no se justifica en este proyecto. Los queries son rápidos sin cache distribuido. Si en el futuro necesitamos escalar, se pueden agregar fácilmente.

## Cómo verificar antes de hacer commit

```bash
# Verificar que todo compila
npm run build

# Correr linter
npm run lint

# Tests unitarios con coverage
npm run test:cov

# Tests e2e
npm run test:e2e
```

## Autor

Joaquín Manero

## Licencia

UNLICENSED
