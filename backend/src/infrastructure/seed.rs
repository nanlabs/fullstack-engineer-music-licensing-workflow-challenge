//! Deterministic development seed data.
//!
//! Every row's ID is a UUIDv5 derived from a fixed namespace and a stable slug,
//! so the same catalog exists across machines, restarts, and rebuilt databases.
//! IDs can therefore be hard-coded in README examples and manual testing.
//!
//! The seed is idempotent by upsert: re-running converges the catalog to the
//! definitions below rather than duplicating or drifting from them. It creates
//! no identities, credentials, or tracks.

use chrono::{DateTime, TimeZone, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Fixed namespace for seed IDs. Changing it re-keys the entire seed catalog.
const SEED_NAMESPACE: Uuid = Uuid::from_u128(0x6b1f2c34_9d5a_5e7b_8c21_0a4d3f6e9b17);

/// Fixed base instant for `movies.created_at`, so that `(created_at, id)`
/// pagination order is identical on every seeded database.
fn seed_epoch() -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0)
        .single()
        .expect("2024-01-01T00:00:00Z is a valid instant")
}

/// Derives a stable ID from an entity kind and slug.
pub fn seed_id(kind: &str, slug: &str) -> Uuid {
    Uuid::new_v5(&SEED_NAMESPACE, format!("{kind}:{slug}").as_bytes())
}

struct SeedMovie {
    slug: &'static str,
    title: &'static str,
    /// Days after the seed epoch, fixing this movie's place in created order.
    day_offset: i64,
    scenes: &'static [SeedScene],
}

struct SeedScene {
    slug: &'static str,
    sequence_number: i32,
    title: &'static str,
    duration_ms: i32,
}

struct SeedSong {
    slug: &'static str,
    title: &'static str,
    artist_name: &'static str,
}

const MOVIES: &[SeedMovie] = &[
    SeedMovie {
        slug: "midnight-in-lisbon",
        title: "Midnight in Lisbon",
        day_offset: 0,
        scenes: &[
            SeedScene {
                slug: "midnight-in-lisbon/arrival",
                sequence_number: 1,
                title: "Arrival at the Docks",
                duration_ms: 132_000,
            },
            SeedScene {
                slug: "midnight-in-lisbon/tram",
                sequence_number: 2,
                title: "The Tram Chase",
                duration_ms: 218_500,
            },
            SeedScene {
                slug: "midnight-in-lisbon/rooftop",
                sequence_number: 3,
                title: "Rooftop Confession",
                duration_ms: 96_250,
            },
        ],
    },
    SeedMovie {
        slug: "the-last-rehearsal",
        title: "The Last Rehearsal",
        day_offset: 1,
        scenes: &[
            SeedScene {
                slug: "the-last-rehearsal/auditions",
                sequence_number: 1,
                title: "Auditions",
                duration_ms: 174_000,
            },
            SeedScene {
                slug: "the-last-rehearsal/empty-theatre",
                sequence_number: 2,
                title: "The Empty Theatre",
                duration_ms: 240_000,
            },
        ],
    },
    SeedMovie {
        slug: "neon-harbour",
        title: "Neon Harbour",
        day_offset: 2,
        scenes: &[
            SeedScene {
                slug: "neon-harbour/night-market",
                sequence_number: 1,
                title: "Night Market",
                duration_ms: 155_750,
            },
            SeedScene {
                slug: "neon-harbour/ferry",
                sequence_number: 2,
                title: "Last Ferry Out",
                duration_ms: 188_000,
            },
            SeedScene {
                slug: "neon-harbour/credits",
                sequence_number: 3,
                title: "End Credits",
                duration_ms: 305_000,
            },
        ],
    },
];

