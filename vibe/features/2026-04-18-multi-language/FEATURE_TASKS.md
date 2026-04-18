# FEATURE_TASKS.md — F-LANGUAGE: Multi-language Speech
> Folder: vibe/features/2026-04-18-multi-language/
> Created: 2026-04-18

> **Estimated effort:** 3 tasks — S: 2, M: 1 — approx. 3-4 hours total

Add a language setting for Whisper transcription. Default is auto-detection (Whisper's
default behaviour). User can pin to a specific language via a submenu. The setting persists
in localStorage. Passes `--language {code}` flag to Whisper CLI when not 'auto'.

---

### FLG-001 · Language storage module + getLanguage / setLanguage wrappers
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

1. Add constants after `MODES`:
```js
const LANGUAGES = [
  { code: 'auto',  label: 'Auto-detect' },
  { code: 'en',    label: 'English' },
  { code: 'es',    label: 'Spanish' },
  { code: 'fr',    label: 'French' },
  { code: 'de',    label: 'German' },
  { code: 'zh',    label: 'Chinese' },
  { code: 'ja',    label: 'Japanese' },
  { code: 'ko',    label: 'Korean' },
  { code: 'pt',    label: 'Portuguese' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'it',    label: 'Italian' },
];
const LANGUAGE_KEY = 'language';
```

2. Add wrapper functions after `getModeLabel()`:
```js
function getLanguage() { return localStorage.getItem(LANGUAGE_KEY) || 'auto'; }
function setLanguage(code) { localStorage.setItem(LANGUAGE_KEY, code); }
function getLanguageLabel() {
  return (LANGUAGES.find(l => l.code === getLanguage()) || LANGUAGES[0]).label;
}
```

3. Pass language to `transcribeAudio` IPC — update the call in `stopRecording()` onstop handler:
```js
const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer, getLanguage());
```

(preload.js and main.js are updated in FLG-002 to accept this second argument)

**Acceptance criteria**:
- [ ] `LANGUAGES` array constant defined with 12 language options
- [ ] `LANGUAGE_KEY` constant used — no string literals
- [ ] `getLanguage()` returns `'auto'` by default if nothing stored
- [ ] `setLanguage()` writes to localStorage via key constant
- [ ] `getLanguageLabel()` returns human label for current code
- [ ] `transcribeAudio()` call passes `getLanguage()` as second argument
- [ ] No direct `localStorage.*` outside wrappers

**Self-verify**: DevTools → `window.electronAPI.transcribeAudio(new ArrayBuffer(0), 'en')` — check main.js console would receive `'en'` as the language argument (next task wires this).
**⚠️ Boundaries**: `index.html` only. preload.js + main.js changes in FLG-002.
**CODEBASE.md update?**: No — wait for FLG-003.

---

### FLG-002 · Wire language to Whisper CLI + language submenu
- **Status**: `[ ]`
- **Size**: M
- **Dependencies**: FLG-001
- **Touches**: `main.js`, `preload.js`, `index.html`

**What to do**:

**main.js** — update `transcribe-audio` handler to accept and use language:

```js
ipcMain.handle('transcribe-audio', async (_event, arrayBuffer, language) => {
  if (!whisperPath) {
    return { success: false, error: 'Whisper not found — install via pip install openai-whisper' };
  }
  const tmpFile = path.join(os.tmpdir(), `promptly-${Date.now()}.webm`);
  const outDir = os.tmpdir();
  const txtFile = path.join(outDir, path.basename(tmpFile, '.webm') + '.txt');
  const langFlag = (language && language !== 'auto') ? `--language ${language}` : '';
  try {
    fs.writeFileSync(tmpFile, Buffer.from(arrayBuffer));
    const transcript = await new Promise((resolve, reject) => {
      exec(`"${whisperPath}" "${tmpFile}" --model tiny ${langFlag} --output_format txt --output_dir "${outDir}"`,
        { timeout: 60000 }, (err, _stdout, stderr) => {
          try {
            const text = fs.readFileSync(txtFile, 'utf8').trim();
            try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
            try { fs.unlinkSync(txtFile); } catch { /* ignore */ }
            resolve(text);
          } catch {
            reject(new Error(stderr || err?.message || 'Whisper output not found'));
          }
        });
    });
    return { success: true, transcript };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return { success: false, error: err.message || 'Transcription failed' };
  }
});
```

