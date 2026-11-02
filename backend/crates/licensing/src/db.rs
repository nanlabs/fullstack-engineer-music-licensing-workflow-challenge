//! Infrastructure helpers shared by the Postgres adapters of this crate:
//! LIKE escaping for search terms and the classification of constraint
//! violations, so each adapter can turn "which constraint failed" into its
//! own domain error instead of inspecting `sqlx` details in several places.

/// `%term%` with the LIKE metacharacters escaped so user input is matched literally.
pub fn like_pattern(term: &str) -> String {
    let mut pattern = String::with_capacity(term.len() + 2);
    pattern.push('%');
    for c in term.chars() {
        if matches!(c, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(c);
    }
    pattern.push('%');
    pattern
}

/// Kind of database constraint a write ran into.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Violation {
    Unique,
    ForeignKey,
    Check,
}

/// The constraint violated by a failed statement, with its name when the
/// driver reports one, or `None` for any other error.
pub fn violation(err: &sqlx::Error) -> Option<(Violation, Option<&str>)> {
    let sqlx::Error::Database(db) = err else {
        return None;
    };
    let kind = if db.is_unique_violation() {
        Violation::Unique
    } else if db.is_foreign_key_violation() {
        Violation::ForeignKey
    } else if db.is_check_violation() {
        Violation::Check
    } else {
        return None;
    };
    Some((kind, db.constraint()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn like_pattern_escapes_metacharacters() {
        assert_eq!(like_pattern("encore"), "%encore%");
        assert_eq!(like_pattern("100%_\\"), "%100\\%\\_\\\\%");
    }

    #[test]
    fn non_database_errors_are_not_violations() {
        assert_eq!(violation(&sqlx::Error::RowNotFound), None);
    }
}
