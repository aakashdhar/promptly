// The Ctrl+C fallback's only use of the clipboard: save everything on it, let the app copy the
// selection, read the text, put everything back. Saving copies every format's bytes, so the
// user's clipboard comes back exactly as it was (text, rich text, images, Office's formats);
// if it can't all be saved, the fallback doesn't copy at all.
//
// The decisions are plain functions below so `cargo test` checks them on any machine; the
// Win32 calls are in `win`.

// Standard clipboard formats (WinUser.h).
pub const CF_BITMAP: u32 = 2;
pub const CF_METAFILEPICT: u32 = 3;
pub const CF_PALETTE: u32 = 9;
pub const CF_UNICODETEXT: u32 = 13;
pub const CF_ENHMETAFILE: u32 = 14;
pub const CF_OWNERDISPLAY: u32 = 0x80;
pub const CF_DSPBITMAP: u32 = 0x82;
pub const CF_DSPMETAFILEPICT: u32 = 0x83;
pub const CF_DSPENHMETAFILE: u32 = 0x8E;

// Past these, saving the user's clipboard would be slow or huge (a giant Excel range, a raw
// photo): skip the fallback rather than risk not putting it back in full.
pub const MAX_SAVE_BYTES: usize = 64 * 1024 * 1024;
pub const SAVE_WAIT_MS: u64 = 200;

#[derive(Debug, PartialEq, Eq)]
pub enum Kind {
    // Memory we can copy byte for byte (text, HTML, RTF, DIB images, every registered format).
    Bytes,
    // A metafile handle, saved as its bits.
    EnhMetafile,
    // Made again by Windows from a format we do save (CF_BITMAP and CF_PALETTE from CF_DIB,
    // CF_METAFILEPICT from CF_ENHMETAFILE), or not data at all (owner-drawn, private handles).
    Skip,
}

pub fn kind(format: u32) -> Kind {
    match format {
        CF_ENHMETAFILE => Kind::EnhMetafile,
        CF_BITMAP | CF_METAFILEPICT | CF_PALETTE | CF_OWNERDISPLAY | CF_DSPBITMAP | CF_DSPMETAFILEPICT
        | CF_DSPENHMETAFILE => Kind::Skip,
        // CF_PRIVATEFIRST..LAST and CF_GDIOBJFIRST..LAST: handles whose kind only their owner knows.
        0x200..=0x3FF => Kind::Skip,
        _ => Kind::Bytes,
    }
}

pub fn within_budget(saved_bytes: usize, elapsed_ms: u64) -> bool {
    saved_bytes <= MAX_SAVE_BYTES && elapsed_ms <= SAVE_WAIT_MS
}

// Editors that copy the whole line when nothing is selected mark that copy. VS Code (and
// Cursor, Windsurf) put `isFromEmptySelection: true` in the web data Chromium stores as UTF-16;
// Visual Studio adds a format of its own. Such a copy is "nothing selected".
pub const CHROMIUM_CUSTOM_DATA: &str = "Chromium Web Custom MIME Data Format";
pub const VISUAL_STUDIO_LINE_COPY: &str = "VisualStudioEditorOperationsLineCutCopyClipboardTag";

pub fn is_line_copy(format_name: &str, data: &[u8]) -> bool {
    if format_name == VISUAL_STUDIO_LINE_COPY {
        return true;
    }
    if format_name != CHROMIUM_CUSTOM_DATA {
        return false;
    }
    let units: Vec<u16> = data.chunks_exact(2).map(|b| u16::from_le_bytes([b[0], b[1]])).collect();
    let text = String::from_utf16_lossy(&units);
    text.contains("vscode-editor-data") && text.contains("\"isFromEmptySelection\":true")
}

