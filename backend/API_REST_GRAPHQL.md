# API REST + GraphQL - Music Licensing Workflow

Este proyecto ahora soporta tanto **REST API** como **GraphQL API** para acceder a todos los recursos del sistema de licenciamiento musical.

## 🚀 Cómo Ejecutar

```bash
npm run start:dev
```

Una vez ejecutado, tendrás acceso a:

- **REST API**: `http://localhost:3000`
- **GraphQL Playground**: `http://localhost:3000/graphql`
- **Swagger Documentation**: `http://localhost:3000/api`

## 📋 REST API

### Endpoints Principales

#### Movies
- `GET /movies` - Obtener todas las películas
- `GET /movies/:id` - Obtener película por ID
- `GET /movies/:id/stats` - Obtener estadísticas de licencias de la película
- `POST /movies` - Crear nueva película
- `PATCH /movies/:id` - Actualizar película
- `DELETE /movies/:id` - Eliminar película

#### Scenes
- `GET /scenes` - Obtener todas las escenas
- `GET /scenes/:id` - Obtener escena por ID
- `GET /scenes/movie/:movieId` - Obtener escenas por película
- `POST /scenes` - Crear nueva escena
- `DELETE /scenes/:id` - Eliminar escena

#### Songs
- `GET /songs` - Obtener todas las canciones
- `GET /songs/:id` - Obtener canción por ID
- `POST /songs` - Crear nueva canción
- `DELETE /songs/:id` - Eliminar canción

#### Tracks
- `GET /tracks` - Obtener todos los tracks
- `GET /tracks/:id` - Obtener track por ID
- `GET /tracks?sceneId=:id` - Filtrar tracks por escena
- `GET /tracks?movieId=:id` - Filtrar tracks por película
- `POST /tracks` - Crear nuevo track
- `DELETE /tracks/:id` - Eliminar track

#### Licenses
- `POST /licenses/tracks/:trackId/status` - Actualizar estado de licencia
- `GET /licenses/tracks/:trackId/history` - Obtener historial de licencias
- `GET /licenses/tracks/:trackId/current` - Obtener estado actual de licencia
- `GET /licenses/statistics` - Obtener estadísticas generales

## 🔍 GraphQL API

### Queries Disponibles

#### Movies
```graphql
# Obtener todas las películas
query {
  movies {
    id
    title
    description
    director
    releaseYear
    status
    scenes {
      id
      name
      sceneNumber
    }
  }
}

# Obtener película específica
query {
  movie(id: "1") {
    id
    title
    description
    scenes {
      id
      name
      tracks {
        id
        name
        song {
          title
          artist
        }
      }
    }
  }
}

# Obtener estadísticas de película
query {
  movieWithStats(id: "1") {
    id
    title
    # Incluye estadísticas de licencias
  }
}
```

#### Scenes
```graphql
# Obtener todas las escenas
query {
  scenes {
    id
    name
    description
    sceneNumber
    durationSeconds
    movie {
      title
    }
  }
}

# Obtener escenas por película
query {
  scenesByMovie(movieId: 1) {
    id
    name
    sceneNumber
    tracks {
      id
      name
    }
  }
}
```

#### Songs
```graphql
# Obtener todas las canciones
query {
  songs {
    id
    title
    artist
    album
    releaseYear
    genre
    durationSeconds
    tracks {
      id
      name
    }
  }
}
```

#### Tracks
```graphql
# Obtener todos los tracks
query {
  tracks {
    id
    name
    startTimeSeconds
    endTimeSeconds
    notes
    scene {
      name
      movie {
        title
      }
    }
    song {
      title
      artist
    }
    currentLicenseStatus {
      status
      isActive
      createdAt
    }
  }
}

# Obtener tracks por escena
query {
  tracksByScene(sceneId: 1) {
    id
    name
    startTimeSeconds
    endTimeSeconds
  }
}

# Obtener tracks por película
query {
  tracksByMovie(movieId: 1) {
    id
    name
    scene {
      name
    }
  }
}
```

#### Licenses
```graphql
# Obtener historial de licencias
query {
  licenseHistory(trackId: "1") {
    id
    status
    isActive
    createdAt
    track {
      name
    }
  }
}

# Obtener estado actual de licencia
query {
  currentLicenseStatus(trackId: "1") {
    id
    status
    isActive
    createdAt
  }
}

# Obtener estadísticas de licencias
query {
  licenseStatistics
}
```

### Mutations Disponibles

