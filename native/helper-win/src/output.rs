// Every line to main goes through one writer thread. The keyboard hook only queues its line:
// if main were slow to read and the pipe filled, a blocking write inside the hook would stall
// everyone's typing, and Windows removes hooks that keep missing its timeout.

use std::io::Write;
use std::sync::mpsc::{self, Sender};
use std::sync::OnceLock;
use std::thread;

use serde_json::Value;

static SENDER: OnceLock<Sender<String>> = OnceLock::new();

pub fn start() {
    let (tx, rx) = mpsc::channel::<String>();
    if SENDER.set(tx).is_err() {
        return;
    }
    thread::Builder::new()
        .name("output".into())
        .spawn(move || {
            let stdout = std::io::stdout();
            for line in rx {
                let mut out = stdout.lock();
                // Flushed per line: main acts on each event as it arrives.
                if writeln!(out, "{line}").and_then(|_| out.flush()).is_err() {
                    // Promptly is gone (broken pipe).
                    std::process::exit(0);
                }
            }
        })
        .expect("output thread");
}

pub fn emit(message: Value) {
    if let Some(tx) = SENDER.get() {
        let _ = tx.send(message.to_string());
    }
}
