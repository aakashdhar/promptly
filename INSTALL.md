# Installing Promptly

You need a Mac with macOS 12 or later and a Claude account. Everything else is set up from inside Promptly.

## Install

1. Open `Promptly-<version>-signed.dmg` and drag **Promptly** into **Applications**.
2. Open Promptly from Applications. The first time, macOS blocks it because it isn't from the App Store or an identified developer. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Promptly, then **Open**. You only do this once. (The DMG window shows these steps too.)
4. Promptly's setup takes about a minute:
   - **Microphone.** Click **Allow microphone** and accept the macOS prompt.
   - **Claude Code.** Promptly checks for it. If it's missing, click **Install Claude Code**: Terminal opens and runs Anthropic's installer. If you're signed out, click **Sign in to Claude**: Terminal opens and your browser finishes the sign-in. Promptly notices when either is done, so there's nothing to click afterwards.
   - **Talk from any app.** Click **Allow Accessibility** and turn on Promptly in System Settings. This turns on the double-tap Control shortcut, typing your words where your cursor is, and using text you've selected as context. You can skip it and turn it on later in Settings (until then the shortcut is ⌥ Space, and dictation is copied for ⌘V).
5. **Double-tap Control** in any app and talk; **tap Control once** when you're done (or double-tap and hold while you talk, and let go). A small pill at the bottom of the screen shows it's listening, then your words are typed where your cursor is. Prefer another shortcut? Settings → Talk shortcut (⌥ Space, Right Option, Fn, …). Without Accessibility, tap ⌥ Space to start and again to stop.

## Using it

- **Where you are shapes the prompt.** Talking from Terminal, VS Code or Cursor gives a task for a coding agent like Claude Code; from a browser or the Claude app, a self-contained chat prompt; from Figma, a design brief.
- **Select text first** to work on it: select an error, a paragraph or some code, pick a prompt mode, talk and say "fix this" or "turn this into a spec".
- **Dictation (the default): talk, and it types where your cursor is.** Double-tap Control in any app (Slack, Mail, Notes, a browser), talk, tap Control once. Your words appear as you said them: only "um" and "uh" are dropped, and saying "new line" or "new paragraph" makes a break. Nothing is rewritten, and your clipboard is put back afterwards. It runs entirely on your Mac, no internet or Claude needed. Typing into the app needs Accessibility (setup's Hold to talk step); without it, the text is copied for ⌘V.
- **Make it a prompt.** After dictating, the small pill offers **Make it a prompt**. Tap it and the same words become a structured prompt (Balanced by default; pick the style in Settings → Dictation). In the window, switch between **As I said it** and **As a prompt** any time. To always get prompts, pick a prompt mode (Balanced, Code, …) from the mode button.
- **Make it sound like you.** Settings → You: "How you write" shapes Polish and Email; "About you" (your role, your stack) shapes prompts. Paste a few things you've written and Promptly drafts the notes for you. Edit a prompt or email before copying it and Promptly remembers the change; after a few, it can suggest updates to your notes. Nothing changes without you choosing "Use these".
- **Say the mode first** to switch: "code mode, …", "email mode, …", "polish mode, …".
- **Settings** (⌘/): shortcut (including Right Option or Fn held on its own), a dictionary of names and terms to spell right, auto-copy, open at login, and light/dark.

Speech-to-text is built in and runs on your Mac. There's nothing to install for it: no Python, Whisper or ffmpeg.

## If something goes wrong

- **"Promptly is damaged and can't be opened"**: macOS sometimes says this about downloaded self-signed apps. Run this in Terminal, then open Promptly again:
  ```bash
  xattr -dr com.apple.quarantine /Applications/Promptly.app
  ```
- **Claude Code is installed somewhere unusual**: in setup, open **Already installed somewhere else?** and paste the path from `which claude`.
- **Setup again**: Promptly → Settings (⌘/) → **Recheck setup**.
- **Logs**: `~/Library/Logs/Promptly/main.log` shows what Promptly found at startup and any errors. Send it along when asking for help.

## Uninstall

While Promptly is running, right-click the menu bar icon and choose **Uninstall Promptly…**. It asks before removing the app, its data and its microphone permission.

Or run the uninstaller that ships inside the app:

```bash
bash /Applications/Promptly.app/Contents/uninstall.sh
```

---

## Message template for sharing

```
I built a small Mac app called Promptly: double-tap Control in any app and talk, and it types what you said where your cursor is (on your Mac, nothing rewritten). One tap turns it into a properly structured Claude prompt instead.

Download: [link]

Open the DMG and drag Promptly to Applications. The first time you open it, macOS will block it (it's not from the App Store): go to System Settings → Privacy & Security → Open Anyway. The DMG window shows this too.

Setup is one minute: allow the microphone, and Promptly will install or sign in to Claude Code for you if needed. Then just double-tap Control and talk.
```
