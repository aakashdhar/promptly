// promptly-helper — a small background process for the things Electron can't do on its own:
//   • hold-to-talk: sees the hotkey go down AND up (Electron's globalShortcut only sees presses)
//   • the app you're in (for destination-aware prompts)
//   • the text you've selected (command mode)
//   • the id of the front window, so Promptly can screenshot just that window
// It speaks JSON lines on stdin/stdout with Promptly's main process (see main/helper.js).
// Hotkey watching and selected text need the Accessibility permission; without it the helper
// still reports the frontmost app and Promptly falls back to tap-to-toggle.

import AppKit
import ApplicationServices
import Foundation

// MARK: - Output

let outputQueue = DispatchQueue(label: "promptly.helper.output")

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object),
          var line = String(data: data, encoding: .utf8) else { return }
    line += "\n"
    outputQueue.sync {
        FileHandle.standardOutput.write(line.data(using: .utf8)!)
    }
}

// MARK: - Hotkey

struct Hotkey {
    var keyCode: Int64 = 49                  // Space
    var modifiers: CGEventFlags = .maskAlternate
    var modifierOnly = false                  // e.g. Right Option or Fn held on its own
}

let relevantModifiers: CGEventFlags = [.maskCommand, .maskControl, .maskAlternate, .maskShift]

var hotkey = Hotkey()
var hotkeyDown = false
var eventTap: CFMachPort?

func flag(for keyCode: Int64) -> CGEventFlags? {
    switch keyCode {
    case 58, 61: return .maskAlternate       // left / right Option
    case 59, 62: return .maskControl         // left / right Control
    case 55, 54: return .maskCommand         // left / right Command
    case 56, 60: return .maskShift           // left / right Shift
    case 63: return .maskSecondaryFn         // Fn / Globe
    default: return nil
    }
}

func handle(type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = eventTap { CGEvent.tapEnable(tap: tap, enable: true) }
        return Unmanaged.passUnretained(event)
    }

    let keyCode = event.getIntegerValueField(.keyboardEventKeycode)

    if hotkey.modifierOnly {
        if type == .flagsChanged && keyCode == hotkey.keyCode, let mask = flag(for: keyCode) {
            let pressed = event.flags.contains(mask)
            if pressed && !hotkeyDown {
                hotkeyDown = true
                emit(["type": "hotkey", "phase": "down"])
            } else if !pressed && hotkeyDown {
                hotkeyDown = false
                emit(["type": "hotkey", "phase": "up"])
            }
        } else if type == .keyDown && hotkeyDown {
            // The modifier is being used for a shortcut or a special character, not to talk.
            hotkeyDown = false
            emit(["type": "hotkey", "phase": "cancel"])
        }
        return Unmanaged.passUnretained(event)   // never swallow modifier changes
    }

    guard type == .keyDown || type == .keyUp, keyCode == hotkey.keyCode else {
        return Unmanaged.passUnretained(event)
    }
    let active = event.flags.intersection(relevantModifiers)
    if type == .keyDown {
        guard active == hotkey.modifiers else { return Unmanaged.passUnretained(event) }
        if event.getIntegerValueField(.keyboardEventAutorepeat) == 0 && !hotkeyDown {
            hotkeyDown = true
            emit(["type": "hotkey", "phase": "down"])
        }
        return nil                                // Promptly owns this key: don't type it
    }
    if hotkeyDown {
        hotkeyDown = false
        emit(["type": "hotkey", "phase": "up"])
        return nil
    }
    return Unmanaged.passUnretained(event)
}

func installTap() -> Bool {
    if eventTap != nil { return true }
    let mask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)
    guard let tap = CGEvent.tapCreate(
        tap: .cgSessionEventTap,
        place: .headInsertEventTap,
        options: .defaultTap,
        eventsOfInterest: CGEventMask(mask),
        callback: { _, type, event, _ in handle(type: type, event: event) },
        userInfo: nil
    ) else { return false }
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
    eventTap = tap
    return true
}

// MARK: - Context

var enhancedPids = Set<pid_t>()

func frontmostApp() -> [String: Any] {
    guard let app = NSWorkspace.shared.frontmostApplication else { return [:] }
    return [
        "name": app.localizedName ?? "",
        "bundleId": app.bundleIdentifier ?? "",
        "pid": Int(app.processIdentifier),
    ]
}

