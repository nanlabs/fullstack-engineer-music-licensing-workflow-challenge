//! Tracks: the placement of a song inside a scene (start/end timestamps,
//! usage type such as background or featured).
//!
//! Same shape as `movie`. A track links a scene and a song from the same
//! tenant and is the unit that gets licensed, so it is the natural owner of
//! the `license` state. Real-time updates for the frontend (SSE/WebSocket)
//! should be published from `TrackService` after each state change.
