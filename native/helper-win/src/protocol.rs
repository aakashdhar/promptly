// The JSON lines Promptly's main process speaks (main/helper.js). Messages and fields match
// native/helper/main.swift exactly; the only addition is `t` on hotkey events, which main may
// ignore. Never change a message here without changing the Swift helper too.

use serde_json::{json, Value};

use crate::engine::{self, Hotkey, Phase, ALT, CONTROL, SHIFT, WIN};
use crate::{context, hook, paste};

// A descriptor from main/hotkey.js WINDOWS_PRESETS, e.g.
// { keyCode: 0x20, modifiers: ['alt'], modifierOnly: false }. Missing fields take the Swift
// helper's defaults (Space, no modifiers, not modifier-only, not double-tap).
pub fn parse_hotkey(value: &Value) -> Hotkey {
    let modifiers = value
        .get("modifiers")
        .and_then(Value::as_array)
        .map(|names| {
            names.iter().filter_map(Value::as_str).fold(0u8, |acc, name| {
                acc | match name {
                    "control" => CONTROL,
                    "alt" => ALT,
                    "shift" => SHIFT,
                    "win" => WIN,
                    _ => 0,
                }
            })
        })
        .unwrap_or(0);
    Hotkey {
        key_code: value
            .get("keyCode")
            .and_then(Value::as_u64)
            .and_then(|code| u32::try_from(code).ok())
            .unwrap_or(engine::VK_SPACE),
        modifiers,
        modifier_only: value.get("modifierOnly").and_then(Value::as_bool).unwrap_or(false),
        double_tap: value.get("doubleTap").and_then(Value::as_bool).unwrap_or(false),
    }
}

// Windows needs no permission to watch the keyboard, so `trusted` is always true; `tap` says
// whether the keyboard hook is in place.
pub fn status(kind: &str, tap: bool, id: Option<Value>) -> Value {
    let mut message = json!({ "type": kind, "trusted": true, "tap": tap });
    if let Some(id) = id {
        message["id"] = id;
    }
    message
}

// `t` is milliseconds since the helper started, so main can log key-down → recording delay.
pub fn hotkey_event(phase: Phase, t: u64) -> Value {
    json!({ "type": "hotkey", "phase": phase.as_str(), "t": t })
}

// One request line in, its reply out (None for a line that isn't a request, as in Swift).
pub fn handle_request(line: &str) -> Option<Value> {
    let request: Value = serde_json::from_str(line).ok()?;
    let cmd = request.get("cmd")?.as_str()?;
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let reply = match cmd {
        "configure" => {
            if let Some(key) = request.get("hotkey").filter(|key| key.is_object()) {
                let hotkey = parse_hotkey(key);
                engine::shared()
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .configure(hotkey);
            }
            status("status", hook::is_live(), Some(id))
        }
        "context" => {
            let context = context::read();
            json!({
                "type": "context",
                "id": id,
                "app": context.app,
                "selectedText": context.selected_text.map_or(Value::Null, Value::String),
            })
        }
        "paste" => pasted(paste::paste_into_front_app(), id),
        // Nothing to ask for on Windows; reply with the status like the Mac does after prompting.
        "status" | "requestAccess" => status("status", hook::is_live(), Some(id)),
        other => json!({ "type": "error", "id": id, "message": format!("unknown command {other}") }),
    };
    Some(reply)
}

// Swift's { type: 'pasted', id, ok }; a failed paste may add why ('elevated'), which main can
// show instead of a bare "press Ctrl+V".
pub fn pasted(result: paste::Pasted, id: Value) -> Value {
    let mut message = json!({ "type": "pasted", "id": id, "ok": result.ok });
    if let Some(reason) = result.reason {
        message["reason"] = Value::from(reason);
    }
    message
}

