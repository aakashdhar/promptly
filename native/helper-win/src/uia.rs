// UI Automation: the focused element, whether it's a password field, and its selected text.
// It runs on its own thread (COM, multithreaded apartment, one CUIAutomation for the session:
// creating it costs tens of milliseconds). A hung app must not hold Promptly up, so each query
// has half a second, like the Swift helper's AX timeout; a late answer is dropped.

#[cfg(windows)]
pub use win::focused;

#[cfg(windows)]
mod win {
    use std::sync::mpsc::{self, Sender};
    use std::sync::{Mutex, OnceLock};
    use std::thread;
    use std::time::Duration;

    use windows::core::Interface;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
    use windows::Win32::UI::Accessibility::{
        CUIAutomation8, IUIAutomation, IUIAutomation2, IUIAutomationTextPattern, UIA_TextPatternId,
    };

    use crate::context::{Focus, MAX_SELECTED_CHARS};

    const BUDGET: Duration = Duration::from_millis(500);
    const BUDGET_MS: u32 = 500;

    type Job = Sender<Option<Focus>>;

    fn worker() -> Option<&'static Mutex<Sender<Job>>> {
        static WORKER: OnceLock<Option<Mutex<Sender<Job>>>> = OnceLock::new();
        WORKER
            .get_or_init(|| {
                let (tx, rx) = mpsc::channel::<Job>();
                thread::Builder::new()
                    .name("uia".into())
                    .spawn(move || {
                        // SAFETY: COM is initialised once on this thread, which lives for the session.
                        let automation = unsafe {
                            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                            CoCreateInstance::<_, IUIAutomation>(&CUIAutomation8, None, CLSCTX_INPROC_SERVER).ok()
                        };
                        if let Some(automation2) = automation.as_ref().and_then(|a| a.cast::<IUIAutomation2>().ok()) {
                            // Bounds each call into a slow app, so this thread comes free for the
                            // next question instead of waiting on a hung one.
                            // SAFETY: setters on a live COM object.
                            unsafe {
                                let _ = automation2.SetConnectionTimeout(BUDGET_MS);
                                let _ = automation2.SetTransactionTimeout(BUDGET_MS);
                            }
                        }
                        for reply in rx {
                            let focus = automation.as_ref().and_then(query);
                            let _ = reply.send(focus);
                        }
                    })
                    .ok()?;
                Some(Mutex::new(tx))
            })
            .as_ref()
    }

    // None when UI Automation isn't available or didn't answer within the budget.
    pub fn focused() -> Option<Focus> {
        let (reply, answer) = mpsc::channel();
        worker()?.lock().ok()?.send(reply).ok()?;
        answer.recv_timeout(BUDGET).ok().flatten()
    }

    fn query(automation: &IUIAutomation) -> Option<Focus> {
        // SAFETY: calls on live COM objects; every result is checked.
        unsafe {
            let element = automation.GetFocusedElement().ok()?;
            let mut focus = Focus {
                is_password: element.CurrentIsPassword().ok()?.as_bool(),
                class_name: element.CurrentClassName().map(|s| s.to_string()).unwrap_or_default(),
                name: element.CurrentName().map(|s| s.to_string()).unwrap_or_default(),
                ..Focus::default()
            };
            if focus.is_password {
                return Some(focus);
            }
            let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId) else {
                return Some(focus);
            };
            focus.has_text_pattern = true;
            let Ok(ranges) = pattern.GetSelection() else {
                return Some(focus);
            };
            let mut parts = Vec::new();
            for i in 0..ranges.Length().unwrap_or(0) {
                let Ok(range) = ranges.GetElement(i) else { continue };
                // Room for leading whitespace that clean_selection trims before capping.
                if let Ok(text) = range.GetText((MAX_SELECTED_CHARS * 2) as i32) {
                    parts.push(text.to_string());
                }
            }
            let text = parts.join("\n");
            focus.selection = (!text.trim().is_empty()).then_some(text);
            Some(focus)
        }
    }
}
