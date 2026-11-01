//! Application permission catalog.
//!
//! Route registration and services use these constants, never string
//! literals. Scopes are tenant-local: `*` is full authority inside the
//! caller's tenant and nothing more.

use errx::AppError;
use kernel::{scope, AuthContext};
use serde::Serialize;

pub const USERS_READ: &str = "users:read";
pub const USERS_WRITE: &str = "users:write";
pub const SCOPES_READ: &str = "scopes:read";
pub const SCOPES_WRITE: &str = "scopes:write";
pub const ROLES_READ: &str = "roles:read";
pub const ROLES_WRITE: &str = "roles:write";
pub const ROLES_ASSIGN: &str = "roles:assign";
pub const INVITATIONS_READ: &str = "invitations:read";
pub const INVITATIONS_WRITE: &str = "invitations:write";
pub const TENANTS_READ: &str = "tenants:read";

// Licensing domain scopes live here too so the catalog is a single source of truth.
pub const MOVIES_READ: &str = "movies:read";
pub const MOVIES_WRITE: &str = "movies:write";
pub const LICENSES_READ: &str = "licenses:read";
pub const LICENSES_WRITE: &str = "licenses:write";

#[derive(Debug, Clone, Serialize)]
pub struct ScopeDefinition {
    pub scope: &'static str,
    pub description: &'static str,
}

pub const CATALOG: &[ScopeDefinition] = &[
    ScopeDefinition {
        scope: USERS_READ,
        description: "List and read tenant members",
    },
    ScopeDefinition {
        scope: USERS_WRITE,
        description: "Suspend, reinstate and update members",
    },
    ScopeDefinition {
        scope: SCOPES_READ,
        description: "Read the scope catalog",
    },
    ScopeDefinition {
        scope: SCOPES_WRITE,
        description: "Grant or remove direct scopes",
    },
    ScopeDefinition {
        scope: ROLES_READ,
        description: "List and read roles",
    },
    ScopeDefinition {
        scope: ROLES_WRITE,
        description: "Create, update and delete roles",
    },
    ScopeDefinition {
        scope: ROLES_ASSIGN,
        description: "Assign roles to members",
    },
    ScopeDefinition {
        scope: INVITATIONS_READ,
        description: "List and read invitations",
    },
    ScopeDefinition {
        scope: INVITATIONS_WRITE,
        description: "Create, resend and revoke invitations",
    },
    ScopeDefinition {
        scope: TENANTS_READ,
        description: "Read the caller's tenant",
    },
    ScopeDefinition {
        scope: MOVIES_READ,
        description: "Read movies, scenes, tracks and songs",
    },
    ScopeDefinition {
        scope: MOVIES_WRITE,
        description: "Create and edit movies, scenes, tracks and songs",
    },
    ScopeDefinition {
        scope: LICENSES_READ,
        description: "Read licensing status and history",
    },
    ScopeDefinition {
        scope: LICENSES_WRITE,
        description: "Advance the licensing workflow",
    },
];

/// Families (`users:*`) and the tenant wildcard are grantable too.
pub fn is_known(scope: &str) -> bool {
    if scope == kernel::scope::WILDCARD {
        return true;
    }
    if let Some(family) = scope.strip_suffix(":*") {
        return CATALOG
            .iter()
            .any(|d| d.scope.strip_prefix(family).is_some_and(|rest| rest.starts_with(':')));
    }
    CATALOG.iter().any(|d| d.scope == scope)
}

/// Rejects unknown scopes and anything under the reserved `platform:` prefix.
pub fn validate_grantable(requested: &[String]) -> Result<(), AppError> {
    let unknown: Vec<&str> = requested
        .iter()
        .map(String::as_str)
        .filter(|s| s.starts_with(scope::PLATFORM_PREFIX) || !is_known(s))
        .collect();
    if unknown.is_empty() {
        Ok(())
    } else {
        Err(AppError::validation("Unknown or forbidden scopes").detail("scopes", unknown))
    }
}

/// A caller may only grant scopes covered by the scopes it holds.
pub fn ensure_can_grant(ctx: &AuthContext, requested: &[String]) -> Result<(), AppError> {
    let denied = scope::uncovered(&ctx.scopes, requested);
    if denied.is_empty() {
        Ok(())
    } else {
        Err(AppError::forbidden("Cannot grant scopes you do not hold").detail("scopes", denied))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use kernel::{Actor, TenantId, UserId};

    fn ctx(scopes: &[&str]) -> AuthContext {
        AuthContext {
            actor: Actor::user(UserId::generate()),
            tenant_id: TenantId::generate(),
            session_id: None,
            email: None,
            name: None,
            scopes: scopes.iter().map(|s| s.to_string()).collect(),
        }
    }

    fn strings(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn catalog_membership() {
        assert!(is_known("users:read"));
        assert!(is_known("users:*"));
        assert!(is_known("*"));
        assert!(!is_known("users:"));
        assert!(!is_known("billing:*"));
        assert!(!is_known("platform:tenants:read"));
    }

    #[test]
    fn grant_coverage_table() {
        assert!(ensure_can_grant(&ctx(&["users:*"]), &strings(&["users:read"])).is_ok());
        assert!(ensure_can_grant(&ctx(&["users:read"]), &strings(&["users:*"])).is_err());
        assert!(ensure_can_grant(&ctx(&["roles:write"]), &strings(&["*"])).is_err());
        assert!(ensure_can_grant(&ctx(&["*"]), &strings(&["platform:tenants:read"])).is_err());
        assert!(ensure_can_grant(&ctx(&["*"]), &strings(&["users:read", "roles:*"])).is_ok());
    }

    #[test]
    fn grantable_validation() {
        assert!(validate_grantable(&strings(&["users:read", "movies:*"])).is_ok());
        let err = validate_grantable(&strings(&["users:read", "nope:read", "platform:x"])).unwrap_err();
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["scopes"], serde_json::json!(["nope:read", "platform:x"]));
    }
}
