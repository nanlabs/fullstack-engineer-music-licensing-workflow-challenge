//! Scope matching rules shared by middleware, services and grant checks.
//!
//! A scope answers *what action is allowed*. Which resources are reachable is
//! a separate question answered by the tenant constraint in every repository
//! query. Both checks are always required.

/// Full application authority inside the caller's tenant. Never cross-tenant.
pub const WILDCARD: &str = "*";

/// Reserved prefix for a future operator application. Rejected everywhere in
/// the customer API, even on exact matches and even for `*` holders.
pub const PLATFORM_PREFIX: &str = "platform:";

/// Whether a held scope grants the required one.
///
/// Supported forms: exact match, tenant-local `*`, and prefix wildcards such
/// as `users:*` which cover `users:read` but not `usersx:read`.
pub fn matches(held: &str, required: &str) -> bool {
    if required.is_empty() || held.starts_with(PLATFORM_PREFIX) || required.starts_with(PLATFORM_PREFIX) {
        return false;
    }
    if held == required || held == WILDCARD {
        return true;
    }
    if let Some(prefix) = held.strip_suffix(":*") {
        if prefix.is_empty() {
            return false;
        }
        return required
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.len() > 1 && rest.starts_with(':'));
    }
    false
}

/// Whether any scope in `held` grants `required`.
pub fn any_matches<S: AsRef<str>>(held: &[S], required: &str) -> bool {
    held.iter().any(|h| matches(h.as_ref(), required))
}

/// Returns the requested scopes that are not covered by the held ones.
///
/// Used to stop privilege escalation: a caller may only grant what it holds.
pub fn uncovered<'a, S: AsRef<str>>(held: &[S], requested: &'a [String]) -> Vec<&'a str> {
    requested
        .iter()
        .map(String::as_str)
        .filter(|r| !any_matches(held, r))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_table() {
        let cases = [
            ("users:read", "users:read", true),
            ("users:*", "users:read", true),
            ("users:read", "users:*", false),
            ("api_keys:write", "*", false),
            ("*", "users:read", true),
            ("*", "platform:tenants:read", false),
            ("platform:tenants:read", "platform:tenants:read", false),
            ("users:*", "usersx:read", false),
            ("users:*", "users:", false),
            ("users:*", "users", false),
            (":*", "anything", false),
            ("*", "", false),
        ];
        for (held, required, expected) in cases {
            assert_eq!(matches(held, required), expected, "held={held} required={required}");
        }
    }

    #[test]
    fn uncovered_lists_only_missing_scopes() {
        let held = ["users:*".to_string(), "roles:read".to_string()];
        let requested = vec!["users:read".to_string(), "roles:write".to_string(), "*".to_string()];
        assert_eq!(uncovered(&held, &requested), vec!["roles:write", "*"]);
        assert!(uncovered(&["*".to_string()], &requested).is_empty());
    }
}
