//! Licensing workflow state machine.
//!
//! A track's licensing status follows a deliberately small set of transitions,
//! modelling the back-and-forth negotiation with a rights holder:
//!
//! ```text
//!   DRAFT ──▶ NEGOTIATING ──▶ APPROVED   (terminal)
//!                  │  ▲
//!                  ▼  │
//!              REJECTED
//! ```
//!
//! - `APPROVED` is terminal: once a rights holder signs off, reopening the deal
//!   should create a new track rather than mutate the approved one.
//! - `REJECTED` is *not* terminal: a rejection mid-negotiation is routinely
//!   followed by a new offer, so `REJECTED -> NEGOTIATING` is allowed.
//! - A track never goes back to `DRAFT`, and self-transitions are rejected so a
//!   no-op update cannot emit a spurious real-time event.

use crate::entities::sea_orm_active_enums::LicensingStatus;

/// Returns `true` if a track is allowed to move from `from` to `to`.
pub fn is_valid_transition(from: &LicensingStatus, to: &LicensingStatus) -> bool {
    use LicensingStatus::*;

    matches!(
        (from, to),
        (Draft, Negotiating)
            | (Negotiating, Approved)
            | (Negotiating, Rejected)
            | (Rejected, Negotiating)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use LicensingStatus::*;

    const ALL: [LicensingStatus; 4] = [Draft, Negotiating, Approved, Rejected];

    #[test]
    fn allows_the_happy_path() {
        assert!(is_valid_transition(&Draft, &Negotiating));
        assert!(is_valid_transition(&Negotiating, &Approved));
    }

    #[test]
    fn allows_reopening_a_rejected_negotiation() {
        assert!(is_valid_transition(&Negotiating, &Rejected));
        assert!(is_valid_transition(&Rejected, &Negotiating));
    }

    #[test]
    fn approved_is_terminal() {
        for target in ALL {
            assert!(
                !is_valid_transition(&Approved, &target),
                "APPROVED should not move to {target:?}"
            );
        }
    }

    #[test]
    fn cannot_skip_the_negotiation_step() {
        assert!(!is_valid_transition(&Draft, &Approved));
        assert!(!is_valid_transition(&Draft, &Rejected));
    }

    #[test]
    fn cannot_go_back_to_draft() {
        for source in ALL {
            assert!(
                !is_valid_transition(&source, &Draft),
                "{source:?} should not move back to DRAFT"
            );
        }
    }

    #[test]
    fn rejects_self_transitions() {
        for status in ALL {
            assert!(
                !is_valid_transition(&status, &status),
                "{status:?} should not transition to itself"
            );
        }
    }

    /// Guards the whole table: exactly four of the sixteen pairs are allowed.
    #[test]
    fn allows_exactly_four_transitions() {
        let allowed: Vec<_> = ALL
            .iter()
            .flat_map(|from| ALL.iter().map(move |to| (from, to)))
            .filter(|(from, to)| is_valid_transition(from, to))
            .collect();

        assert_eq!(allowed.len(), 4, "unexpected transition table: {allowed:?}");
    }
}
