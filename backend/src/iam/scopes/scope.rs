use std::collections::HashMap;
use std::sync::LazyLock;

// Super scope — full access to everything
pub const SCOPE_ALL: &str = "*";

// Label scopes
pub const SCOPE_LABELS_ALL: &str = "labels:*";
pub const SCOPE_LABELS_READ: &str = "labels:read";
pub const SCOPE_LABELS_WRITE: &str = "labels:write";
pub const SCOPE_LABELS_DELETE: &str = "labels:delete";
pub const SCOPE_LABELS_MEMBERS: &str = "labels:members";

// Movie scopes
pub const SCOPE_MOVIES_ALL: &str = "movies:*";
pub const SCOPE_MOVIES_READ: &str = "movies:read";
pub const SCOPE_MOVIES_WRITE: &str = "movies:write";
pub const SCOPE_MOVIES_DELETE: &str = "movies:delete";
pub const SCOPE_MOVIES_MEMBERS: &str = "movies:members";

// Scene scopes
pub const SCOPE_SCENES_ALL: &str = "scenes:*";
pub const SCOPE_SCENES_READ: &str = "scenes:read";
pub const SCOPE_SCENES_WRITE: &str = "scenes:write";
pub const SCOPE_SCENES_DELETE: &str = "scenes:delete";

// Song scopes
pub const SCOPE_SONGS_ALL: &str = "songs:*";
pub const SCOPE_SONGS_READ: &str = "songs:read";
pub const SCOPE_SONGS_WRITE: &str = "songs:write";
pub const SCOPE_SONGS_DELETE: &str = "songs:delete";

// Track scopes
pub const SCOPE_TRACKS_ALL: &str = "tracks:*";
pub const SCOPE_TRACKS_READ: &str = "tracks:read";
pub const SCOPE_TRACKS_WRITE: &str = "tracks:write";
pub const SCOPE_TRACKS_DELETE: &str = "tracks:delete";

// License scopes
pub const SCOPE_LICENSES_ALL: &str = "licenses:*";
pub const SCOPE_LICENSES_READ: &str = "licenses:read";
pub const SCOPE_LICENSES_WRITE: &str = "licenses:write";
pub const SCOPE_LICENSES_NEGOTIATE: &str = "licenses:negotiate";
pub const SCOPE_LICENSES_DELETE: &str = "licenses:delete";

// ============================================================================
// Catalog
// ============================================================================

pub static SCOPE_CATEGORIES: LazyLock<HashMap<&str, Vec<&str>>> = LazyLock::new(|| {
    HashMap::from([
        (
            "Labels",
            vec![
                SCOPE_LABELS_ALL,
                SCOPE_LABELS_READ,
                SCOPE_LABELS_WRITE,
                SCOPE_LABELS_DELETE,
                SCOPE_LABELS_MEMBERS,
            ],
        ),
        (
            "Movies",
            vec![
                SCOPE_MOVIES_ALL,
                SCOPE_MOVIES_READ,
                SCOPE_MOVIES_WRITE,
                SCOPE_MOVIES_DELETE,
                SCOPE_MOVIES_MEMBERS,
            ],
        ),
        (
            "Scenes",
            vec![
                SCOPE_SCENES_ALL,
                SCOPE_SCENES_READ,
                SCOPE_SCENES_WRITE,
                SCOPE_SCENES_DELETE,
            ],
        ),
        (
            "Songs",
            vec![
                SCOPE_SONGS_ALL,
                SCOPE_SONGS_READ,
                SCOPE_SONGS_WRITE,
                SCOPE_SONGS_DELETE,
            ],
        ),
        (
            "Tracks",
            vec![
                SCOPE_TRACKS_ALL,
                SCOPE_TRACKS_READ,
                SCOPE_TRACKS_WRITE,
                SCOPE_TRACKS_DELETE,
            ],
        ),
        (
            "Licenses",
            vec![
                SCOPE_LICENSES_ALL,
                SCOPE_LICENSES_READ,
                SCOPE_LICENSES_WRITE,
                SCOPE_LICENSES_NEGOTIATE,
                SCOPE_LICENSES_DELETE,
            ],
        ),
    ])
});

