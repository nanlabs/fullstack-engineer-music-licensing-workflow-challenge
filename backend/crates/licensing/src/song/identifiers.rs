//! Industry identifiers of a song, normalized and validated.
//!
//! - **ISRC** (ISO 3901) identifies a recording: 12 characters, printed as
//!   `CC-XXX-YY-NNNNN`. Positions 1–2 are letters (the prefix, historically
//!   the country), 3–5 letters or digits (the registrant), 6–7 digits (year
//!   of reference) and 8–12 digits (designation). Hyphens and spaces are
//!   presentation only.
//! - **ISWC** (ISO 15707) identifies the underlying work: `T`, nine digits
//!   and a check digit, printed as `T-DDD.DDD.DDD-C`. The check digit is
//!   `C = (10 - S mod 10) mod 10` with `S = 1 + Σ i·dᵢ` for `i = 1..9`.
//!
//! Both are stored upper case without separators, so the partial unique
//! index on ISRC compares the canonical form.

use errx::AppError;

const ISRC_MESSAGE: &str = "ISRC must be 12 characters: two letters, three letters or digits, seven digits";
const ISWC_MESSAGE: &str = "ISWC must be T followed by nine digits and a valid check digit";

/// Upper-cases and drops whitespace plus the given separators.
fn canonical(raw: &str, separators: &[char]) -> String {
    raw.chars()
        .filter(|c| !c.is_whitespace() && !separators.contains(c))
        .flat_map(char::to_uppercase)
        .collect()
}

pub fn normalize_isrc(raw: &str) -> Result<String, AppError> {
    let code = canonical(raw, &['-']);
    let b = code.as_bytes();
    let valid = b.len() == 12
        && b[..2].iter().all(u8::is_ascii_uppercase)
        && b[2..5].iter().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        && b[5..].iter().all(u8::is_ascii_digit);
    if valid {
        Ok(code)
    } else {
        Err(AppError::validation(ISRC_MESSAGE).detail("field", "isrc"))
    }
}

pub fn normalize_iswc(raw: &str) -> Result<String, AppError> {
    let code = canonical(raw, &['-', '.']);
    let b = code.as_bytes();
    let valid = b.len() == 11
        && b[0] == b'T'
        && b[1..].iter().all(u8::is_ascii_digit)
        && iswc_check_digit(&b[1..10]) == b[10] - b'0';
    if valid {
        Ok(code)
    } else {
        Err(AppError::validation(ISWC_MESSAGE).detail("field", "iswc"))
    }
}

/// ISO 15707 check digit for the nine work digits (ASCII `0`-`9`).
fn iswc_check_digit(digits: &[u8]) -> u8 {
    let weighted: u32 = digits
        .iter()
        .enumerate()
        .map(|(i, d)| (i as u32 + 1) * u32::from(d - b'0'))
        .sum();
    ((10 - (1 + weighted) % 10) % 10) as u8
}

/// Applies a normalizer to an optional raw value; blank means "no value".
pub fn normalize_optional_with(
    raw: Option<String>,
    normalize: fn(&str) -> Result<String, AppError>,
) -> Result<Option<String>, AppError> {
    match raw.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(value) => normalize(value).map(Some),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isrc_is_normalized() {
        assert_eq!(normalize_isrc("gb-aaa-24-00001").unwrap(), "GBAAA2400001");
        assert_eq!(normalize_isrc(" QZ ACM 23 00017 ").unwrap(), "QZACM2300017");
        // IFPI's own example.
        assert_eq!(normalize_isrc("AA-6QZ-20-00047").unwrap(), "AA6QZ2000047");
    }

    #[test]
    fn isrc_shape_is_enforced() {
        for bad in [
            "",
            "GBAAA24000",
            "GBAAA24000011",
            "1BAAA2400001",
            "GBAAA2A00001",
            "GBAAA240000A",
            "GB-ÄAA-24-00001",
        ] {
            let err = normalize_isrc(bad).unwrap_err();
            assert_eq!(err.code(), "VALIDATION_ERROR", "{bad}");
            assert_eq!(err.details()["field"], "isrc", "{bad}");
        }
    }

    #[test]
    fn iswc_is_normalized_and_check_digit_verified() {
        // Worked example of the standard.
        assert_eq!(normalize_iswc("T-034.524.680-1").unwrap(), "T0345246801");
        assert_eq!(normalize_iswc("t0345246801").unwrap(), "T0345246801");
        assert_eq!(normalize_iswc("T-123456789-4").unwrap(), "T1234567894");
        for bad in [
            "T-034.524.680-2",
            "T910234567X",
            "034524680-1",
            "T03452468",
            "",
            "T-000.000.000-0",
            "T-000.000.000-1",
        ] {
            let err = normalize_iswc(bad).unwrap_err();
            assert_eq!(err.code(), "VALIDATION_ERROR", "{bad}");
            assert_eq!(err.details()["field"], "iswc", "{bad}");
        }
        // All zeros: S = 1, so the check digit is 9.
        assert_eq!(normalize_iswc("T-000.000.000-9").unwrap(), "T0000000009");
    }

    #[test]
    fn optional_blank_is_none() {
        assert_eq!(normalize_optional_with(None, normalize_isrc).unwrap(), None);
        assert_eq!(
            normalize_optional_with(Some("  ".into()), normalize_isrc).unwrap(),
            None
        );
        assert_eq!(
            normalize_optional_with(Some("gb-aaa-24-00001".into()), normalize_isrc).unwrap(),
            Some("GBAAA2400001".into())
        );
        assert!(normalize_optional_with(Some("nope".into()), normalize_iswc).is_err());
    }
}
