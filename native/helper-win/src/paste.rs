// Typing dictation into the app you're in: Promptly has put the text on the clipboard, and the
// helper presses Ctrl+V there, as the Swift helper presses ⌘V.
//
// Windows drops keys sent from a normal app to one running as administrator (UIPI), and
// SendInput doesn't say so. So an elevated front window gets { ok: false, reason: 'elevated' }
// and Promptly leaves the text on the clipboard ("press Ctrl+V"), as on the Mac without
// Accessibility.

pub struct Pasted {
    pub ok: bool,
    pub reason: Option<&'static str>,
}

// `target_elevated` is None when the front window's process couldn't be asked (it quit, or
// there's no front window): then we paste anyway, as the Mac does.
pub fn blocked(self_elevated: bool, target_elevated: Option<bool>) -> Option<&'static str> {
    (!self_elevated && target_elevated == Some(true)).then_some("elevated")
}

#[cfg(not(windows))]
pub fn paste_into_front_app() -> Pasted {
    // Built on a Mac only for `cargo test`.
    Pasted {
        ok: false,
        reason: None,
    }
}

#[cfg(windows)]
pub fn paste_into_front_app() -> Pasted {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    let target = crate::context::foreground().and_then(|front| win::is_elevated(Some(front.pid)));
    let self_elevated = win::is_elevated(None).unwrap_or(false);
    if let Some(reason) = blocked(self_elevated, target) {
        return Pasted {
            ok: false,
            reason: Some(reason),
        };
    }
    // SAFETY: GetAsyncKeyState only reads the system's key state.
    let ctrl_held = unsafe { GetAsyncKeyState(i32::from(crate::keys::VK_CONTROL)) } < 0;
    Pasted {
        ok: crate::keys::press_with_ctrl(crate::keys::VK_V, ctrl_held),
        reason: None,
    }
}

#[cfg(windows)]
mod win {
    use std::mem::size_of;
    use std::ptr::null_mut;

    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ACCESS_DENIED, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // Whether a process (None: this one) runs as administrator. Task Manager reads the same
    // flag for every process without being elevated itself.
    pub fn is_elevated(pid: Option<u32>) -> Option<bool> {
        // SAFETY: every handle opened here is closed before returning; the out buffer is sized.
        unsafe {
            let process: HANDLE = match pid {
                None => GetCurrentProcess(),
                Some(pid) => {
                    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                    if handle.is_null() {
                        return None;
                    }
                    handle
                }
            };
            let mut token: HANDLE = null_mut();
            let opened = OpenProcessToken(process, TOKEN_QUERY, &mut token) != 0;
            let denied = !opened && GetLastError() == ERROR_ACCESS_DENIED;
            if pid.is_some() {
                CloseHandle(process);
            }
            if !opened {
                // A token we may not even read belongs to a more privileged process than ours.
                return denied.then_some(true);
            }
            let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
            let mut len = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                (&mut elevation as *mut TOKEN_ELEVATION).cast(),
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut len,
            ) != 0;
            CloseHandle(token);
            ok.then_some(elevation.TokenIsElevated != 0)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_elevated_window_blocks_a_normal_helper() {
        assert_eq!(blocked(false, Some(true)), Some("elevated"));
    }

    #[test]
    fn everything_else_pastes() {
        assert_eq!(blocked(false, Some(false)), None);
        // Promptly run as administrator can type anywhere.
        assert_eq!(blocked(true, Some(true)), None);
        assert_eq!(blocked(false, None), None);
    }
}
