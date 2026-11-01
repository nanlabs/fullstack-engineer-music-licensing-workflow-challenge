//! Service-boundary authorization.
//!
//! `require` checks the caller's tenant and a required scope. It runs in
//! services before any repository call so that internal callers, jobs and
//! tests get the same policy as HTTP requests. Middleware may reject early,
//! but it is never the only check.

use errx::AppError;
use kernel::{AuthContext, TenantId, UserId};

/// Ensures `ctx` belongs to `tenant_id` and holds `scope`.
pub fn require(ctx: &AuthContext, tenant_id: TenantId, scope: &str) -> Result<(), AppError> {
    if scope.is_empty() {
        return Err(AppError::forbidden("No permission policy defined for this operation"));
    }
    if ctx.tenant_id != tenant_id {
        return Err(AppError::forbidden("Access denied to this tenant"));
    }
    if !ctx.has_scope(scope) {
        return Err(AppError::forbidden("Insufficient permissions").detail("required_scope", scope));
    }
    Ok(())
}

/// Operations that must be attributed to a person (not an automated key).
pub fn require_user(ctx: &AuthContext) -> Result<UserId, AppError> {
    ctx.user_id().ok_or_else(AppError::unauthorized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use kernel::Actor;

    fn ctx(tenant: TenantId, scopes: &[&str]) -> AuthContext {
        AuthContext {
            actor: Actor::user(UserId::generate()),
            tenant_id: tenant,
            session_id: None,
            email: None,
            name: None,
            scopes: scopes.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn checks_tenant_then_scope() {
        let tenant = TenantId::generate();
        let c = ctx(tenant, &["users:read"]);
        assert!(require(&c, tenant, "users:read").is_ok());
        assert_eq!(
            require(&c, TenantId::generate(), "users:read")
                .unwrap_err()
                .kind()
                .http_status(),
            403
        );
        let err = require(&c, tenant, "users:write").unwrap_err();
        assert_eq!(err.kind().http_status(), 403);
        assert_eq!(err.details()["required_scope"], "users:write");
    }

    #[test]
    fn wildcard_never_skips_tenant_or_empty_scope() {
        let tenant = TenantId::generate();
        let c = ctx(tenant, &["*"]);
        assert!(require(&c, TenantId::generate(), "users:read").is_err());
        assert!(require(&c, tenant, "").is_err());
        assert!(require(&c, tenant, "anything:write").is_ok());
    }
}
