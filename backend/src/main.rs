//! Music Licensing Workflow API.
//!
//! Executable commands: `migrate`, `seed`, `serve`.

mod api;
mod application;
mod domain;
mod infrastructure;

use std::process::ExitCode;

fn main() -> ExitCode {
    let command = std::env::args().nth(1).unwrap_or_else(|| "serve".to_string());

    match command.as_str() {
        "migrate" => todo!("apply SQL migrations"),
        "seed" => todo!("apply the deterministic development seed"),
        "serve" => todo!("start the HTTP server"),
        other => {
            eprintln!("unknown command: {other}");
            eprintln!("usage: music-licensing-api <migrate|seed|serve>");
            ExitCode::FAILURE
        }
    }
}
