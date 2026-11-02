//! Serde helpers shared by the request DTOs of every module.

use serde::{Deserialize, Deserializer};

/// Distinguishes "absent" from "null" in a partial update.
///
/// Annotate a nullable field with
/// `#[serde(default, deserialize_with = "kernel::json::double_option")]` and it
/// deserializes to `None` when the key is missing (keep the current value),
/// `Some(None)` when it is `null` (clear the value) and `Some(Some(v))` when a
/// value is given. Text fields do not need this: an empty string clears them.
pub fn double_option<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Patch {
        #[serde(default, deserialize_with = "super::double_option")]
        value: Option<Option<i32>>,
    }

    #[test]
    fn absent_null_and_value_are_distinct() {
        let absent: Patch = serde_json::from_str("{}").unwrap();
        assert_eq!(absent.value, None);
        let null: Patch = serde_json::from_str(r#"{"value":null}"#).unwrap();
        assert_eq!(null.value, Some(None));
        let value: Patch = serde_json::from_str(r#"{"value":7}"#).unwrap();
        assert_eq!(value.value, Some(Some(7)));
    }
}