const SONGS: &[SeedSong] = &[
    SeedSong {
        slug: "amber-lights",
        title: "Amber Lights",
        artist_name: "The Quiet Signal",
    },
    SeedSong {
        slug: "before-the-tide",
        title: "Before the Tide",
        artist_name: "Marisol Vega",
    },
    SeedSong {
        slug: "carousel",
        title: "Carousel",
        artist_name: "Paper Districts",
    },
    SeedSong {
        slug: "dust-and-gold",
        title: "Dust and Gold",
        artist_name: "Ilse Brandt",
    },
    SeedSong {
        slug: "eastbound-radio",
        title: "Eastbound Radio",
        artist_name: "The Quiet Signal",
    },
    SeedSong {
        slug: "faultline",
        title: "Faultline",
        artist_name: "Kova",
    },
    SeedSong {
        slug: "glass-harbour",
        title: "Glass Harbour",
        artist_name: "Paper Districts",
    },
    SeedSong {
        slug: "hold-the-line",
        title: "Hold the Line",
        artist_name: "Marisol Vega",
    },
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeedSummary {
    pub movies: usize,
    pub scenes: usize,
    pub songs: usize,
}

/// Applies the seed in a single transaction, so a failure leaves no partial
/// catalog behind.
pub async fn apply(pool: &PgPool) -> Result<SeedSummary, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let epoch = seed_epoch();
    let mut scene_count = 0;

    for movie in MOVIES {
        let movie_id = seed_id("movie", movie.slug);
        let created_at = epoch + chrono::Duration::days(movie.day_offset);

        sqlx::query!(
            r#"INSERT INTO movies (id, title, created_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (id) DO UPDATE
               SET title = EXCLUDED.title, created_at = EXCLUDED.created_at"#,
            movie_id,
            movie.title,
            created_at,
        )
        .execute(&mut *transaction)
        .await?;

        for scene in movie.scenes {
            sqlx::query!(
                r#"INSERT INTO scenes (id, movie_id, sequence_number, title, duration_ms)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT (id) DO UPDATE
                   SET movie_id = EXCLUDED.movie_id,
                       sequence_number = EXCLUDED.sequence_number,
                       title = EXCLUDED.title,
                       duration_ms = EXCLUDED.duration_ms"#,
                seed_id("scene", scene.slug),
                movie_id,
                scene.sequence_number,
                scene.title,
                scene.duration_ms,
            )
            .execute(&mut *transaction)
            .await?;

            scene_count += 1;
        }
    }

    for song in SONGS {
        sqlx::query!(
            r#"INSERT INTO songs (id, title, artist_name)
               VALUES ($1, $2, $3)
               ON CONFLICT (id) DO UPDATE
               SET title = EXCLUDED.title, artist_name = EXCLUDED.artist_name"#,
            seed_id("song", song.slug),
            song.title,
            song.artist_name,
        )
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    Ok(SeedSummary {
        movies: MOVIES.len(),
        scenes: scene_count,
        songs: SONGS.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn seed_ids_are_stable_and_distinct() {
        // A change here means previously seeded databases and any documented
        // IDs no longer match, so this value is pinned deliberately.
        assert_eq!(
            seed_id("movie", "midnight-in-lisbon").to_string(),
            "2be7da9d-1699-59aa-9253-94cb1c8642be"
        );

        assert_ne!(seed_id("movie", "a"), seed_id("song", "a"));
        assert_eq!(seed_id("song", "a"), seed_id("song", "a"));
    }

    #[test]
    fn seed_definitions_are_internally_consistent() {
        let mut ids = HashSet::new();

        for movie in MOVIES {
            assert!(ids.insert(seed_id("movie", movie.slug)), "duplicate movie");

            let mut sequences = HashSet::new();
            for scene in movie.scenes {
                assert!(ids.insert(seed_id("scene", scene.slug)), "duplicate scene");
                assert!(
                    sequences.insert(scene.sequence_number),
                    "scene sequence numbers must be unique within a movie"
                );
                assert!(scene.duration_ms > 0);
            }
        }

        for song in SONGS {
            assert!(ids.insert(seed_id("song", song.slug)), "duplicate song");
        }
    }
}