pub static SCOPE_DESCRIPTIONS: LazyLock<HashMap<&str, &str>> = LazyLock::new(|| {
    HashMap::from([
        (SCOPE_ALL, "Full access to all system resources"),
        // Labels
        (SCOPE_LABELS_ALL, "Full access to label management"),
        (SCOPE_LABELS_READ, "View labels and their members"),
        (SCOPE_LABELS_WRITE, "Create and edit labels"),
        (SCOPE_LABELS_DELETE, "Delete labels"),
        (SCOPE_LABELS_MEMBERS, "Add or remove label members"),
        // Movies
        (SCOPE_MOVIES_ALL, "Full access to movie management"),
        (SCOPE_MOVIES_READ, "View movies and their members"),
        (SCOPE_MOVIES_WRITE, "Create and edit movies"),
        (SCOPE_MOVIES_DELETE, "Delete movies"),
        (SCOPE_MOVIES_MEMBERS, "Add or remove movie team members"),
        // Scenes
        (SCOPE_SCENES_ALL, "Full access to scene management"),
        (SCOPE_SCENES_READ, "View scenes"),
        (SCOPE_SCENES_WRITE, "Create and edit scenes"),
        (SCOPE_SCENES_DELETE, "Delete scenes"),
        // Songs
        (SCOPE_SONGS_ALL, "Full access to song management"),
        (SCOPE_SONGS_READ, "View songs"),
        (SCOPE_SONGS_WRITE, "Create and edit songs"),
        (SCOPE_SONGS_DELETE, "Delete songs"),
        // Tracks
        (SCOPE_TRACKS_ALL, "Full access to track management"),
        (SCOPE_TRACKS_READ, "View tracks"),
        (SCOPE_TRACKS_WRITE, "Create and edit tracks"),
        (SCOPE_TRACKS_DELETE, "Delete tracks"),
        // Licenses
        (SCOPE_LICENSES_ALL, "Full access to license management"),
        (SCOPE_LICENSES_READ, "View license requests and offers"),
        (
            SCOPE_LICENSES_WRITE,
            "Create, revise and submit license request drafts",
        ),
        (
            SCOPE_LICENSES_NEGOTIATE,
            "Counter-offer, accept, reject or cancel license negotiations",
        ),
        (SCOPE_LICENSES_DELETE, "Delete license request drafts"),
    ])
});

// ============================================================================
// Helpers
// ============================================================================

/// Returns the description for a given scope.
pub fn get_scope_description(scope: &str) -> &str {
    SCOPE_DESCRIPTIONS
        .get(scope)
        .copied()
        .unwrap_or("No description available")
}

/// Returns all defined scopes (flattened from categories).
pub fn get_all_scopes() -> Vec<&'static str> {
    SCOPE_CATEGORIES
        .values()
        .flat_map(|s| s.iter().copied())
        .collect()
}

/// Checks if a scope string is valid (exists in the catalog or is the super scope).
pub fn validate_scope(scope: &str) -> bool {
    if scope == SCOPE_ALL {
        return true;
    }
    SCOPE_CATEGORIES.values().any(|s| s.contains(&scope))
}

/// Returns the category name for a scope.
pub fn get_scope_category(scope: &str) -> &str {
    for (category, scopes) in SCOPE_CATEGORIES.iter() {
        if scopes.contains(&scope) {
            return category;
        }
    }
    "Unknown"
}

/// Expands a wildcard scope to all matching concrete scopes.
/// e.g. "movies:*" -> ["movies:read", "movies:write", ...]
pub fn expand_wildcard_scope(wildcard: &str) -> Vec<&'static str> {
    if wildcard == SCOPE_ALL {
        return get_all_scopes();
    }

    let prefix = match wildcard.strip_suffix(":*") {
        Some(p) => p,
        None => return vec![wildcard_to_static(wildcard)],
    };

    let prefix_colon = format!("{prefix}:");
    SCOPE_CATEGORIES
        .values()
        .flat_map(|s| s.iter().copied())
        .filter(|s| s.starts_with(&prefix_colon))
        .collect()
}

/// Checks if a set of scopes contains a specific scope,
/// accounting for wildcards. e.g. ["movies:*"] contains "movies:read".
pub fn scopes_contain(scopes: &[String], target: &str) -> bool {
    for scope in scopes {
        if scope == SCOPE_ALL || scope == target {
            return true;
        }
        if let Some(prefix) = scope.strip_suffix(":*")
            && target.starts_with(&format!("{prefix}:"))
        {
            return true;
        }
    }
    false
}

fn wildcard_to_static(s: &str) -> &'static str {
    // For non-wildcard scopes, try to match against known constants
    for scopes in SCOPE_CATEGORIES.values() {
        for &scope in scopes {
            if scope == s {
                return scope;
            }
        }
    }
    // Leak the string — this only happens for unknown scopes
    Box::leak(s.to_string().into_boxed_str())
}