#### Movies
```graphql
# Crear película
mutation {
  createMovie(createMovieInput: {
    title: "Nueva Película"
    description: "Descripción de la película"
    director: "Director"
    releaseYear: 2024
    status: "development"
  }) {
    id
    title
    createdAt
  }
}

# Actualizar película
mutation {
  updateMovie(
    id: "1"
    updateMovieInput: {
      title: "Título Actualizado"
      status: "production"
    }
  ) {
    id
    title
    status
  }
}

# Eliminar película
mutation {
  removeMovie(id: "1")
}
```

#### Scenes
```graphql
# Crear escena
mutation {
  createScene(createSceneInput: {
    name: "Escena de Apertura"
    description: "Primera escena de la película"
    sceneNumber: 1
    durationSeconds: 300
    movieId: 1
  }) {
    id
    name
    sceneNumber
  }
}
```

#### Songs
```graphql
# Crear canción
mutation {
  createSong(createSongInput: {
    title: "Nueva Canción"
    artist: "Artista"
    album: "Álbum"
    releaseYear: 2023
    genre: "Rock"
    durationSeconds: 240
  }) {
    id
    title
    artist
  }
}
```

#### Tracks
```graphql
# Crear track
mutation {
  createTrack(createTrackInput: {
    name: "Track de Fondo"
    startTimeSeconds: 10.5
    endTimeSeconds: 45.2
    notes: "Música de fondo para la escena"
    sceneId: 1
    songId: 1
  }) {
    id
    name
    startTimeSeconds
    endTimeSeconds
  }
}
```

#### Licenses
```graphql
# Actualizar estado de licencia
mutation {
  updateTrackLicenseStatus(
    trackId: "1"
    updateLicenseStatusInput: {
      status: APPROVED
      notes: "Licencia aprobada"
      updatedBy: "Admin"
      licenseFee: 500.00
      licenseStartDate: "2024-01-01T00:00:00Z"
      licenseEndDate: "2024-12-31T23:59:59Z"
    }
  ) {
    id
    status
    isActive
    createdAt
  }
}
```

## 🎯 Estados de Licencia Disponibles

- `PENDING` - Pendiente
- `IN_REVIEW` - En revisión
- `NEGOTIATING` - Negociando
- `APPROVED` - Aprobado
- `REJECTED` - Rechazado
- `EXPIRED` - Expirado

## 🔄 WebSocket Updates

El sistema también incluye actualizaciones en tiempo real vía WebSocket para cambios de estado de licencias:

```javascript
// Cliente JavaScript
const socket = io('http://localhost:3000');

socket.on('licenseStatusUpdated', (data) => {
  console.log('License status updated:', data);
});
```

## ⚡ Ventajas de la Implementación Dual

### REST API
- ✅ Familiar para la mayoría de desarrolladores
- ✅ Cacheable con HTTP
- ✅ Excelente para operaciones CRUD simples
- ✅ Compatibilidad con herramientas existentes

### GraphQL API
- ✅ Single endpoint para todas las operaciones
- ✅ Queries flexibles - solicita solo los datos que necesitas
- ✅ Tipado fuerte con introspección
- ✅ Excelente para relaciones complejas entre entidades
- ✅ Playground integrado para testing
- ✅ Ideal para aplicaciones frontend modernas

## 🛠️ Herramientas de Desarrollo

1. **GraphQL Playground**: `http://localhost:3000/graphql`
   - Explorar schema
   - Ejecutar queries y mutations
   - Ver documentación auto-generada

2. **Swagger UI**: `http://localhost:3000/api`
   - Documentación REST API completa
   - Testing de endpoints
   - Ejemplos de requests/responses

## 📚 Ejemplos de Uso

### Caso de Uso 1: Frontend React/Vue con GraphQL
```javascript
// Usar Apollo Client o similar
const GET_MOVIE_WITH_TRACKS = gql`
  query GetMovieWithTracks($id: ID!) {
    movie(id: $id) {
      title
      scenes {
        name
        tracks {
          name
          song {
            title
            artist
          }
          currentLicenseStatus {
            status
          }
        }
      }
    }
  }
`;
```

### Caso de Uso 2: Integración REST para Sistemas Legacy
```bash
# Actualizar estado de licencia
curl -X POST http://localhost:3000/licenses/tracks/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "Licencia aprobada",
    "licenseFee": 500.00
  }'
```

Esta implementación te permite usar la API que mejor se adapte a tus necesidades específicas, manteniendo la flexibilidad y compatibilidad con diferentes tipos de clientes.
