/**
 * Microservice Injection Tokens
 * Used for dependency injection of microservice clients
 */
export const INJECTION_TOKENS = {
  MOVIE_SERVICE: 'MOVIE_SERVICE',
  SONG_SERVICE: 'SONG_SERVICE',
  TRACK_SERVICE: 'TRACK_SERVICE',
  API_GATEWAY_MICROSERVICE_CLIENT: 'API_GATEWAY_MICROSERVICE_CLIENT',
  API_GATEWAY_HOST: 'api-gateway-host',
} as const;

/**
 * RabbitMQ Queue Names
 * Used for microservice queue configuration
 */
export const QUEUES = {
  MOVIE: 'MOVIE_QUEUE',
  SONG: 'SONG_QUEUE',
  TRACK: 'TRACK_QUEUE',
} as const;

/**
 * Message Patterns for Movie Microservice
 * Used in @MessagePattern decorators and client.send() calls
 */
export const MOVIE_PATTERNS = {
  CREATE_ONE: 'movie.create.one',
  FETCH_ALL: 'movie.fetch.all',
  FETCH_BY_ID: 'movie.fetch.byId',
} as const;

/**
 * Message Patterns for Movie Scene
 * Used in @MessagePattern decorators and client.send() calls
 */
export const MOVIE_SCENE_PATTERNS = {
  CREATE_ONE: 'movie-scene.create.one',
  FETCH_ALL: 'movie-scene.fetch.all',
  FETCH_BY_ID: 'movie-scene.fetch.byId',
} as const;

/**
 * Message Patterns for Song Microservice
 * Used in @MessagePattern decorators and client.send() calls
 */
export const SONG_PATTERNS = {
  CREATE_ONE: 'song.create.one',
  FETCH_ALL: 'song.fetch.all',
  FETCH_BY_ID: 'song.fetch.byId',
} as const;

/**
 * Message Patterns for Track Microservice
 * Used in @MessagePattern decorators and client.send() calls
 */
export const TRACK_PATTERNS = {
  CREATE_ONE: 'track.create.one',
  FETCH_ALL: 'track.fetch.all',
  FETCH_BY_ID: 'track.fetch.byId',
  UPDATE_LICENSING: 'track.update.licensing',
} as const;

/**
 * Event Patterns for SSE and Event-driven communication
 * Used in @EventPattern decorators and client.emit() calls
 */
export const EVENT_PATTERNS = {
  TRACK_CREATED: 'track.created',
  LICENSING_STATUS_UPDATED: 'licensing.status.updated',
} as const;

/**
 * Entity Relations for TypeORM eager loading
 * Used in repository findAll() and findById() calls
 * Note: Nested relations use dot notation (e.g., 'movieScene.movie')
 */
export const RELATIONS = {
  TRACK: {
    SONG: 'song',
    MOVIE_SCENE: 'movieScene',
    MOVIE_SCENE_MOVIE: 'movieScene.movie',
    LICENSING: 'licensing',
    ALL: ['song', 'movieScene', 'movieScene.movie', 'licensing'] as const,
  },
  MOVIE_SCENE: {
    MOVIE: 'movie',
  },
} as const;
