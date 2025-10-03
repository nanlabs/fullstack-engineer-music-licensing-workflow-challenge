-- ENUM for license status
CREATE TYPE license_status_enum AS ENUM ('pending', 'negotiating', 'approved', 'rejected', 'expired');

-- MOVIES
CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

-- SCENES
CREATE TABLE scenes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  movie_id INT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

-- SONGS
CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  duration INT NOT NULL CHECK (duration > 0),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

-- TRACKS
CREATE TABLE tracks (
  id SERIAL PRIMARY KEY,
  scene_id INT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  song_id INT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  start_time INT NOT NULL CHECK (start_time >= 0),
  end_time INT NOT NULL CHECK (end_time > start_time),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

-- LICENSES
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  track_id INT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  status license_status_enum NOT NULL,
  rights_holder VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP NULL
);

-- LICENSE HISTORY
CREATE TABLE license_history (
  id SERIAL PRIMARY KEY,
  license_id INT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  old_status license_status_enum NOT NULL,
  new_status license_status_enum NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  CHECK (old_status <> new_status)
);

-- INDEXES
CREATE INDEX idx_tracks_scene_id ON tracks(scene_id);
CREATE INDEX idx_tracks_song_id ON tracks(song_id);
CREATE INDEX idx_licenses_track_id ON licenses(track_id);
CREATE INDEX idx_license_history_license_id ON license_history(license_id);
