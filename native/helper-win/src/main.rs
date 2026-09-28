// promptly-helper.exe — the Windows twin of native/helper/main.swift, for the things Electron
// can't do on its own:
//   • hold-to-talk: sees the hotkey go down AND up (Electron's globalShortcut only sees presses)
//   • the app you're in and the text you've selected (context.rs: UI Automation, then a Ctrl+C
//     that puts your clipboard back)
//   • typing dictation into the app you're in (paste.rs)
// It speaks the same JSON lines on stdin/stdout as the Swift helper (see main/helper.js and
// protocol.rs). The GUI subsystem keeps a console window from flashing up; Promptly talks to
// it over pipes, which work the same without a console.
#![cfg_attr(windows, windows_subsystem = "windows")]
// Built elsewhere only for `cargo test`; without the Windows hook the engine looks unused.
#![cfg_attr(not(windows), allow(dead_code))]

mod apps;
mod clipboard;
mod clock;
mod context;
mod engine;
mod hook;
mod keys;
mod output;
mod paste;
mod protocol;
mod uia;

use std::io::BufRead;

fn main() {
    // Setup runs `promptly-helper.exe --version` to check antivirus hasn't blocked it.
    if std::env::args().skip(1).any(|arg| arg == "--version") {
        println!("promptly-helper {}", env!("CARGO_PKG_VERSION"));
        return;
    }

    clock::init();
    output::start();
    hook::start();
    output::emit(protocol::ready());

    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some(reply) = protocol::handle_request(line) {
            output::emit(reply);
        }
    }
    // Promptly quit: stdin closed.
    std::process::exit(0);
}
