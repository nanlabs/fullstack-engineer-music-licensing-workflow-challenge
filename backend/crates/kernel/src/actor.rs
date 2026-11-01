use serde::{Deserialize, Serialize};

use crate::ids::UserId;

/// The principal that performed a request.
///
/// Unlike a struct with optional fields, an enum cannot represent an invalid
/// actor, so authentication boundaries do not need an `is_valid` check.
/// When API keys are introduced they become a second variant
/// (`ApiKey(ApiKeyId)`) and every `match` on `Actor` will have to handle it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum Actor {
    User(UserId),
}

impl Actor {
    pub fn user(id: UserId) -> Self {
        Actor::User(id)
    }

    /// Returns the user id when the actor is a user.
    pub fn user_id(&self) -> Option<UserId> {
        match self {
            Actor::User(id) => Some(*id),
        }
    }

    pub fn is_user(&self) -> bool {
        matches!(self, Actor::User(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_type_and_id() {
        let id = UserId::generate();
        let value = serde_json::to_value(Actor::user(id)).unwrap();
        assert_eq!(value["type"], "user");
        assert_eq!(value["id"], id.to_string());
    }
}
