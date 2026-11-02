//! Text normalization shared by the request handling of every module.
//!
//! The `validator` length rules run first at the transport boundary; these
//! helpers run in the services, after authorization, and turn whitespace-only
//! input into the error or the `NULL` it really means.

use errx::AppError;
use validator::ValidateEmail;

/// Trims a required text field. Blank input passes a length validator but is
/// still invalid; the error names the field so the UI can highlight it.
pub fn normalize_required(raw: &str, field: &'static str) -> Result<String, AppError> {
    let value = raw.trim();
    if value.is_empty() {
        let mut label = field.chars();
        let message = match label.next() {
            Some(first) => format!("{}{} cannot be blank", first.to_uppercase(), label.as_str()),
            None => "Field cannot be blank".to_owned(),
        };
        return Err(AppError::validation(message).detail("field", field));
    }
    Ok(value.to_owned())
}

/// Trims an optional text field; blank means "no value" (stored as `NULL`).
pub fn normalize_optional(raw: Option<String>) -> Option<String> {
    raw.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// Trims an optional e-mail; blank means "no value". Anything else must be a
/// well-formed address. It is a contact, not an identity, so the case is kept.
pub fn normalize_optional_email(raw: Option<String>, field: &'static str) -> Result<Option<String>, AppError> {
    match normalize_optional(raw) {
        Some(email) if !email.validate_email() => {
            Err(AppError::validation("Invalid e-mail address").detail("field", field))
        }
        other => Ok(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn optional_email_is_trimmed_or_rejected() {
        let ok = normalize_optional_email(Some("  Licensing@Harborlane.test ".into()), "rights_holder_email").unwrap();
        assert_eq!(ok.as_deref(), Some("Licensing@Harborlane.test"));
        assert_eq!(
            normalize_optional_email(Some("   ".into()), "rights_holder_email").unwrap(),
            None
        );
        assert_eq!(normalize_optional_email(None, "rights_holder_email").unwrap(), None);
        let err = normalize_optional_email(Some("nope".into()), "rights_holder_email").unwrap_err();
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.details()["field"], "rights_holder_email");
    }

    #[test]
    fn required_trims_and_rejects_blank() {
        assert_eq!(normalize_required("  Title ", "title").unwrap(), "Title");
        let err = normalize_required("   ", "title").unwrap_err();
        assert_eq!(err.code(), "VALIDATION_ERROR");
        assert_eq!(err.message(), "Title cannot be blank");
        assert_eq!(err.details()["field"], "title");
    }

    #[test]
    fn optional_blank_is_none() {
        assert_eq!(normalize_optional(Some("  ".into())), None);
        assert_eq!(normalize_optional(Some(" x ".into())).as_deref(), Some("x"));
        assert_eq!(normalize_optional(None), None);
    }
}