// CF_UNICODETEXT bytes → text, up to the first NUL.
pub fn text_from_utf16_bytes(data: &[u8]) -> String {
    let units: Vec<u16> = data
        .chunks_exact(2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .take_while(|&unit| unit != 0)
        .collect();
    String::from_utf16_lossy(&units)
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Copied {
    pub text: Option<String>,
    pub line_copy: bool,
}

#[cfg(windows)]
pub use win::{read_copied, restore, restore_if_changed_later, save, sequence};

#[cfg(windows)]
mod win {
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use std::thread;
    use std::time::{Duration, Instant};

    use windows_sys::Win32::Foundation::GlobalFree;
    use windows_sys::Win32::Graphics::Gdi::{GetEnhMetaFileBits, SetEnhMetaFileBits};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, EnumClipboardFormats, GetClipboardData, GetClipboardFormatNameW,
        GetClipboardSequenceNumber, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};

    use super::{is_line_copy, kind, text_from_utf16_bytes, within_budget, Copied, Kind, CF_UNICODETEXT};

    pub enum Item {
        Bytes(Vec<u8>),
        EnhMetafile(Vec<u8>),
    }

    pub struct Saved {
        items: Vec<(u32, Item)>,
    }

    // Closes the clipboard however the caller leaves.
    struct Open;

    impl Drop for Open {
        fn drop(&mut self) {
            // SAFETY: only constructed after OpenClipboard succeeded on this thread.
            unsafe { CloseClipboard() };
        }
    }

    // Another program may have the clipboard open for a moment; keep trying until `wait`.
    fn open(wait: Duration) -> Option<Open> {
        let deadline = Instant::now() + wait;
        loop {
            // SAFETY: no owner window: we never render formats late, so none is needed (and a
            // window here would need its own message loop to answer other programs).
            if unsafe { OpenClipboard(null_mut()) } != 0 {
                return Some(Open);
            }
            if Instant::now() >= deadline {
                return None;
            }
            thread::sleep(Duration::from_millis(5));
        }
    }

    pub fn sequence() -> u32 {
        // SAFETY: reads a counter.
        unsafe { GetClipboardSequenceNumber() }
    }

    fn formats() -> Vec<u32> {
        let mut list = Vec::new();
        let mut format = 0;
        loop {
            // SAFETY: the clipboard is open (callers hold an `Open`).
            format = unsafe { EnumClipboardFormats(format) };
            if format == 0 {
                return list;
            }
            list.push(format);
        }
    }

    fn format_name(format: u32) -> String {
        let mut buffer = [0u16; 256];
        // SAFETY: the buffer length is passed in.
        let len = unsafe { GetClipboardFormatNameW(format, buffer.as_mut_ptr(), buffer.len() as i32) };
        String::from_utf16_lossy(&buffer[..len.max(0) as usize])
    }

    // SAFETY (caller): the clipboard is open and `handle` came from GetClipboardData.
    unsafe fn global_bytes(handle: *mut c_void) -> Option<Vec<u8>> {
        let size = GlobalSize(handle);
        let ptr = GlobalLock(handle) as *const u8;
        if ptr.is_null() {
            return None;
        }
        let bytes = std::slice::from_raw_parts(ptr, size).to_vec();
        GlobalUnlock(handle);
        Some(bytes)
    }

    // Everything on the clipboard, or None (then the fallback doesn't copy).
    pub fn save() -> Option<Saved> {
        let started = Instant::now();
        let _open = open(Duration::from_millis(100))?;
        let mut items = Vec::new();
        let mut total = 0usize;
        for format in formats() {
            let item = match kind(format) {
                Kind::Skip => continue,
                // SAFETY: the clipboard is open; the handle is only read.
                Kind::Bytes => unsafe {
                    let handle = GetClipboardData(format);
                    if handle.is_null() {
                        // Its owner couldn't render it; a paste couldn't get it either.
                        continue;
                    }
                    Item::Bytes(global_bytes(handle)?)
                },
                // SAFETY: as above; the first call asks for the size, the second fills the buffer.
                Kind::EnhMetafile => unsafe {
                    let handle = GetClipboardData(format);
                    if handle.is_null() {
                        continue;
                    }
                    let size = GetEnhMetaFileBits(handle, 0, null_mut());
                    let mut bits = vec![0u8; size as usize];
                    if size == 0 || GetEnhMetaFileBits(handle, size, bits.as_mut_ptr()) != size {
                        return None;
                    }
                    Item::EnhMetafile(bits)
                },
            };
            total += match &item {
                Item::Bytes(bytes) | Item::EnhMetafile(bytes) => bytes.len(),
            };
            if !within_budget(total, started.elapsed().as_millis() as u64) {
                return None;
            }
            items.push((format, item));
        }
        Some(Saved { items })
    }

    // The text the app just copied, or None while it still has the clipboard open.
    pub fn read_copied() -> Option<Copied> {
        let _open = open(Duration::ZERO)?;
        let mut copied = Copied::default();
        for format in formats() {
            if format == CF_UNICODETEXT {
                // SAFETY: the clipboard is open; the handle is only read.
                copied.text = unsafe {
                    let handle = GetClipboardData(format);
                    (!handle.is_null())
                        .then(|| global_bytes(handle))
                        .flatten()
                        .map(|bytes| text_from_utf16_bytes(&bytes))
                };
            } else if format >= 0xC000 {
                let name = format_name(format);
                let marker = name == super::VISUAL_STUDIO_LINE_COPY || name == super::CHROMIUM_CUSTOM_DATA;
                if marker {
                    // SAFETY: as above.
                    let data = unsafe {
                        let handle = GetClipboardData(format);
                        (!handle.is_null())
                            .then(|| global_bytes(handle))
                            .flatten()
                            .unwrap_or_default()
                    };
                    copied.line_copy |= is_line_copy(&name, &data);
                }
            }
        }
        Some(copied)
    }

    fn register(name: &str) -> u32 {
        let wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
        // SAFETY: a NUL-terminated UTF-16 string.
        unsafe { RegisterClipboardFormatW(wide.as_ptr()) }
    }

    // SAFETY (caller): the clipboard is open and was emptied by us.
    unsafe fn put_bytes(format: u32, bytes: &[u8]) {
        let memory = GlobalAlloc(GMEM_MOVEABLE, bytes.len().max(1));
        if memory.is_null() {
            return;
        }
        let ptr = GlobalLock(memory) as *mut u8;
        if ptr.is_null() {
            GlobalFree(memory);
            return;
        }
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr, bytes.len());
        GlobalUnlock(memory);
        // On success the clipboard owns the memory; otherwise it's still ours to free.
        if SetClipboardData(format, memory).is_null() {
            GlobalFree(memory);
        }
    }

    // Puts the user's clipboard back. Tries for half a second in case the app that copied is
    // still holding the clipboard open.
    pub fn restore(saved: &Saved) -> bool {
        let Some(_open) = open(Duration::from_millis(500)) else {
            return false;
        };
        // SAFETY: the clipboard is open on this thread.
        unsafe {
            EmptyClipboard();
            for (format, item) in &saved.items {
                match item {
                    Item::Bytes(bytes) => put_bytes(*format, bytes),
                    Item::EnhMetafile(bits) => {
                        let handle = SetEnhMetaFileBits(bits.len() as u32, bits.as_ptr());
                        if !handle.is_null() {
                            SetClipboardData(*format, handle);
                        }
                    }
                }
            }
            if !saved.items.is_empty() {
                // Win+V history already has the user's item; putting it back mustn't add it
                // twice or sync it to their other PCs again.
                let no = 0u32.to_le_bytes();
                for marker in ["CanIncludeInClipboardHistory", "CanUploadToCloudClipboard"] {
                    let format = register(marker);
                    if format != 0 && !saved.items.iter().any(|(f, _)| *f == format) {
                        put_bytes(format, &no);
                    }
                }
            }
        }
        true
    }

    // The app didn't copy within the wait; if it does in the next second, undo it.
    pub fn restore_if_changed_later(saved: Saved, before: u32) {
        let _ = thread::Builder::new().name("clipboard-guard".into()).spawn(move || {
            let deadline = Instant::now() + Duration::from_millis(1000);
            while Instant::now() < deadline {
                if sequence() != before {
                    // Let the app finish writing all its formats first.
                    thread::sleep(Duration::from_millis(50));
                    restore(&saved);
                    return;
                }
                thread::sleep(Duration::from_millis(10));
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utf16(text: &str) -> Vec<u8> {
        text.encode_utf16().flat_map(u16::to_le_bytes).collect()
    }

    #[test]
    fn saves_every_data_format_and_skips_what_windows_remakes() {
        assert_eq!(kind(CF_UNICODETEXT), Kind::Bytes);
        assert_eq!(kind(1), Kind::Bytes); // CF_TEXT
        assert_eq!(kind(8), Kind::Bytes); // CF_DIB
        assert_eq!(kind(17), Kind::Bytes); // CF_DIBV5
        assert_eq!(kind(15), Kind::Bytes); // CF_HDROP: files copied in Explorer
        assert_eq!(kind(0xC0F3), Kind::Bytes); // registered: HTML Format, Rich Text Format, …
        assert_eq!(kind(CF_ENHMETAFILE), Kind::EnhMetafile);
        for skipped in [
            CF_BITMAP,
            CF_METAFILEPICT,
            CF_PALETTE,
            CF_OWNERDISPLAY,
            CF_DSPBITMAP,
            0x200,
            0x3FF,
        ] {
            assert_eq!(kind(skipped), Kind::Skip, "format {skipped:#x}");
        }
    }

    #[test]
    fn a_clipboard_too_big_or_slow_to_save_means_no_ctrl_c() {
        assert!(within_budget(1024, 10));
        assert!(!within_budget(MAX_SAVE_BYTES + 1, 10));
        assert!(!within_budget(10, SAVE_WAIT_MS + 1));
    }

    #[test]
    fn vs_code_line_copies_are_not_selections() {
        let data = utf16("\u{2}vscode-editor-data{\"version\":1,\"isFromEmptySelection\":true,\"mode\":\"rust\"}");
        assert!(is_line_copy(CHROMIUM_CUSTOM_DATA, &data));
        let selected = utf16("vscode-editor-data{\"version\":1,\"isFromEmptySelection\":false}");
        assert!(!is_line_copy(CHROMIUM_CUSTOM_DATA, &selected));
        assert!(!is_line_copy("HTML Format", &data));
        assert!(is_line_copy(VISUAL_STUDIO_LINE_COPY, &[]));
    }

    #[test]
    fn unicode_text_stops_at_nul() {
        let mut bytes = utf16("Zoë ₹ नमस्ते");
        bytes.extend([0, 0, 0x41, 0]);
        assert_eq!(text_from_utf16_bytes(&bytes), "Zoë ₹ नमस्ते");
        assert_eq!(text_from_utf16_bytes(&[]), "");
    }
}
