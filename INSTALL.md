# Installing Promptly

You need a Mac with macOS 12 or later and a Claude account. Everything else is set up from inside Promptly.

## Install

1. Open `Promptly-<version>-signed.dmg` and drag **Promptly** into **Applications**.
2. Open Promptly from Applications. The first time, macOS blocks it because it isn't from the App Store or an identified developer. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Promptly, then **Open**. You only do this once. (The DMG window shows these steps too.)
4. Promptly's setup takes about a minute:
   - **Microphone.** Click **Allow microphone** and accept the macOS prompt.
   - **Claude Code.** Promptly checks for it. If it's missing, click **Install Claude Code**: Terminal opens and runs Anthropic's installer. If you're signed out, click **Sign in to Claude**: Terminal opens and your browser finishes the sign-in. Promptly notices when either is done, so there's nothing to click afterwards.
5. Press **⌥ Space** (Option + Space) anywhere, talk, and press it again.

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
I built a small Mac app called Promptly: press Option+Space, say what you want Claude to do, and it turns it into a properly structured Claude prompt ready to paste.

Download: [link]

Open the DMG and drag Promptly to Applications. The first time you open it, macOS will block it (it's not from the App Store): go to System Settings → Privacy & Security → Open Anyway. The DMG window shows this too.

Setup is one minute: allow the microphone, and Promptly will install or sign in to Claude Code for you if needed. Then just press Option+Space and talk.
```
