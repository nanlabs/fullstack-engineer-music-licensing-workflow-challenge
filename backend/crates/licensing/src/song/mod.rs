//! Songs: the catalogue of licensable music (title, artist, rights holder,
//! duration, external references).
//!
//! Same shape as `movie`. Songs are referenced by tracks; deleting a song that
//! is in use should be a `Business` error (`SONG_IN_USE`), not a cascade.
