// Pressing Ctrl+C and Ctrl+V on the user's behalf. Our own keyboard hook sees these marked
// injected and ignores them, so they never count as the hotkey.

// Virtual-key codes name the key that types the letter in the current layout, so Ctrl+VK_C is
// copy on AZERTY and Dvorak too.
pub const VK_C: u16 = 0x43;
pub const VK_V: u16 = 0x56;
pub const VK_CONTROL: u16 = 0x11;

// The key events for Ctrl+key: (virtual key, key up). A Ctrl the user is already holding (the
// double-tap hotkey) is left alone: releasing it for them would end their hold early.
pub fn ctrl_chord(key: u16, ctrl_held: bool) -> Vec<(u16, bool)> {
    if ctrl_held {
        vec![(key, false), (key, true)]
    } else {
        vec![(VK_CONTROL, false), (key, false), (key, true), (VK_CONTROL, true)]
    }
}

#[cfg(windows)]
pub fn press_with_ctrl(key: u16, ctrl_held: bool) -> bool {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC,
    };

    let inputs: Vec<INPUT> = ctrl_chord(key, ctrl_held)
        .into_iter()
        .map(|(vk, up)| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    // Some apps (remote desktops, games) read scan codes rather than virtual keys.
                    // SAFETY: MapVirtualKeyW only reads the keyboard layout.
                    wScan: unsafe { MapVirtualKeyW(u32::from(vk), MAPVK_VK_TO_VSC) } as u16,
                    dwFlags: if up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        })
        .collect();
    // SAFETY: a valid array of fully initialised INPUTs.
    let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
    sent as usize == inputs.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presses_ctrl_around_the_key() {
        assert_eq!(
            ctrl_chord(VK_V, false),
            vec![(VK_CONTROL, false), (VK_V, false), (VK_V, true), (VK_CONTROL, true)]
        );
    }

    #[test]
    fn leaves_a_held_ctrl_alone() {
        assert_eq!(ctrl_chord(VK_C, true), vec![(VK_C, false), (VK_C, true)]);
    }
}