**main.js** — add `show-language-menu` IPC handler (after `show-mode-menu`):

```js
ipcMain.handle('show-language-menu', (_event, { currentLanguage, languages }) => {
  const menu = Menu.buildFromTemplate(languages.map(({ code, label }) => ({
    label,
    type: 'radio',
    checked: currentLanguage === code,
    click: () => { win.webContents.send('language-selected', code); },
  })));
  menu.popup({ window: win });
  return { ok: true };
});
```

**preload.js** — update `transcribeAudio` signature and add two new methods:

```js
transcribeAudio: (arrayBuffer, language) =>
  ipcRenderer.invoke('transcribe-audio', arrayBuffer, language),

showLanguageMenu: (currentLanguage, languages) =>
  ipcRenderer.invoke('show-language-menu', { currentLanguage, languages }),

onLanguageSelected: (callback) =>
  ipcRenderer.on('language-selected', (_event, code) => callback(code)),
```

**index.html** — add a language pill next to the mode pill in IDLE, and wire it:

Add to IDLE panel HTML (after mode pill):
```html
<span class="mode-pill" id="language-pill" style="-webkit-app-region:no-drag">Auto</span>
```

Add event listeners:
```js
document.getElementById('language-pill').addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.showLanguageMenu(getLanguage(), LANGUAGES);
});

window.electronAPI.onLanguageSelected((code) => {
  setLanguage(code);
  document.getElementById('language-pill').textContent = getLanguageLabel();
});
```

Also update the IDLE setState block to set the language pill text:
```js
document.getElementById('language-pill').textContent = getLanguageLabel();
```

**Acceptance criteria**:
- [ ] `transcribe-audio` IPC accepts `language` as second argument
- [ ] When `language !== 'auto'`, Whisper called with `--language {code}` flag
- [ ] When `language === 'auto'` (or undefined), no `--language` flag passed
- [ ] Language pill visible in IDLE state showing current language label
- [ ] Clicking language pill opens native radio menu with 12 options
- [ ] Selecting a language updates pill label and persists via `setLanguage()`
- [ ] `show-language-menu` and `language-selected` IPC channels added to ARCHITECTURE.md

**Self-verify**: Set language to French → speak in French → transcript is in French. Set back to Auto-detect → speak in English → transcript is in English.
**⚠️ Boundaries**: `langFlag` construction is safe — `language` comes from the LANGUAGES array's `code` field (validated at setLanguage time, values are short ISO codes with no shell-special characters). Still, validate that language code matches LANGUAGES array before constructing the flag.
**CODEBASE.md update?**: No — wait for FLG-003.

---

### FLG-003 · CODEBASE.md + ARCHITECTURE.md update
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: FLG-001, FLG-002
- **Touches**: `vibe/CODEBASE.md`, `vibe/ARCHITECTURE.md`

**What to do**:

CODEBASE.md:
- Add `LANGUAGES`, `LANGUAGE_KEY` constants to index.html file map
- Add `getLanguage()`, `setLanguage()`, `getLanguageLabel()` to index.html functions
- Add `language-pill` to DOM element IDs table
- Add `language` to localStorage keys table (default: `'auto'`)
- Update IPC channels table: `show-language-menu`, `language-selected`
- Update `transcribeAudio` preload.js entry to note second `language` argument
- Update "Last updated" line

ARCHITECTURE.md IPC surface table — add:
- `show-language-menu` (renderer → main): opens native radio menu for language selection
- `language-selected` (main → renderer): sent after language menu selection

**Acceptance criteria**:
- [ ] All new constants and functions listed in CODEBASE.md
- [ ] `language` localStorage key documented
- [ ] Two new IPC channels in ARCHITECTURE.md table
- [ ] "Last updated" updated

---

#### Conformance: F-LANGUAGE
- [ ] Language persists across app restarts
- [ ] `'auto'` passes no `--language` flag to Whisper (uses Whisper's own detection)
- [ ] Specific language codes pass `--language {code}` correctly
- [ ] Language pill visible in IDLE, updates on selection
- [ ] All 12 languages in menu, current language checked
- [ ] No shell injection risk in langFlag construction
- [ ] `npm run lint` passes
- [ ] CODEBASE.md + ARCHITECTURE.md updated
