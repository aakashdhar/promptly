// The hotkey state machine: raw key and mouse events in, `hotkey` phases out. No Windows calls
// here, so `cargo test` runs it on any machine; src/hook.rs feeds it from the keyboard hook.
// The rules and timings are the Swift helper's (native/helper/main.swift), translated from
// macOS flag changes to Windows key-down / key-up events.

use std::sync::{Mutex, OnceLock};

// Windows virtual-key codes. The low-level hook reports the left/right variants; the generic
// ones (VK_CONTROL …) only appear in hotkey descriptors, where they mean "either side".
pub const VK_SHIFT: u32 = 0x10;
pub const VK_CONTROL: u32 = 0x11;
pub const VK_MENU: u32 = 0x12;
pub const VK_SPACE: u32 = 0x20;
pub const VK_LWIN: u32 = 0x5B;
pub const VK_RWIN: u32 = 0x5C;
pub const VK_LSHIFT: u32 = 0xA0;
pub const VK_RSHIFT: u32 = 0xA1;
pub const VK_LCONTROL: u32 = 0xA2;
pub const VK_RCONTROL: u32 = 0xA3;
pub const VK_LMENU: u32 = 0xA4;
pub const VK_RMENU: u32 = 0xA5;

pub const CONTROL: u8 = 1;
pub const ALT: u8 = 2;
pub const SHIFT: u8 = 4;
pub const WIN: u8 = 8;

// Same timings as the Swift helper, so double-tap feels the same on both systems.
pub const TAP_MAX_HOLD_MS: u64 = 350; // longer than this is a hold, not a tap
pub const DOUBLE_TAP_WINDOW_MS: u64 = 400; // max gap between the two taps

// On AltGr layouts (German, French, …) Windows sends a made-up left Ctrl with this scan code
// just before right Alt. Dropping it makes AltGr plain right Alt, as main/hotkey.js promises.
pub const ALTGR_FAKE_CTRL_SCAN: u32 = 0x21D;

pub fn is_altgr_fake_ctrl(vk: u32, scan_code: u32) -> bool {
    vk == VK_LCONTROL && scan_code == ALTGR_FAKE_CTRL_SCAN
}

pub fn modifier_bit(vk: u32) -> Option<u8> {
    match vk {
        VK_CONTROL | VK_LCONTROL | VK_RCONTROL => Some(CONTROL),
        VK_MENU | VK_LMENU | VK_RMENU => Some(ALT),
        VK_SHIFT | VK_LSHIFT | VK_RSHIFT => Some(SHIFT),
        VK_LWIN | VK_RWIN => Some(WIN),
        _ => None,
    }
}