// The frontmost app's main window, for a screenshot of what the user is looking at. Window
// numbers, owners and layers are readable without the Screen Recording permission; the capture
// itself (done by Promptly) is what needs it.
func frontWindowId(pid: pid_t) -> Int? {
    guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
    for info in list {
        guard (info[kCGWindowOwnerPID as String] as? Int).map({ pid_t($0) }) == pid,
              (info[kCGWindowLayer as String] as? Int) == 0,
              let bounds = info[kCGWindowBounds as String] as? [String: Any],
              let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double,
              width >= 120, height >= 80,
              let number = info[kCGWindowNumber as String] as? Int else { continue }
        return number   // the list is front to back, so the first match is the front window
    }
    return nil
}

func copyAttribute(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success ? value : nil
}

func selectedText() -> String? {
    guard AXIsProcessTrusted() else { return nil }
    if let app = NSWorkspace.shared.frontmostApplication, !enhancedPids.contains(app.processIdentifier) {
        // Electron and Chromium apps only build their accessibility tree when asked.
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetAttributeValue(appElement, "AXManualAccessibility" as CFString, kCFBooleanTrue)
        AXUIElementSetAttributeValue(appElement, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
        enhancedPids.insert(app.processIdentifier)
    }
    let system = AXUIElementCreateSystemWide()
    guard let focused = copyAttribute(system, kAXFocusedUIElementAttribute) else { return nil }
    guard let text = copyAttribute(focused as! AXUIElement, kAXSelectedTextAttribute) as? String else { return nil }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    return String(trimmed.prefix(20000))
}

// MARK: - Status

var lastTrusted: Bool?

func status() -> [String: Any] {
    let trusted = AXIsProcessTrusted()
    let tap = trusted ? installTap() : false
    return ["type": "status", "trusted": trusted, "tap": tap]
}

func reportStatusIfChanged() {
    let trusted = AXIsProcessTrusted()
    if trusted != lastTrusted {
        lastTrusted = trusted
        emit(status())
    }
}

// MARK: - Commands

func modifiers(from names: [String]) -> CGEventFlags {
    var flags: CGEventFlags = []
    for name in names {
        switch name {
        case "command": flags.insert(.maskCommand)
        case "control": flags.insert(.maskControl)
        case "option": flags.insert(.maskAlternate)
        case "shift": flags.insert(.maskShift)
        default: break
        }
    }
    return flags
}

func handleCommand(_ line: String) {
    guard let data = line.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let cmd = object["cmd"] as? String else { return }
    let id = object["id"] ?? NSNull()
    switch cmd {
    case "configure":
        if let key = object["hotkey"] as? [String: Any] {
            hotkey.keyCode = Int64((key["keyCode"] as? Int) ?? 49)
            hotkey.modifiers = modifiers(from: (key["modifiers"] as? [String]) ?? [])
            hotkey.modifierOnly = (key["modifierOnly"] as? Bool) ?? false
            hotkeyDown = false
        }
        var reply = status()
        reply["id"] = id
        emit(reply)
    case "context":
        let app = frontmostApp()
        let windowId = (app["pid"] as? Int).flatMap { frontWindowId(pid: pid_t($0)) }
        emit(["type": "context", "id": id, "app": app, "windowId": windowId ?? NSNull(), "selectedText": selectedText() ?? NSNull()])
    case "status":
        var reply = status()
        reply["id"] = id
        emit(reply)
    case "requestAccess":
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
        var reply = status()
        reply["id"] = id
        emit(reply)
    default:
        emit(["type": "error", "id": id, "message": "unknown command \(cmd)"])
    }
}

// MARK: - Main

setvbuf(stdout, nil, _IONBF, 0)

var inputBuffer = ""
FileHandle.standardInput.readabilityHandler = { handle in
    let data = handle.availableData
    if data.isEmpty { exit(0) }                // Promptly quit: stdin closed
    guard let chunk = String(data: data, encoding: .utf8) else { return }
    DispatchQueue.main.async {
        inputBuffer += chunk
        while let newline = inputBuffer.firstIndex(of: "\n") {
            let line = String(inputBuffer[..<newline])
            inputBuffer.removeSubrange(...newline)
            if !line.isEmpty { handleCommand(line) }
        }
    }
}

lastTrusted = AXIsProcessTrusted()
var ready = status()
ready["type"] = "ready"
emit(ready)

// Accessibility can be granted while we're running; notice and start watching the hotkey.
Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in reportStatusIfChanged() }

RunLoop.main.run()
