use serde::Serialize;

use crate::{scope, Actor, SessionId, TenantId, UserId};

/// Authenticated request context produced by the authentication middleware.
///
/// Services receive it explicitly. It is never deserialized from a request
/// body and never fabricated with wildcard scopes for internal calls:
/// trusted entry points (bootstrap, cleanup jobs) call repositories directly.
#[derive(Debug, Clone, Serialize)]
pub struct AuthContext {
    pub actor: Actor,
    pub tenant_id: TenantId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<SessionId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub scopes: Vec<String>,
}

impl AuthContext {
    pub fn user_id(&self) -> Option<UserId> {
        self.actor.user_id()
    }

    /// Whether any held scope grants `required` (see [`scope::matches`]).
    pub fn has_scope(&self, required: &str) -> bool {
        scope::any_matches(&self.scopes, required)
    }

    pub fn has_any_scope<'a>(&self, required: impl IntoIterator<Item = &'a str>) -> bool {
        required.into_iter().any(|s| self.has_scope(s))
    }

    pub fn has_all_scopes<'a>(&self, required: impl IntoIterator<Item = &'a str>) -> bool {
        required.into_iter().all(|s| self.has_scope(s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn scope_helpers() {
        let c = ctx(&["users:*", "roles:read"]);
        assert!(c.has_scope("users:write"));
        assert!(c.has_any_scope(["nope", "roles:read"]));
        assert!(c.has_all_scopes(["users:read", "roles:read"]));
        assert!(!c.has_all_scopes(["users:read", "roles:write"]));
    }
}
