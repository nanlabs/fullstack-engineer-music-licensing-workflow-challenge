//! Typed entity identifiers.
//!
//! A typed id prevents accidentally passing a `UserId` where a `TenantId` is
//! expected. It is still just a UUID: it does not prove the entity exists nor
//! that the caller may access it. Convert path parameters at the transport
//! boundary with `FromStr` and let repositories constrain by tenant.

macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(
            Debug,
            Clone,
            Copy,
            PartialEq,
            Eq,
            Hash,
            PartialOrd,
            Ord,
            serde::Serialize,
            serde::Deserialize,
            sqlx::Type,
        )]
        #[serde(transparent)]
        #[sqlx(transparent)]
        pub struct $name(pub uuid::Uuid);

        impl $name {
            /// Generates a fresh random (v4) identifier.
            pub fn generate() -> Self {
                Self(uuid::Uuid::new_v4())
            }

            pub fn as_uuid(&self) -> uuid::Uuid {
                self.0
            }
        }

        impl From<uuid::Uuid> for $name {
            fn from(value: uuid::Uuid) -> Self {
                Self(value)
            }
        }

        impl From<$name> for uuid::Uuid {
            fn from(value: $name) -> Self {
                value.0
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                uuid::Uuid::parse_str(s).map(Self)
            }
        }
    };
}

define_id!(
    /// Identifies a tenant (a customer organization).
    TenantId
);
define_id!(
    /// Identifies a user inside a tenant.
    UserId
);
define_id!(
    /// Identifies a role inside a tenant.
    RoleId
);
define_id!(
    /// Identifies an invitation.
    InvitationId
);
define_id!(
    /// Identifies an authenticated session (one per device/browser).
    SessionId
);
define_id!(
    /// Identifies a one-time password record.
    OtpId
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_round_trip_through_strings_and_json() {
        let id = UserId::generate();
        let parsed: UserId = id.to_string().parse().unwrap();
        assert_eq!(id, parsed);

        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, format!("\"{}\"", id.0));
        let back: UserId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, back);
    }

    #[test]
    fn invalid_strings_are_rejected() {
        assert!("not-a-uuid".parse::<TenantId>().is_err());
    }
}
