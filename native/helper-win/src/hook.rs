// The Windows keyboard watcher: low-level keyboard and mouse hooks on their own thread with a
// message loop, feeding src/engine.rs. Windows needs no permission for this (the Mac needs
// Accessibility), which is why `trusted` is always true.

use std::sync::atomic::{AtomicBool, Ordering};

static LIVE: AtomicBool = AtomicBool::new(false);

// Whether the keyboard hook is in place: the `tap` field of status messages.
pub fn is_live() -> bool {
    LIVE.load(Ordering::SeqCst)
}

#[cfg(not(windows))]
pub fn start() -> bool {
    // Built on a Mac only so `cargo test` can run the protocol and timing logic.
    false
}

#[cfg(windows)]
pub use win::start;

#[cfg(windows)]
mod win {
    use std::mem::{size_of, zeroed};
    use std::ptr::{null, null_mut};
    use std::sync::atomic::Ordering;
    use std::sync::mpsc;
    use std::thread;

    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::{GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_HIGHEST};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage, HC_ACTION, KBDLLHOOKSTRUCT,
        LLKHF_INJECTED, LLMHF_INJECTED, MSG, MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP,
        WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_SYSKEYDOWN, WM_SYSKEYUP, WM_XBUTTONDOWN,
    };

    use super::LIVE;
    use crate::engine::{self, Input, Outcome};
    use crate::{clock, output, protocol};

    // An unassigned virtual key. Pressing it between Alt (or Win) going down and up tells
    // Windows the modifier was used for something, so it doesn't open the menu bar or Start.
    const VK_MASK: u16 = 0xE8;

    // Starts the hook thread and waits for it to report whether the keyboard hook went in.
    pub fn start() -> bool {
        let (tx, rx) = mpsc::channel();
        let spawned = thread::Builder::new().name("hook".into()).spawn(move || unsafe {
            // Hook callbacks run on this thread for every key anyone presses: keep it ahead of
            // background work so hold-to-talk stays under the 150 ms budget.
            SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_HIGHEST);
            let module = GetModuleHandleW(null());
            let keyboard = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), module, 0);
            // Only double-tap uses clicks (Ctrl-click isn't a tap); a missing mouse hook
            // doesn't stop hold-to-talk.
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module, 0);
            let ok = !keyboard.is_null();
            LIVE.store(ok, Ordering::SeqCst);
            let _ = tx.send(ok);
            if !ok {
                return;
            }
            // Low-level hooks are called through this thread's message queue.
            let mut msg: MSG = zeroed();
            while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            LIVE.store(false, Ordering::SeqCst);
        });
        spawned.is_ok() && rx.recv().unwrap_or(false)
    }

    fn feed(input: Input, current_vk: Option<u32>) -> Outcome {
        let t = clock::now_ms();
        let outcome = {
            let mut engine = engine::shared().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(vk) = current_vk {
                // SAFETY: GetAsyncKeyState only reads the system's key state.
                engine.release_stale(|held| unsafe { GetAsyncKeyState(held as i32) } < 0, vk);
            }
            engine.handle(input, t)
        };
        if let Some(phase) = outcome.phase {
            output::emit(protocol::hotkey_event(phase, t));
        }
        if outcome.mask {
            press_mask_key();
        }
        outcome
    }

    fn press_mask_key() {
        let key = |flags| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_MASK,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        let inputs = [key(0), key(KEYEVENTF_KEYUP)];
        // SAFETY: a valid array of fully initialised INPUTs; these come back to our hook marked
        // injected, and are ignored there.
        unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
    }

    unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            // SAFETY: for WH_KEYBOARD_LL with HC_ACTION, lparam points to a KBDLLHOOKSTRUCT.
            let info = &*(lparam as *const KBDLLHOOKSTRUCT);
            // Keys other programs type (and our own mask key) aren't the user holding a key;
            // AltGr's made-up Ctrl isn't a Ctrl press.
            let ignore = info.flags & LLKHF_INJECTED != 0 || engine::is_altgr_fake_ctrl(info.vkCode, info.scanCode);
            let input = match wparam as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => Some(Input::KeyDown(info.vkCode)),
                WM_KEYUP | WM_SYSKEYUP => Some(Input::KeyUp(info.vkCode)),
                _ => None,
            };
            if let (false, Some(input)) = (ignore, input) {
                let current = matches!(input, Input::KeyDown(_)).then_some(info.vkCode);
                if feed(input, current).swallow {
                    return 1;
                }
            }
        }
        CallNextHookEx(null_mut(), code, wparam, lparam)
    }

    unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            // SAFETY: for WH_MOUSE_LL with HC_ACTION, lparam points to an MSLLHOOKSTRUCT.
            let info = &*(lparam as *const MSLLHOOKSTRUCT);
            let button_down = matches!(
                wparam as u32,
                WM_LBUTTONDOWN | WM_RBUTTONDOWN | WM_MBUTTONDOWN | WM_XBUTTONDOWN
            );
            if button_down && info.flags & LLMHF_INJECTED == 0 {
                feed(Input::MouseDown, None);
            }
        }
        CallNextHookEx(null_mut(), code, wparam, lparam)
    }
}
