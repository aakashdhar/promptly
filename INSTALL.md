# Installing Promptly

## Prerequisites

- macOS 12 (Monterey) or later
- [Claude CLI](https://claude.ai/download) installed and working in your terminal
  (`claude --version` should print a version number)

## Install steps

1. Download `Promptly-signed.dmg`
2. Open the DMG — drag **Promptly** to your Applications folder
3. Launch Promptly from Applications
4. On first launch, grant microphone permission when prompted (one-time only)
5. Press **⌥ Space** (Option + Space) to start recording

That's it. Promptly lives in your menu bar and stays out of the way until you need it.

---

## If macOS says "Promptly cannot be verified" or "Promptly is damaged"

This is a Gatekeeper warning for apps that are self-signed but not notarized by Apple.
The app is safe — use one of the options below to open it.

### Option 1 — Remove quarantine attribute (recommended)

Open Terminal and run:

```
xattr -d com.apple.quarantine ~/Downloads/Promptly-signed.dmg
```

Then open the DMG normally and drag to Applications.

### Option 2 — Right-click bypass

1. Do **not** double-click the app
2. Right-click **Promptly** in Applications → **Open**
3. Click **Open** in the dialog that appears

### Option 3 — Allow in System Settings

1. Try to open Promptly — it will be blocked
2. Go to **System Settings → Privacy & Security**
3. Scroll to the Security section
4. Click **"Open Anyway"** next to the Promptly message
5. Confirm by clicking **Open** in the dialog

---

## Slack message template

```
Hey team — I built a small macOS tool called Promptly: you press Option+Space, say what you want Claude to do, and it turns your rambling voice note into a properly structured Claude prompt ready to copy.
Download: [link]
To get started: open the .dmg, drag it to Applications, launch it — it'll walk you through mic permission in one screen, then it's just Option+Space to go.
If macOS flags it as unverified: open Terminal and run: xattr -d com.apple.quarantine ~/Downloads/Promptly-signed.dmg — then open the DMG normally.
Concrete example: instead of typing "write a PRD for a feature", you say "I need Claude to write a PRD for the new export feature, make the user stories really specific, include edge cases, and keep it under two pages" — and you get back a prompt with role, task, constraints, and output format already written out.
Give it a try this week and drop any feedback in this thread!
```
