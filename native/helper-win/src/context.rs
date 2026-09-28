// The app you're in and the text you've selected — filled in by WIN-013 (foreground window,
// UI Automation, Ctrl+C fallback). Until then `app` is null rather than the Swift helper's
// empty object: main.js skips a null app, where an empty one would show a nameless app chip.

use serde_json::Value;

pub fn frontmost_app() -> Value {
    Value::Null
}

pub fn selected_text() -> Option<String> {
    None
}
