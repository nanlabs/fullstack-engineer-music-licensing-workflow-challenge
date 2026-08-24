//! Who performed a change.
//!
//! There is no identity table in this system. An actor is derived entirely from
//! a display name, so that track history stays readable without a join, and so
//! the same demo user keeps one stable ID across processes and restarts.

use uuid::Uuid;

/// Fixed namespace for actor IDs. Changing it re-keys every existing actor, so
/// history written before the change would no longer join to history after it.
const ACTOR_NAMESPACE: Uuid = Uuid::from_u128(0x1e4b7d92_5c38_5a06_9f41_2d7c8e5b3a60);

/// Mirrors the `track_events.actor_name` database constraint.
pub const MAX_DISPLAY_NAME_CHARS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum InvalidDisplayName {
    #[error("display name must not be empty")]
    Empty,
    #[error("display name must not exceed {MAX_DISPLAY_NAME_CHARS} characters")]
    TooLong,
    #[error("display name must not contain control characters")]
    ControlCharacters,
}

/// An authenticated participant, identified by a name they chose.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Actor {
    pub id: Uuid,
    /// The trimmed name as presented, preserving the author's capitalisation.
    pub name: String,
}

impl Actor {
    /// Derives an actor from a raw display name.
    ///
    /// The stored name has its whitespace collapsed to single spaces but keeps
    /// its capitalisation, because that is what history should display. The ID
    /// is derived from the case-folded form of that same collapsed name, so
    /// "Ada Lovelace", "ada lovelace", and "Ada  Lovelace" are one person
    /// rather than three.
    ///
    /// Collapsing happens before the control-character check, so a tab between
    /// two words is treated as the space it looks like. Only control characters
    /// that are *not* whitespace are rejected — those have no place in a name
    /// and would otherwise reach logs and history verbatim.
    pub fn from_display_name(raw: &str) -> Result<Self, InvalidDisplayName> {
        let name = raw.split_whitespace().collect::<Vec<_>>().join(" ");

        if name.is_empty() {
            return Err(InvalidDisplayName::Empty);
        }
        if name.chars().count() > MAX_DISPLAY_NAME_CHARS {
            return Err(InvalidDisplayName::TooLong);
        }
        if name.chars().any(char::is_control) {
            return Err(InvalidDisplayName::ControlCharacters);
        }

        Ok(Self {
            id: Uuid::new_v5(&ACTOR_NAMESPACE, name.to_lowercase().as_bytes()),
            name,
        })
    }

    /// Rebuilds an actor from already-validated token claims.
    pub fn from_claims(id: Uuid, name: String) -> Self {
        Self { id, name }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_a_stable_id_from_the_normalised_name() {
        let actor = Actor::from_display_name("Ada Lovelace").unwrap();

        // Pinned: a change here breaks attribution on already-written history.
        assert_eq!(actor.id.to_string(), "dee4eda5-0d1d-5d43-94d6-54bbc019541f");
        assert_eq!(
            actor.id,
            Actor::from_display_name("Ada Lovelace").unwrap().id
        );
    }

    #[test]
    fn the_same_person_spelled_differently_is_one_actor() {
        let canonical = Actor::from_display_name("Ada Lovelace").unwrap();

        for variant in [
            "ada lovelace",
            "  Ada Lovelace  ",
            "ADA  LOVELACE",
            "Ada\tLovelace",
        ] {
            assert_eq!(
                Actor::from_display_name(variant).unwrap().id,
                canonical.id,
                "`{variant}` should resolve to the same actor"
            );
        }
    }

    #[test]
    fn different_people_get_different_ids() {
        assert_ne!(
            Actor::from_display_name("Ada").unwrap().id,
            Actor::from_display_name("Grace").unwrap().id
        );
    }

    #[test]
    fn preserves_the_presented_capitalisation() {
        let actor = Actor::from_display_name("  Ada Lovelace  ").unwrap();

        assert_eq!(
            actor.name, "Ada Lovelace",
            "the name is trimmed but not folded"
        );
    }

    #[test]
    fn rejects_invalid_display_names() {
        assert_eq!(
            Actor::from_display_name("   ").unwrap_err(),
            InvalidDisplayName::Empty
        );
        assert_eq!(
            Actor::from_display_name("").unwrap_err(),
            InvalidDisplayName::Empty
        );
        assert_eq!(
            Actor::from_display_name(&"a".repeat(MAX_DISPLAY_NAME_CHARS + 1)).unwrap_err(),
            InvalidDisplayName::TooLong
        );
        // A bell character is not whitespace and has no place in a name.
        assert_eq!(
            Actor::from_display_name("Ada\u{0007}Lovelace").unwrap_err(),
            InvalidDisplayName::ControlCharacters
        );

        // Whitespace controls are collapsed instead of rejected, so a name
        // pasted with a newline in it still works and cannot smuggle that
        // newline into logs or history.
        let pasted = Actor::from_display_name("Ada\nLovelace").unwrap();
        assert_eq!(pasted.name, "Ada Lovelace");

        // The boundary itself is accepted, and counted in characters rather
        // than bytes so multi-byte names are not unfairly truncated.
        assert!(Actor::from_display_name(&"a".repeat(MAX_DISPLAY_NAME_CHARS)).is_ok());
        assert!(Actor::from_display_name(&"é".repeat(MAX_DISPLAY_NAME_CHARS)).is_ok());
    }
}
