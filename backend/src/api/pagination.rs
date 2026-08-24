//! Opaque keyset ("cursor") pagination.
//!
//! A cursor is URL-safe base64 over a versioned JSON envelope holding the sort
//! key of the last row returned. Keyset paging is used instead of OFFSET so
//! that concurrent inserts cannot duplicate or skip rows within a traversal:
//! rows sorting after the cursor are always reached exactly once. Rows inserted
//! *before* the cursor are simply not seen until a fresh traversal.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::api::error::{ApiError, ProblemCode};

pub const DEFAULT_LIMIT: u32 = 50;
pub const MAX_LIMIT: u32 = 100;

/// Envelope version. Bumping it retires previously issued cursors, which then
/// fail closed with `validation_failed` rather than being misread.
const CURSOR_VERSION: u8 = 1;

/// Query parameters accepted by every collection endpoint.
#[derive(Debug, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct PageQuery {
    pub limit: Option<u32>,
    pub cursor: Option<String>,
}

impl PageQuery {
    /// Validates the requested page size.
    ///
    /// An over-large limit is rejected rather than silently clamped, so a
    /// client asking for 1000 rows learns it will not get them.
    pub fn limit(&self) -> Result<u32, ApiError> {
        match self.limit {
            None => Ok(DEFAULT_LIMIT),
            Some(0) => Err(ApiError::new(
                ProblemCode::ValidationFailed,
                "`limit` must be at least 1.",
            )),
            Some(limit) if limit > MAX_LIMIT => Err(ApiError::new(
                ProblemCode::ValidationFailed,
                format!("`limit` must not exceed {MAX_LIMIT}."),
            )),
            Some(limit) => Ok(limit),
        }
    }

    /// Decodes the cursor into this collection's sort key, if one was supplied.
    pub fn key<K: DeserializeOwned>(&self) -> Result<Option<K>, ApiError> {
        self.cursor.as_deref().map(decode_cursor).transpose()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct CursorEnvelope<K> {
    v: u8,
    k: K,
}

pub fn encode_cursor<K: Serialize>(key: &K) -> String {
    let json = serde_json::to_vec(&CursorEnvelope {
        v: CURSOR_VERSION,
        k: key,
    })
    .expect("cursor keys are always serializable");

    URL_SAFE_NO_PAD.encode(json)
}

/// Decodes a cursor, rejecting anything that is not a current, well-formed
/// envelope for this collection. A cursor from a different collection fails
/// here because its key shape does not match.
pub fn decode_cursor<K: DeserializeOwned>(raw: &str) -> Result<K, ApiError> {
    let invalid = || ApiError::new(ProblemCode::ValidationFailed, "`cursor` is not valid.");

    let bytes = URL_SAFE_NO_PAD.decode(raw).map_err(|_| invalid())?;
    let envelope: CursorEnvelope<K> = serde_json::from_slice(&bytes).map_err(|_| invalid())?;

    if envelope.v != CURSOR_VERSION {
        return Err(invalid());
    }

    Ok(envelope.k)
}

/// One page of results. `next_cursor` is null on the final page.
#[derive(Debug, Serialize, ToSchema)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}

impl<T> Page<T> {
    /// Builds a page from `limit + 1` fetched rows.
    ///
    /// The extra row is the lookahead that tells us whether more data exists;
    /// it is dropped rather than returned. Fetching it avoids both a second
    /// count query and a trailing empty page.
    pub fn from_lookahead<K: Serialize>(
        mut rows: Vec<T>,
        limit: u32,
        key_of: impl Fn(&T) -> K,
    ) -> Self {
        let limit = limit as usize;

        let next_cursor = if rows.len() > limit {
            rows.truncate(limit);
            rows.last().map(|row| encode_cursor(&key_of(row)))
        } else {
            None
        };

        Self {
            items: rows,
            next_cursor,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct TestKey {
        title: String,
        id: u32,
    }

    #[test]
    fn round_trips_a_cursor() {
        let key = TestKey {
            title: "A Song".to_string(),
            id: 7,
        };

        let decoded: TestKey = decode_cursor(&encode_cursor(&key)).unwrap();

        assert_eq!(decoded, key);
    }

    #[test]
    fn cursors_are_url_safe() {
        let key = TestKey {
            title: "?&=/+ \u{00fc}".to_string(),
            id: u32::MAX,
        };

        let cursor = encode_cursor(&key);

        assert!(
            cursor
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "cursor `{cursor}` contains characters that need URL escaping"
        );
    }

    #[test]
    fn rejects_malformed_and_foreign_cursors() {
        assert!(decode_cursor::<TestKey>("not base64!!").is_err());
        assert!(decode_cursor::<TestKey>(&URL_SAFE_NO_PAD.encode("{}")).is_err());

        // A cursor whose key belongs to a different collection.
        let foreign = encode_cursor(&serde_json::json!({ "sequence_number": 1 }));
        assert!(decode_cursor::<TestKey>(&foreign).is_err());

        // A cursor from a retired envelope version.
        let stale = URL_SAFE_NO_PAD.encode(
            serde_json::to_vec(&serde_json::json!({ "v": 0, "k": { "title": "A", "id": 1 } }))
                .unwrap(),
        );
        assert!(decode_cursor::<TestKey>(&stale).is_err());
    }

    #[test]
    fn validates_limits() {
        let query = |limit: Option<u32>| PageQuery {
            limit,
            cursor: None,
        };

        assert_eq!(query(None).limit().unwrap(), DEFAULT_LIMIT);
        assert_eq!(query(Some(1)).limit().unwrap(), 1);
        assert_eq!(query(Some(MAX_LIMIT)).limit().unwrap(), MAX_LIMIT);
        assert!(query(Some(0)).limit().is_err());
        assert!(query(Some(MAX_LIMIT + 1)).limit().is_err());
    }

    #[test]
    fn last_page_has_no_cursor() {
        let page = Page::from_lookahead(vec![1, 2, 3], 5, |row| *row);

        assert_eq!(page.items, [1, 2, 3]);
        assert!(page.next_cursor.is_none());
    }

    #[test]
    fn full_page_drops_the_lookahead_row_and_yields_a_cursor() {
        // Four rows fetched for a limit of three: the fourth only signals that
        // another page exists.
        let page = Page::from_lookahead(vec![1, 2, 3, 4], 3, |row| *row);

        assert_eq!(page.items, [1, 2, 3]);
        let cursor = page.next_cursor.expect("expected a next cursor");
        assert_eq!(decode_cursor::<i32>(&cursor).unwrap(), 3);
    }
}
