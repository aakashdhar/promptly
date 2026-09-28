// The name the pill shows for the app you're in. The Mac gets it from the app bundle
// (localizedName); on Windows we have an exe path. The table covers apps whose exe name or
// FileDescription reads badly ("Code.exe", explorer's "Windows Explorer", Office's short
// names); anything else uses the exe's FileDescription, then the exe name without ".exe".
// No Windows calls here, so `cargo test` checks it on any machine.

const KNOWN_APPS: &[(&str, &str)] = &[
    ("code.exe", "Visual Studio Code"),
    ("code - insiders.exe", "Visual Studio Code - Insiders"),
    ("cursor.exe", "Cursor"),
    ("windsurf.exe", "Windsurf"),
    ("devenv.exe", "Visual Studio"),
    ("chrome.exe", "Google Chrome"),
    ("msedge.exe", "Microsoft Edge"),
    ("firefox.exe", "Firefox"),
    ("brave.exe", "Brave"),
    ("arc.exe", "Arc"),
    ("winword.exe", "Microsoft Word"),
    ("excel.exe", "Microsoft Excel"),
    ("powerpnt.exe", "Microsoft PowerPoint"),
    ("outlook.exe", "Microsoft Outlook"),
    ("olk.exe", "Microsoft Outlook"),
    ("onenote.exe", "Microsoft OneNote"),
    ("ms-teams.exe", "Microsoft Teams"),
    ("teams.exe", "Microsoft Teams"),
    ("notepad.exe", "Notepad"),
    ("explorer.exe", "File Explorer"),
    ("windowsterminal.exe", "Windows Terminal"),
    ("slack.exe", "Slack"),
    ("claude.exe", "Claude"),
    ("chatgpt.exe", "ChatGPT"),
    ("figma.exe", "Figma"),
    ("notion.exe", "Notion"),
    ("obsidian.exe", "Obsidian"),
];

// Where a Ctrl+C with nothing selected interrupts the running program instead of copying.
// Promptly never sends Ctrl+C to these; their selection is read through UI Automation only.
const TERMINALS: &[&str] = &[
    "windowsterminal.exe",
    "openconsole.exe",
    "conhost.exe",
    "cmd.exe",
    "powershell.exe",
    "pwsh.exe",
    "wsl.exe",
    "bash.exe",
    "mintty.exe",
    "alacritty.exe",
    "wezterm-gui.exe",
    "hyper.exe",
    "tabby.exe",
    "conemu.exe",
    "conemu64.exe",
    "putty.exe",
    "kitty.exe",
    "warp.exe",
];

// "C:\Program Files\Microsoft VS Code\Code.exe" → "code.exe".
pub fn exe_file_name(exe_path: &str) -> String {
    exe_path
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(exe_path)
        .trim()
        .to_lowercase()
}

pub fn display_name(exe_path: &str, file_description: Option<&str>) -> String {
    let file = exe_file_name(exe_path);
    if let Some((_, name)) = KNOWN_APPS.iter().find(|(exe, _)| *exe == file) {
        return (*name).to_string();
    }
    if let Some(description) = file_description.map(str::trim).filter(|d| !d.is_empty()) {
        return description.to_string();
    }
    // The exe name as written on disk ("Spotify.exe" → "Spotify"), not lowercased.
    let original = exe_path.rsplit(['\\', '/']).next().unwrap_or(exe_path).trim();
    let stem = original
        .len()
        .checked_sub(4)
        .filter(|&cut| original.is_char_boundary(cut) && original[cut..].eq_ignore_ascii_case(".exe"))
        .map_or(original, |cut| &original[..cut]);
    stem.to_string()
}

pub fn is_terminal(exe_path: &str) -> bool {
    let file = exe_file_name(exe_path);
    TERMINALS.contains(&file.as_str())
}

// Terminals drawn inside other apps (VS Code's and Cursor's panel, Hyper, web terminals) are
// xterm.js, whose focused element Chromium reports with the class "xterm-helper-textarea"; the
// Ctrl+C there would stop the user's running command.
pub fn looks_like_terminal(class_name: &str, name: &str) -> bool {
    let class_name = class_name.to_lowercase();
    let name = name.to_lowercase();
    class_name.contains("xterm") || class_name.contains("terminal") || name.starts_with("terminal")
}

// UWP apps (Calculator, Settings, …) are hosted by this frame; the app itself is a child window.
pub fn is_frame_host(exe_path: &str) -> bool {
    exe_file_name(exe_path) == "applicationframehost.exe"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_exe_is_visual_studio_code() {
        assert_eq!(
            display_name(
                r"C:\Users\Zoë\AppData\Local\Programs\Microsoft VS Code\Code.exe",
                Some("Visual Studio Code")
            ),
            "Visual Studio Code"
        );
        // Even without version info.
        assert_eq!(display_name(r"C:\x\CODE.EXE", None), "Visual Studio Code");
    }

    #[test]
    fn known_apps_beat_their_file_descriptions() {
        assert_eq!(
            display_name(r"C:\Windows\explorer.exe", Some("Windows Explorer")),
            "File Explorer"
        );
        assert_eq!(
            display_name(
                r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
                Some("Microsoft Word")
            ),
            "Microsoft Word"
        );
        assert_eq!(
            display_name(
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                Some("Google Chrome")
            ),
            "Google Chrome"
        );
        assert_eq!(
            display_name(r"C:\Windows\System32\notepad.exe", Some("Notepad")),
            "Notepad"
        );
    }

    #[test]
    fn unknown_apps_use_the_file_description_then_the_exe_name() {
        assert_eq!(
            display_name(
                r"C:\Program Files\Mozilla Thunderbird\thunderbird.exe",
                Some("  Thunderbird ")
            ),
            "Thunderbird"
        );
        assert_eq!(display_name(r"C:\Apps\Spotify.exe", Some("")), "Spotify");
        assert_eq!(display_name(r"C:\Apps\Spotify.exe", None), "Spotify");
        assert_eq!(display_name(r"C:\Apps\tool", None), "tool");
        assert_eq!(display_name("", None), "");
    }

    #[test]
    fn exe_file_names() {
        assert_eq!(
            exe_file_name(r"C:\Program Files\Microsoft VS Code\Code.exe"),
            "code.exe"
        );
        assert_eq!(exe_file_name("code.exe"), "code.exe");
        assert_eq!(exe_file_name("C:/odd/Path/Slack.exe"), "slack.exe");
    }

    #[test]
    fn terminals_are_never_sent_ctrl_c() {
        assert!(is_terminal(
            r"C:\Program Files\WindowsApps\Microsoft.WindowsTerminal_1.21\WindowsTerminal.exe"
        ));
        assert!(is_terminal(r"C:\Windows\System32\conhost.exe"));
        assert!(!is_terminal(r"C:\Windows\System32\notepad.exe"));
        assert!(looks_like_terminal("xterm-helper-textarea", "Terminal 1, pwsh"));
        assert!(looks_like_terminal("", "Terminal 2, bash"));
        assert!(!looks_like_terminal(
            "inputarea monaco-mouse-cursor-text",
            "Editor content"
        ));
        assert!(!looks_like_terminal("RichEditD2DPT", "Text editor"));
    }

    #[test]
    fn frame_host() {
        assert!(is_frame_host(r"C:\Windows\System32\ApplicationFrameHost.exe"));
        assert!(!is_frame_host(r"C:\Windows\System32\notepad.exe"));
    }
}
