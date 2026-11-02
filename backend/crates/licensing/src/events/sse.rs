//! The `text/event-stream` wire format (WHATWG HTML, "Server-sent events").
//!
//! A message is a group of `field: value` lines ended by a blank line. The
//! browser dispatches a message only if it has `data`; `id` sets the value
//! sent back as `Last-Event-ID` on reconnect and stays set until the next
//! `id`; `retry` sets the reconnection delay; a line starting with `:` is a
//! comment, which is how keep-alives travel without touching the client's
//! cursor. Five fields do not justify a dependency.

use std::time::Duration;

use actix_web::web::Bytes;

/// A message of type `event` with a JSON payload. `json` is emitted one
/// `data:` line per line (the client joins them with `\n`); `id` is the
/// stream cursor and is left out of messages that must not move it.
pub fn data(event: &str, id: Option<i64>, json: &str) -> Bytes {
    let mut out = String::with_capacity(json.len() + 48);
    out.push_str("event: ");
    out.push_str(event);
    out.push('\n');
    if let Some(id) = id {
        out.push_str("id: ");
        out.push_str(&id.to_string());
        out.push('\n');
    }
    for line in json.lines() {
        out.push_str("data: ");
        out.push_str(line);
        out.push('\n');
    }
    out.push('\n');
    Bytes::from(out)
}

/// A comment line: ignored by the client, keeps the connection alive.
pub fn comment(text: &str) -> Bytes {
    Bytes::from(format!(": {text}\n\n"))
}

/// Sets the client's reconnection delay. Dispatches nothing.
pub fn retry(after: Duration) -> Bytes {
    Bytes::from(format!("retry: {}\n\n", after.as_millis()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_message_has_event_id_and_data_lines() {
        let frame = data("license.changed", Some(42), r#"{"a":1}"#);
        assert_eq!(&frame[..], b"event: license.changed\nid: 42\ndata: {\"a\":1}\n\n");
    }

    #[test]
    fn id_is_omitted_when_none_and_multiline_data_is_split() {
        let frame = data("resync", None, "line one\nline two");
        assert_eq!(&frame[..], b"event: resync\ndata: line one\ndata: line two\n\n");
    }

    #[test]
    fn comments_and_retry_dispatch_nothing() {
        assert_eq!(&comment("keep-alive")[..], b": keep-alive\n\n");
        assert_eq!(&retry(Duration::from_secs(3))[..], b"retry: 3000\n\n");
    }
}
