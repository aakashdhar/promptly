// Milliseconds since the helper started: the double-tap timings and the `t` on hotkey events.

use std::sync::OnceLock;
use std::time::Instant;

fn start() -> Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    *START.get_or_init(Instant::now)
}

// Called first thing in main so `t` counts from launch, not from the first key press.
pub fn init() {
    start();
}

// Only the Windows hook reads the clock; a Mac build is for tests.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn now_ms() -> u64 {
    u64::try_from(start().elapsed().as_millis()).unwrap_or(u64::MAX)
}
