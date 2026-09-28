// The app you're in and the text you've selected, for destination-aware prompts. The reply has
// native/helper/main.swift's shape: app { name, bundleId, pid } (on Windows bundleId is the exe
// path) and selectedText, trimmed and capped as on the Mac.
//
// Selection comes from UI Automation first. Only when the focused element has no text pattern
// (Chrome, Slack and most Electron apps) does Promptly press Ctrl+C itself, and then only with
// the user's clipboard saved and put back exactly (src/clipboard.rs) — never in a password
// field, a terminal (Ctrl+C there stops the running command) or while Alt, Shift or Win is held.

use serde_json::{json, Value};

// Swift's `String(trimmed.prefix(20000))`.
pub const MAX_SELECTED_CHARS: usize = 20_000;

pub struct Context {
    pub app: Value,
    pub selected_text: Option<String>,
}

pub fn app_json(name: &str, exe_path: &str, pid: u32) -> Value {
    json!({ "name": name, "bundleId": exe_path, "pid": pid })
}

// Windows text is CRLF; prompts and the Mac use LF. Whitespace-only is no selection.
pub fn clean_selection(text: &str) -> Option<String> {
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    let trimmed = text.trim_matches(|c: char| c.is_whitespace() || c == '\0');
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.chars().take(MAX_SELECTED_CHARS).collect())
}

// What UI Automation said about the focused element.
#[derive(Default, Debug, Clone, PartialEq, Eq)]
pub struct Focus {
    pub is_password: bool,
    pub has_text_pattern: bool,
    pub selection: Option<String>,
    pub class_name: String,
    pub name: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Plan {
    Use(Option<String>),
    CopyFallback,
}

// `focus` is None when UI Automation failed or ran out of time: then nothing is known about the
// field (it could be a password), so there's no Ctrl+C either.
pub fn plan(focus: Option<&Focus>, exe_path: &str) -> Plan {
    let Some(focus) = focus else { return Plan::Use(None) };
    if focus.is_password {
        return Plan::Use(None);
    }
    if let Some(text) = focus.selection.as_deref().and_then(clean_selection) {
        return Plan::Use(Some(text));
    }
    // A text pattern that reports no selection is believed: nothing is selected.
    if focus.has_text_pattern
        || crate::apps::is_terminal(exe_path)
        || crate::apps::looks_like_terminal(&focus.class_name, &focus.name)
    {
        return Plan::Use(None);
    }
    Plan::CopyFallback
}

#[cfg(not(windows))]
pub fn read() -> Context {
    // Built on a Mac only for `cargo test`.
    Context {
        app: Value::Null,
        selected_text: None,
    }
}

#[cfg(windows)]
pub use win::{foreground, read};

#[cfg(windows)]
mod win {
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::ptr::null_mut;
    use std::sync::OnceLock;
    use std::thread;
    use std::time::{Duration, Instant};

    use serde_json::Value;
    use windows_sys::core::BOOL;
    use windows_sys::Win32::Foundation::{CloseHandle, HWND, INVALID_HANDLE_VALUE, LPARAM};
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetForegroundWindow, GetWindowThreadProcessId,
    };

    use super::{app_json, clean_selection, plan, Context, Plan};
    use crate::{apps, clipboard, keys, uia};

    const VK_SHIFT: i32 = 0x10;
    const VK_MENU: i32 = 0x12;
    const VK_LWIN: i32 = 0x5B;
    const VK_RWIN: i32 = 0x5C;

    // Promptly waits 1.5 s for the whole reply (main/helper.js): UI Automation 0.5 s, waiting
    // for a tapped hotkey's Alt/Shift to come up 0.2 s, the copy 0.3 s.
    const MODIFIERS_UP_WAIT: Duration = Duration::from_millis(200);
    const COPY_WAIT: Duration = Duration::from_millis(300);

    pub struct Front {
        pub pid: u32,
        pub exe: String,
    }

    pub fn read() -> Context {
        let Some(front) = foreground() else {
            return Context {
                app: Value::Null,
                selected_text: None,
            };
        };
        // Promptly's own window (this helper's parent): main.js skips it on the Mac by bundle id;
        // null here keeps it from showing up as "the app you're in" and from being sent Ctrl+C.
        if Some(front.pid) == parent_pid() {
            return Context {
                app: Value::Null,
                selected_text: None,
            };
        }
        let name = apps::display_name(&front.exe, file_description(&front.exe).as_deref());
        let focus = uia::focused();
        let selected_text = match plan(focus.as_ref(), &front.exe) {
            Plan::Use(text) => text,
            Plan::CopyFallback => copy_selection(),
        };
        Context {
            app: app_json(&name, &front.exe, front.pid),
            selected_text,
        }
    }

    pub fn foreground() -> Option<Front> {
        // SAFETY: plain Win32 queries; a null window or pid 0 is handled below.
        let hwnd = unsafe { GetForegroundWindow() };
        if hwnd.is_null() {
            return None;
        }
        let mut pid = window_pid(hwnd)?;
        let mut exe = exe_path(pid)?;
        if apps::is_frame_host(&exe) {
            // The UWP app is a child window from another process.
            if let Some(child_pid) = hosted_app_pid(hwnd, pid) {
                if let Some(child_exe) = exe_path(child_pid) {
                    pid = child_pid;
                    exe = child_exe;
                }
            }
        }
        Some(Front { pid, exe })
    }