pub fn ready() -> Value {
    status("ready", hook::is_live(), None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{VK_CONTROL, VK_RMENU};

    #[test]
    fn parses_every_windows_preset() {
        // The helper descriptors from main/hotkey.js WINDOWS_PRESETS.
        let double =
            parse_hotkey(&json!({ "keyCode": 0x11, "modifiers": [], "modifierOnly": true, "doubleTap": true }));
        assert_eq!(
            double,
            Hotkey {
                key_code: VK_CONTROL,
                modifiers: 0,
                modifier_only: true,
                double_tap: true
            }
        );
        let alt_space = parse_hotkey(&json!({ "keyCode": 0x20, "modifiers": ["alt"], "modifierOnly": false }));
        assert_eq!(
            alt_space,
            Hotkey {
                key_code: 0x20,
                modifiers: ALT,
                modifier_only: false,
                double_tap: false
            }
        );
        let right_alt = parse_hotkey(&json!({ "keyCode": 0xA5, "modifiers": [], "modifierOnly": true }));
        assert_eq!(
            right_alt,
            Hotkey {
                key_code: VK_RMENU,
                modifiers: 0,
                modifier_only: true,
                double_tap: false
            }
        );
        let ctrl_alt =
            parse_hotkey(&json!({ "keyCode": 0x20, "modifiers": ["control", "alt"], "modifierOnly": false }));
        assert_eq!(ctrl_alt.modifiers, CONTROL | ALT);
        let ctrl_shift =
            parse_hotkey(&json!({ "keyCode": 0x20, "modifiers": ["control", "shift"], "modifierOnly": false }));
        assert_eq!(ctrl_shift.modifiers, CONTROL | SHIFT);
    }

    #[test]
    fn missing_fields_take_the_swift_defaults() {
        assert_eq!(
            parse_hotkey(&json!({})),
            Hotkey {
                key_code: 0x20,
                modifiers: 0,
                modifier_only: false,
                double_tap: false
            }
        );
        // Mac names from a copied config are ignored rather than guessed at.
        assert_eq!(
            parse_hotkey(&json!({ "modifiers": ["option", "command"] })).modifiers,
            0
        );
    }

    #[test]
    fn status_and_ready_have_the_swift_fields() {
        assert_eq!(
            ready(),
            json!({ "type": "ready", "trusted": true, "tap": hook::is_live() })
        );
        assert_eq!(
            handle_request(r#"{"cmd":"status","id":7}"#).unwrap(),
            json!({ "type": "status", "id": 7, "trusted": true, "tap": hook::is_live() })
        );
        assert_eq!(
            handle_request(r#"{"cmd":"requestAccess","id":8}"#).unwrap(),
            json!({ "type": "status", "id": 8, "trusted": true, "tap": hook::is_live() })
        );
    }

    #[test]
    fn configure_applies_the_hotkey_and_replies_with_status() {
        let reply =
            handle_request(r#"{"cmd":"configure","id":1,"hotkey":{"keyCode":165,"modifiers":[],"modifierOnly":true}}"#)
                .unwrap();
        assert_eq!(
            reply,
            json!({ "type": "status", "id": 1, "trusted": true, "tap": hook::is_live() })
        );
        let hotkey = engine::shared().lock().unwrap().hotkey();
        assert_eq!(hotkey.key_code, VK_RMENU);
        assert!(hotkey.modifier_only);
    }

    #[test]
    fn hotkey_events_carry_phase_and_time() {
        assert_eq!(
            hotkey_event(Phase::Down, 1234),
            json!({ "type": "hotkey", "phase": "down", "t": 1234 })
        );
    }

    #[test]
    fn context_and_paste_reply_in_the_swift_shape() {
        let context = handle_request(r#"{"cmd":"context","id":2}"#).unwrap();
        assert_eq!(context["type"], "context");
        assert_eq!(context["id"], 2);
        assert!(context.get("app").is_some());
        assert!(context.get("selectedText").is_some());
        let pasted = handle_request(r#"{"cmd":"paste","id":3}"#).unwrap();
        assert_eq!(pasted["type"], "pasted");
        assert_eq!(pasted["id"], 3);
        assert!(pasted["ok"].is_boolean());
    }

    #[test]
    fn a_blocked_paste_says_why() {
        assert_eq!(
            pasted(
                paste::Pasted {
                    ok: false,
                    reason: Some("elevated")
                },
                json!(9)
            ),
            json!({ "type": "pasted", "id": 9, "ok": false, "reason": "elevated" })
        );
        assert_eq!(
            pasted(paste::Pasted { ok: true, reason: None }, json!(10)),
            json!({ "type": "pasted", "id": 10, "ok": true })
        );
    }

    #[test]
    fn unknown_and_malformed_lines() {
        assert_eq!(
            handle_request(r#"{"cmd":"fly","id":4}"#).unwrap(),
            json!({ "type": "error", "id": 4, "message": "unknown command fly" })
        );
        assert_eq!(handle_request(r#"{"cmd":"fly"}"#).unwrap()["id"], Value::Null);
        assert!(handle_request("not json").is_none());
        assert!(handle_request(r#"{"id":5}"#).is_none());
    }
}
