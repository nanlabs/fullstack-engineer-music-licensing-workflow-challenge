export const APPLICATION_ERRORS = {
  INPUT: {
    INVALID_INPUT_ERROR: {
      message: 'One or more fields were invalid',
      statusCode: 400,
    },
  },
  MOVIES: {
    NOT_FOUND_ERROR: {
      message: 'The movie with the specified ID was not found in the database.',
      statusCode: 404,
    },
    FOUND_ERROR: {
      message: 'The movie with the specified name was found in the database.',
      statusCode: 409,
    },
  },
  SONGS: {
    NOT_FOUND_ERROR: {
      message: 'The song with the specified ID was not found in the database.',
      statusCode: 404,
    },
    FOUND_ERROR: {
      message: 'The song with the specified name was found in the database.',
      statusCode: 409,
    },
  },
  SCENES: {
    NOT_FOUND_ERROR: {
      message: 'The scene with the specified ID was not found in the database.',
      statusCode: 404,
    },
  },
  LICENSES: {
    INVALID_TRANSITION: {
      message: 'The transition is not valid',
      statusCode: 400,
    },
  },
  TRACKS: {
    WRONG_TIME_FORMAT: {
      message: 'The time fields have to be in HH:MM:SS format.',
      statusCode: 400,
    },
    INVALID_TRACK_TIMES: {
      message: 'Invalid track: end time must be after start time',
      statusCode: 400,
    },
    TRACK_EXCEEDS_SONG_DURATION: {
      message: `Track exceeds song duration.`,
      statusCode: 400,
    },
    NOT_FOUND_ERROR: {
      message: 'The scene with the specified ID was not found in the database.',
      statusCode: 404,
    },
  },
  GENERIC: {
    SERVER_ERROR: {
      message: 'Internal Server Error',
      statusCode: 500,
    },
  },
}