    fn window_pid(hwnd: HWND) -> Option<u32> {
        let mut pid = 0u32;
        // SAFETY: hwnd came from Windows; pid is a valid out pointer.
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        (pid != 0).then_some(pid)
    }

    fn exe_path(pid: u32) -> Option<String> {
        // SAFETY: the handle is closed before returning; the buffer length is passed in and out.
        unsafe {
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process.is_null() {
                return None;
            }
            let mut buffer = vec![0u16; 1024];
            let mut len = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, buffer.as_mut_ptr(), &mut len);
            CloseHandle(process);
            (ok != 0).then(|| String::from_utf16_lossy(&buffer[..len as usize]))
        }
    }

    struct HostSearch {
        frame_pid: u32,
        found: u32,
    }

    unsafe extern "system" fn find_hosted(child: HWND, lparam: LPARAM) -> BOOL {
        // SAFETY: lparam is the &mut HostSearch passed to EnumChildWindows below.
        let search = &mut *(lparam as *mut HostSearch);
        if let Some(pid) = window_pid(child) {
            if pid != search.frame_pid {
                search.found = pid;
                return 0;
            }
        }
        1
    }

    fn hosted_app_pid(frame: HWND, frame_pid: u32) -> Option<u32> {
        let mut search = HostSearch { frame_pid, found: 0 };
        // SAFETY: the callback only runs during this call, while `search` is alive.
        unsafe { EnumChildWindows(frame, Some(find_hosted), &mut search as *mut HostSearch as LPARAM) };
        (search.found != 0).then_some(search.found)
    }

    // The exe's FileDescription ("Visual Studio Code"), the closest thing to the Mac's app name.
    fn file_description(exe: &str) -> Option<String> {
        let path: Vec<u16> = exe.encode_utf16().chain(Some(0)).collect();
        // SAFETY: buffers are sized by GetFileVersionInfoSizeW; VerQueryValueW returns pointers
        // into `data`, which outlives every read of them.
        unsafe {
            let size = GetFileVersionInfoSizeW(path.as_ptr(), null_mut());
            if size == 0 {
                return None;
            }
            let mut data = vec![0u8; size as usize];
            if GetFileVersionInfoW(path.as_ptr(), 0, size, data.as_mut_ptr().cast()) == 0 {
                return None;
            }
            let query = |key: &str| -> Option<(*const c_void, u32)> {
                let key: Vec<u16> = key.encode_utf16().chain(Some(0)).collect();
                let mut ptr: *mut c_void = null_mut();
                let mut len = 0u32;
                (VerQueryValueW(data.as_ptr().cast(), key.as_ptr(), &mut ptr, &mut len) != 0 && !ptr.is_null())
                    .then_some((ptr as *const c_void, len))
            };
            // The exe's own language first, then US English (Unicode, then Windows-1252).
            let mut languages = Vec::new();
            if let Some((ptr, len)) = query("\\VarFileInfo\\Translation") {
                let pairs = std::slice::from_raw_parts(ptr as *const u16, (len as usize) / size_of::<u16>());
                for pair in pairs.chunks_exact(2) {
                    languages.push(format!("{:04x}{:04x}", pair[0], pair[1]));
                }
            }
            languages.extend(["040904b0".to_string(), "040904e4".to_string()]);
            languages.into_iter().find_map(|language| {
                let (ptr, len) = query(&format!("\\StringFileInfo\\{language}\\FileDescription"))?;
                let chars = std::slice::from_raw_parts(ptr as *const u16, len as usize);
                let text = String::from_utf16_lossy(chars);
                let text = text.trim_end_matches('\0').trim();
                (!text.is_empty()).then(|| text.to_string())
            })
        }
    }

    // The Electron main process that started this helper owns Promptly's windows.
    fn parent_pid() -> Option<u32> {
        static PARENT: OnceLock<Option<u32>> = OnceLock::new();
        *PARENT.get_or_init(|| {
            // SAFETY: the snapshot handle is closed before returning; dwSize is set as required.
            unsafe {
                let me = GetCurrentProcessId();
                let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if snapshot == INVALID_HANDLE_VALUE {
                    return None;
                }
                let mut entry: PROCESSENTRY32W = std::mem::zeroed();
                entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
                let mut parent = None;
                let mut more = Process32FirstW(snapshot, &mut entry) != 0;
                while more {
                    if entry.th32ProcessID == me {
                        parent = Some(entry.th32ParentProcessID);
                        break;
                    }
                    more = Process32NextW(snapshot, &mut entry) != 0;
                }
                CloseHandle(snapshot);
                parent
            }
        })
    }

    fn key_down(vk: i32) -> bool {
        // SAFETY: GetAsyncKeyState only reads the system's key state.
        unsafe { GetAsyncKeyState(vk) < 0 }
    }

    // A held Alt, Shift or Win would turn our Ctrl+C into another shortcut (Ctrl+Shift+C opens
    // DevTools; Ctrl+Alt+C is AltGr+C, which types a character on some layouts). A tapped
    // hotkey is released within moments; a held one means no Ctrl+C this time.
    fn wait_for_modifiers_up() -> bool {
        let deadline = Instant::now() + MODIFIERS_UP_WAIT;
        loop {
            if ![VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN].iter().any(|&vk| key_down(vk)) {
                return true;
            }
            if Instant::now() >= deadline {
                return false;
            }
            thread::sleep(Duration::from_millis(10));
        }
    }

    // The Ctrl+C fallback. The clipboard is saved first (all formats) and put back exactly
    // whatever happens; if it can't be saved in full, nothing is copied.
    fn copy_selection() -> Option<String> {
        if !wait_for_modifiers_up() {
            return None;
        }
        let saved = clipboard::save()?;
        let before = clipboard::sequence();
        let ctrl_held = key_down(0x11);
        keys::press_with_ctrl(keys::VK_C, ctrl_held);

        let deadline = Instant::now() + COPY_WAIT;
        let mut changed = false;
        let mut copied = None;
        while Instant::now() < deadline {
            if clipboard::sequence() != before {
                changed = true;
                // Opening fails while the app is still writing; its text is complete once it
                // has closed the clipboard.
                if let Some(read) = clipboard::read_copied() {
                    copied = Some(read);
                    break;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
        if changed || clipboard::sequence() != before {
            clipboard::restore(&saved);
        } else {
            // Nothing came in time. A slow app could still copy after we've answered, so keep
            // watching for a moment and put the user's clipboard back if it does.
            clipboard::restore_if_changed_later(saved, before);
        }
        copied.and_then(|copy| {
            if copy.line_copy {
                None
            } else {
                copy.text.as_deref().and_then(clean_selection)
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOTEPAD: &str = r"C:\Windows\System32\notepad.exe";
    const CHROME: &str = r"C:\Program Files\Google\Chrome\Application\chrome.exe";
    const TERMINAL: &str = r"C:\Program Files\WindowsApps\Microsoft.WindowsTerminal\WindowsTerminal.exe";

    fn focus(has_text_pattern: bool, selection: Option<&str>) -> Focus {
        Focus {
            has_text_pattern,
            selection: selection.map(str::to_string),
            ..Focus::default()
        }
    }

    #[test]
    fn selection_is_trimmed_capped_and_lf() {
        assert_eq!(
            clean_selection("  hello\r\nworld \r\n"),
            Some("hello\nworld".to_string())
        );
        assert_eq!(clean_selection(" \r\n\t "), None);
        assert_eq!(clean_selection("text\0"), Some("text".to_string()));
        let long = "é".repeat(MAX_SELECTED_CHARS + 50);
        assert_eq!(clean_selection(&long).unwrap().chars().count(), MAX_SELECTED_CHARS);
    }

    #[test]
    fn app_has_the_swift_fields() {
        assert_eq!(
            app_json("Visual Studio Code", r"C:\VS Code\Code.exe", 42),
            json!({ "name": "Visual Studio Code", "bundleId": r"C:\VS Code\Code.exe", "pid": 42 })
        );
    }

    #[test]
    fn ui_automation_selection_is_used_when_there_is_one() {
        assert_eq!(
            plan(Some(&focus(true, Some(" draft \r\n"))), NOTEPAD),
            Plan::Use(Some("draft".to_string()))
        );
        // Some providers return a selection without a text pattern of their own.
        assert_eq!(
            plan(Some(&focus(false, Some("x"))), CHROME),
            Plan::Use(Some("x".to_string()))
        );
    }

    #[test]
    fn a_text_pattern_with_nothing_selected_means_none_without_ctrl_c() {
        assert_eq!(plan(Some(&focus(true, None)), NOTEPAD), Plan::Use(None));
        assert_eq!(plan(Some(&focus(true, Some("  "))), NOTEPAD), Plan::Use(None));
    }

    #[test]
    fn no_text_pattern_falls_back_to_ctrl_c() {
        assert_eq!(plan(Some(&focus(false, None)), CHROME), Plan::CopyFallback);
    }

    #[test]
    fn password_fields_are_never_read_or_copied() {
        let password = Focus {
            is_password: true,
            selection: Some("hunter2".into()),
            ..Focus::default()
        };
        assert_eq!(plan(Some(&password), CHROME), Plan::Use(None));
    }

    #[test]
    fn unknown_focus_means_no_ctrl_c() {
        // UI Automation timed out: it could be a password field.
        assert_eq!(plan(None, CHROME), Plan::Use(None));
    }

    #[test]
    fn terminals_are_never_sent_ctrl_c() {
        assert_eq!(plan(Some(&focus(false, None)), TERMINAL), Plan::Use(None));
        let vscode_terminal = Focus {
            class_name: "xterm-helper-textarea".into(),
            name: "Terminal 1, pwsh".into(),
            ..Focus::default()
        };
        assert_eq!(plan(Some(&vscode_terminal), r"C:\VS Code\Code.exe"), Plan::Use(None));
    }
}