// Does an event's key count as the descriptor's key? A generic modifier matches either side.
pub fn vk_matches(target: u32, vk: u32) -> bool {
    match target {
        VK_CONTROL => matches!(vk, VK_CONTROL | VK_LCONTROL | VK_RCONTROL),
        VK_MENU => matches!(vk, VK_MENU | VK_LMENU | VK_RMENU),
        VK_SHIFT => matches!(vk, VK_SHIFT | VK_LSHIFT | VK_RSHIFT),
        _ => target == vk,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Hotkey {
    pub key_code: u32,
    pub modifiers: u8,
    pub modifier_only: bool, // e.g. right Alt held on its own
    pub double_tap: bool,    // double-tap Ctrl: either Ctrl key
}

impl Default for Hotkey {
    // Alt+Space, the Windows stand-in that works everywhere, until main sends `configure`.
    fn default() -> Self {
        Hotkey {
            key_code: VK_SPACE,
            modifiers: ALT,
            modifier_only: false,
            double_tap: false,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    Down,
    Up,
    Cancel,
    Tap,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Down => "down",
            Phase::Up => "up",
            Phase::Cancel => "cancel",
            Phase::Tap => "tap",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Input {
    KeyDown(u32),
    KeyUp(u32),
    MouseDown,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Outcome {
    pub phase: Option<Phase>,
    // Promptly owns this key press: don't let the app you're in type it.
    pub swallow: bool,
    // Alt or Win went down and up with nothing else seen in between (we swallowed the key, or
    // the hold was Alt on its own), which Windows would take as "open the menu bar" / "open
    // Start". The hook presses an unassigned key to mask that.
    pub mask: bool,
}

// Double-tap state. A tap is a quick, clean press and release of Ctrl: no other key, mouse
// click or modifier in between (so Ctrl+C and Ctrl-click never count).
#[derive(Clone, Copy, Debug, Default)]
struct DoubleTap {
    down: bool,
    pressed_at: u64,
    clean: bool,
    last_tap_at: Option<u64>, // release time of the previous clean tap
    second_press: bool,       // this press is the second of a double tap
}

#[derive(Debug)]
pub struct Engine {
    hotkey: Hotkey,
    held: [u64; 4], // every virtual key that is down, as a 256-bit set
    hotkey_down: bool,
    dt: DoubleTap,
}

impl Default for Engine {
    fn default() -> Self {
        Engine::new(Hotkey::default())
    }
}

impl Engine {
    pub fn new(hotkey: Hotkey) -> Self {
        Engine {
            hotkey,
            held: [0; 4],
            hotkey_down: false,
            dt: DoubleTap::default(),
        }
    }

    #[cfg(test)]
    pub fn hotkey(&self) -> Hotkey {
        self.hotkey
    }

    // A new hotkey starts from scratch, like the Swift helper's configure.
    pub fn configure(&mut self, hotkey: Hotkey) {
        self.hotkey = hotkey;
        self.hotkey_down = false;
        self.dt = DoubleTap::default();
    }

    fn is_held(&self, vk: u32) -> bool {
        vk < 256 && self.held[(vk / 64) as usize] & (1u64 << (vk % 64)) != 0
    }

    fn set_held(&mut self, vk: u32, down: bool) {
        if vk >= 256 {
            return;
        }
        let bit = 1u64 << (vk % 64);
        if down {
            self.held[(vk / 64) as usize] |= bit;
        } else {
            self.held[(vk / 64) as usize] &= !bit;
        }
    }

    fn held_keys(&self) -> impl Iterator<Item = u32> + '_ {
        (0u32..256).filter(move |&vk| self.is_held(vk))
    }

    pub fn modifiers(&self) -> u8 {
        self.held_keys().filter_map(modifier_bit).fold(0, |acc, bit| acc | bit)
    }

    fn any_held_matching(&self, target: u32) -> bool {
        self.held_keys().any(|vk| vk_matches(target, vk))
    }

    // Our hook never sees key-ups that happen while an elevated window or the secure desktop
    // has focus, so a key could look held forever. The hook passes the system's view here
    // before each key-down; keys the system says are up are forgotten (never added).
    pub fn release_stale(&mut self, is_down: impl Fn(u32) -> bool, except: u32) {
        let stale: Vec<u32> = self.held_keys().filter(|&vk| vk != except && !is_down(vk)).collect();
        for vk in stale {
            self.set_held(vk, false);
        }
    }

    pub fn handle(&mut self, input: Input, now_ms: u64) -> Outcome {
        let repeat = match input {
            Input::KeyDown(vk) => {
                let repeat = self.is_held(vk);
                self.set_held(vk, true);
                repeat
            }
            Input::KeyUp(vk) => {
                self.set_held(vk, false);
                false
            }
            Input::MouseDown => false,
        };
        if self.hotkey.double_tap {
            // Ctrl still works normally everywhere.
            Outcome {
                phase: self.double_tap(input, now_ms),
                ..Outcome::default()
            }
        } else if self.hotkey.modifier_only {
            self.modifier_only(input)
        } else {
            self.combo(input, repeat)
        }
    }

    fn reset_double_tap(&mut self) -> Option<Phase> {
        self.dt.last_tap_at = None;
        self.dt.clean = false;
        if self.dt.second_press {
            self.dt.second_press = false;
            return Some(Phase::Cancel);
        }
        None
    }

    // Double-tap Ctrl → "down" on the second press and "up" on its release (so double-tap and
    // hold is hold to talk). Any other single clean tap → "tap", which Promptly uses to stop.
    fn double_tap(&mut self, input: Input, now: u64) -> Option<Phase> {
        match input {
            Input::KeyDown(vk) | Input::KeyUp(vk) if modifier_bit(vk).is_some() => {
                if modifier_bit(vk) != Some(CONTROL) {
                    // Another modifier: not a clean Ctrl tap.
                    if self.dt.down {
                        self.dt.clean = false;
                    }
                    return self.reset_double_tap();
                }
                let mods = self.modifiers();
                let pressed = mods & CONTROL != 0;
                if pressed && !self.dt.down {
                    self.dt.down = true;
                    self.dt.pressed_at = now;
                    self.dt.clean = mods & (ALT | SHIFT | WIN) == 0;
                    if self.dt.clean {
                        if let Some(last) = self.dt.last_tap_at {
                            if now.saturating_sub(last) <= DOUBLE_TAP_WINDOW_MS {
                                self.dt.second_press = true;
                                self.dt.last_tap_at = None;
                                return Some(Phase::Down);
                            }
                        }
                    }
                } else if !pressed && self.dt.down {
                    self.dt.down = false;
                    if self.dt.second_press {
                        self.dt.second_press = false;
                        return Some(Phase::Up);
                    } else if self.dt.clean && now.saturating_sub(self.dt.pressed_at) <= TAP_MAX_HOLD_MS {
                        self.dt.last_tap_at = Some(now);
                        return Some(Phase::Tap);
                    } else {
                        self.dt.last_tap_at = None;
                    }
                }
                None
            }
            Input::KeyDown(_) | Input::MouseDown => {
                // Typing or clicking: Ctrl was part of something else (Ctrl+C, Ctrl-click).
                if self.dt.down {
                    self.dt.clean = false;
                }
                self.reset_double_tap()
            }
            Input::KeyUp(_) => None,
        }
    }

    fn modifier_only(&mut self, input: Input) -> Outcome {
        match input {
            Input::KeyDown(vk) | Input::KeyUp(vk) if vk_matches(self.hotkey.key_code, vk) => {
                let pressed = self.any_held_matching(self.hotkey.key_code);
                if pressed && !self.hotkey_down {
                    self.hotkey_down = true;
                    let mask = matches!(modifier_bit(vk), Some(ALT) | Some(WIN));
                    return Outcome {
                        phase: Some(Phase::Down),
                        swallow: false,
                        mask,
                    };
                } else if !pressed && self.hotkey_down {
                    self.hotkey_down = false;
                    return Outcome {
                        phase: Some(Phase::Up),
                        ..Outcome::default()
                    };
                }
                Outcome::default()
            }
            Input::KeyDown(vk) if self.hotkey_down && modifier_bit(vk).is_none() => {
                // The modifier is being used for a shortcut or a special character, not to talk.
                // Other modifiers don't count, as on the Mac (and AltGr's own Ctrl is dropped).
                self.hotkey_down = false;
                Outcome {
                    phase: Some(Phase::Cancel),
                    ..Outcome::default()
                }
            }
            // Never swallow modifier changes.
            _ => Outcome::default(),
        }
    }

    fn combo(&mut self, input: Input, repeat: bool) -> Outcome {
        match input {
            Input::KeyDown(vk) if vk_matches(self.hotkey.key_code, vk) => {
                if self.modifiers() != self.hotkey.modifiers {
                    return Outcome::default();
                }
                let mut outcome = Outcome {
                    swallow: true,
                    ..Outcome::default()
                };
                if !repeat && !self.hotkey_down {
                    self.hotkey_down = true;
                    outcome.phase = Some(Phase::Down);
                    outcome.mask = self.hotkey.modifiers & (ALT | WIN) != 0;
                }
                // Promptly owns this key, repeats included: don't type it.
                outcome
            }
            Input::KeyUp(vk) if vk_matches(self.hotkey.key_code, vk) && self.hotkey_down => {
                self.hotkey_down = false;
                Outcome {
                    phase: Some(Phase::Up),
                    swallow: true,
                    mask: false,
                }
            }
            _ => Outcome::default(),
        }
    }
}

// One engine for the process: the stdin thread configures it, the hook thread drives it.
pub fn shared() -> &'static Mutex<Engine> {
    static ENGINE: OnceLock<Mutex<Engine>> = OnceLock::new();
    ENGINE.get_or_init(|| Mutex::new(Engine::default()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn double_ctrl() -> Engine {
        Engine::new(Hotkey {
            key_code: VK_CONTROL,
            modifiers: 0,
            modifier_only: true,
            double_tap: true,
        })
    }

    fn right_alt() -> Engine {
        Engine::new(Hotkey {
            key_code: VK_RMENU,
            modifiers: 0,
            modifier_only: true,
            double_tap: false,
        })
    }

    fn combo(key_code: u32, modifiers: u8) -> Engine {
        Engine::new(Hotkey {
            key_code,
            modifiers,
            modifier_only: false,
            double_tap: false,
        })
    }

    // Feeds events at the given times and collects the phases that came out.
    fn run(engine: &mut Engine, events: &[(Input, u64)]) -> Vec<Phase> {
        events
            .iter()
            .filter_map(|&(input, t)| engine.handle(input, t).phase)
            .collect()
    }

    use Input::{KeyDown as D, KeyUp as U, MouseDown as M};
    use Phase::{Cancel, Down, Tap, Up};

    #[test]
    fn single_quick_ctrl_tap_is_a_tap() {
        let mut e = double_ctrl();
        assert_eq!(run(&mut e, &[(D(VK_LCONTROL), 0), (U(VK_LCONTROL), 120)]), vec![Tap]);
    }

    #[test]
    fn double_tap_ctrl_gives_down_then_up_on_release() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 100),
                (D(VK_LCONTROL), 300),
                (U(VK_LCONTROL), 2000),
            ],
        );
        assert_eq!(phases, vec![Tap, Down, Up]);
    }

    #[test]
    fn either_ctrl_key_counts_for_each_tap() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 80),
                (D(VK_RCONTROL), 200),
                (U(VK_RCONTROL), 260),
            ],
        );
        assert_eq!(phases, vec![Tap, Down, Up]);
    }

    #[test]
    fn second_tap_after_the_window_is_just_another_tap() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 100),
                (D(VK_LCONTROL), 100 + DOUBLE_TAP_WINDOW_MS + 1),
                (U(VK_LCONTROL), 600),
            ],
        );
        assert_eq!(phases, vec![Tap, Tap]);
    }

    #[test]
    fn second_tap_exactly_at_the_window_edge_still_counts() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 100),
                (D(VK_LCONTROL), 100 + DOUBLE_TAP_WINDOW_MS),
            ],
        );
        assert_eq!(phases, vec![Tap, Down]);
    }

    #[test]
    fn a_long_press_is_not_a_tap_and_breaks_the_double() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), TAP_MAX_HOLD_MS + 1),
                (D(VK_LCONTROL), TAP_MAX_HOLD_MS + 50),
                (U(VK_LCONTROL), TAP_MAX_HOLD_MS + 100),
            ],
        );
        // The first press was a hold, so the second is only a first tap.
        assert_eq!(phases, vec![Tap]);
    }

    #[test]
    fn held_ctrl_autorepeat_is_one_press() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (D(VK_LCONTROL), 30),
                (D(VK_LCONTROL), 60),
                (U(VK_LCONTROL), 90),
            ],
        );
        assert_eq!(phases, vec![Tap]);
    }

    #[test]
    fn ctrl_c_is_never_a_tap() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (D(0x43), 40),
                (U(0x43), 60),
                (U(VK_LCONTROL), 80),
                (D(VK_LCONTROL), 150),
                (U(VK_LCONTROL), 200),
            ],
        );
        assert_eq!(phases, vec![Tap]);
    }

    #[test]
    fn ctrl_click_is_never_a_tap() {
        let mut e = double_ctrl();
        let phases = run(&mut e, &[(D(VK_LCONTROL), 0), (M, 40), (U(VK_LCONTROL), 80)]);
        assert!(phases.is_empty());
    }

    #[test]
    fn typing_between_the_taps_breaks_the_double() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 50),
                (D(0x41), 100),
                (D(VK_LCONTROL), 200),
                (U(VK_LCONTROL), 250),
            ],
        );
        assert_eq!(phases, vec![Tap, Tap]);
    }

    #[test]
    fn ctrl_with_another_modifier_is_not_clean() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LSHIFT), 0),
                (D(VK_LCONTROL), 10),
                (U(VK_LCONTROL), 60),
                (U(VK_LSHIFT), 70),
            ],
        );
        assert!(phases.is_empty());
    }

    #[test]
    fn altgr_is_another_modifier_not_ctrl() {
        // The hook drops AltGr's made-up Ctrl, so only right Alt reaches the engine.
        assert!(is_altgr_fake_ctrl(VK_LCONTROL, 0x21D));
        assert!(!is_altgr_fake_ctrl(VK_LCONTROL, 0x1D));
        assert!(!is_altgr_fake_ctrl(VK_RMENU, 0x21D));
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 50),
                (D(VK_RMENU), 100),
                (U(VK_RMENU), 150),
                (D(VK_LCONTROL), 200),
            ],
        );
        assert_eq!(phases, vec![Tap]);
    }

    #[test]
    fn a_key_during_double_tap_hold_cancels() {
        let mut e = double_ctrl();
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (U(VK_LCONTROL), 50),
                (D(VK_LCONTROL), 150),
                (D(0x56), 400),
                (U(VK_LCONTROL), 500),
            ],
        );
        assert_eq!(phases, vec![Tap, Down, Cancel]);
    }

    #[test]
    fn double_tap_never_swallows_or_masks() {
        let mut e = double_ctrl();
        for (input, t) in [
            (D(VK_LCONTROL), 0),
            (U(VK_LCONTROL), 50),
            (D(VK_LCONTROL), 100),
            (U(VK_LCONTROL), 150),
        ] {
            let out = e.handle(input, t);
            assert!(!out.swallow && !out.mask);
        }
    }

    #[test]
    fn right_alt_hold_gives_down_and_up_and_masks_the_menu() {
        let mut e = right_alt();
        let down = e.handle(D(VK_RMENU), 0);
        assert_eq!(
            down,
            Outcome {
                phase: Some(Down),
                swallow: false,
                mask: true
            }
        );
        assert_eq!(e.handle(D(VK_RMENU), 30).phase, None); // autorepeat
        let up = e.handle(U(VK_RMENU), 900);
        assert_eq!(
            up,
            Outcome {
                phase: Some(Up),
                swallow: false,
                mask: false
            }
        );
    }

    #[test]
    fn left_alt_is_not_right_alt() {
        let mut e = right_alt();
        assert!(run(&mut e, &[(D(VK_LMENU), 0), (U(VK_LMENU), 100)]).is_empty());
    }

    #[test]
    fn typing_with_right_alt_held_cancels() {
        let mut e = right_alt();
        let phases = run(
            &mut e,
            &[(D(VK_RMENU), 0), (D(0x45), 50), (U(0x45), 60), (U(VK_RMENU), 100)],
        );
        assert_eq!(phases, vec![Down, Cancel]);
    }

    #[test]
    fn another_modifier_during_a_hold_does_not_cancel() {
        let mut e = right_alt();
        let phases = run(
            &mut e,
            &[
                (D(VK_RMENU), 0),
                (D(VK_LSHIFT), 50),
                (U(VK_LSHIFT), 60),
                (U(VK_RMENU), 100),
            ],
        );
        assert_eq!(phases, vec![Down, Up]);
    }

    #[test]
    fn generic_modifier_descriptor_matches_either_side() {
        let mut e = Engine::new(Hotkey {
            key_code: VK_CONTROL,
            modifiers: 0,
            modifier_only: true,
            double_tap: false,
        });
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (D(VK_RCONTROL), 10),
                (U(VK_LCONTROL), 20),
                (U(VK_RCONTROL), 30),
            ],
        );
        // Down on the first Ctrl, up only when neither is held.
        assert_eq!(phases, vec![Down, Up]);
    }

    #[test]
    fn alt_space_is_swallowed_and_masked() {
        let mut e = combo(VK_SPACE, ALT);
        e.handle(D(VK_LMENU), 0);
        assert_eq!(
            e.handle(D(VK_SPACE), 10),
            Outcome {
                phase: Some(Down),
                swallow: true,
                mask: true
            }
        );
        assert_eq!(
            e.handle(D(VK_SPACE), 40),
            Outcome {
                phase: None,
                swallow: true,
                mask: false
            }
        );
        assert_eq!(
            e.handle(U(VK_SPACE), 800),
            Outcome {
                phase: Some(Up),
                swallow: true,
                mask: false
            }
        );
        assert_eq!(e.handle(U(VK_LMENU), 810), Outcome::default());
    }

    #[test]
    fn right_alt_space_counts_as_alt_space() {
        let mut e = combo(VK_SPACE, ALT);
        assert_eq!(
            run(&mut e, &[(D(VK_RMENU), 0), (D(VK_SPACE), 10), (U(VK_SPACE), 50)]),
            vec![Down, Up]
        );
    }

    #[test]
    fn space_alone_or_with_extra_modifiers_types_normally() {
        let mut e = combo(VK_SPACE, ALT);
        assert_eq!(e.handle(D(VK_SPACE), 0), Outcome::default());
        assert_eq!(e.handle(U(VK_SPACE), 10), Outcome::default());
        e.handle(D(VK_LMENU), 20);
        e.handle(D(VK_LSHIFT), 30);
        assert_eq!(e.handle(D(VK_SPACE), 40), Outcome::default());
    }

    #[test]
    fn ctrl_shift_space_is_not_masked() {
        let mut e = combo(VK_SPACE, CONTROL | SHIFT);
        e.handle(D(VK_LCONTROL), 0);
        e.handle(D(VK_RSHIFT), 5);
        assert_eq!(
            e.handle(D(VK_SPACE), 10),
            Outcome {
                phase: Some(Down),
                swallow: true,
                mask: false
            }
        );
    }

    #[test]
    fn ctrl_alt_space_works() {
        let mut e = combo(VK_SPACE, CONTROL | ALT);
        let phases = run(
            &mut e,
            &[
                (D(VK_LCONTROL), 0),
                (D(VK_LMENU), 5),
                (D(VK_SPACE), 10),
                (U(VK_SPACE), 400),
            ],
        );
        assert_eq!(phases, vec![Down, Up]);
    }

    #[test]
    fn space_already_repeating_when_alt_goes_down_does_not_start() {
        // Mirrors the Swift helper's autorepeat check: a held Space isn't a fresh press.
        let mut e = combo(VK_SPACE, ALT);
        e.handle(D(VK_SPACE), 0);
        e.handle(D(VK_LMENU), 100);
        assert_eq!(
            e.handle(D(VK_SPACE), 130),
            Outcome {
                phase: None,
                swallow: true,
                mask: false
            }
        );
    }

    #[test]
    fn stale_keys_are_forgotten() {
        // Alt went up while an elevated window had focus, so we never saw it.
        let mut e = combo(VK_SPACE, 0);
        e.handle(D(VK_LMENU), 0);
        e.release_stale(|_| false, VK_SPACE);
        assert_eq!(e.handle(D(VK_SPACE), 10).phase, Some(Down));
    }

    #[test]
    fn release_stale_keeps_keys_still_down_and_the_current_one() {
        let mut e = combo(VK_SPACE, ALT);
        e.handle(D(VK_LMENU), 0);
        e.handle(D(VK_LSHIFT), 0);
        e.release_stale(|vk| vk == VK_LMENU, VK_LSHIFT);
        assert_eq!(e.modifiers(), ALT | SHIFT);
        e.release_stale(|vk| vk == VK_LMENU, 0);
        assert_eq!(e.modifiers(), ALT);
    }

    #[test]
    fn configure_resets_a_hold_in_progress() {
        let mut e = right_alt();
        e.handle(D(VK_RMENU), 0);
        e.configure(Hotkey::default());
        assert_eq!(e.handle(U(VK_RMENU), 10), Outcome::default());
    }

    #[test]
    fn phase_names_match_the_protocol() {
        assert_eq!(
            [Down, Up, Cancel, Tap].map(Phase::as_str),
            ["down", "up", "cancel", "tap"]
        );
    }
}
