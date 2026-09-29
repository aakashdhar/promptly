# FEATURE_SPEC — AI provider fallbacks (bring your own key)
> Folder: vibe/features/2026-09-29-ai-provider-fallbacks/ · Branch: feature/ai-providers (never main until the owner merges)
> Amends D-CLI-ONLY (see DECISIONS.md D-AI-PROVIDERS). Design agreed with the owner 2026-09-29 ("go with your suggestions").

## 1. Overview
Claude Code stays Promptly's default and recommended AI. Teammates without Claude Code (or an Anthropic plan) can paste their own OpenAI, Gemini or Grok API key in Settings or during setup, and every AI feature except Harness then runs on that key. By default the choice is automatic: Claude Code when it's installed and signed in, otherwise the key.

## 2. User stories
- As someone without Claude Code, I paste my OpenAI/Gemini/Grok key during setup and can use Craft, the builders, the scorecard and the Dictation clean-up.
- As a Claude Code user, nothing changes: everything still runs through Claude Code, and a saved key is only used if Claude Code stops being available.
- As a user with both, I can force one: "Always Claude Code" or "Always my key".
- As any user, my key is stored encrypted on this computer and never shown back in full.

## 3. Acceptance criteria
1. Settings has an **AI** tab: provider mode (Automatic — recommended / Claude Code / My API key), API provider (OpenAI, Gemini, Grok), key field (masked; saved keys show only the last 4 characters), model and "fast model" pickers filled from the provider's model list, and a Test button.
2. Saving a key validates it by fetching the provider's model list; a refused key shows a plain error and is not saved. On success the default model and fast model are preselected from that list: only chat models are considered (ids starting `gpt-` or `o<digit>` for OpenAI, `gemini-` for Gemini, `grok-` for Grok; ids containing embedding, audio, image, tts, realtime, search, transcribe, preview or exp are excluded). **model** = the highest-versioned id without `mini|nano|flash|lite|fast`; **fast model** = the highest-versioned id with one of those; if a group is empty, the other group's pick, then the first id. The user can change both.
3. Keys are encrypted with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows) and stored only in encrypted form. A key typed by the user crosses from the renderer to main once (`save-ai-key`); main never sends a saved key back, and the renderer only gets `{ saved, last4 }`. Keys are never logged. When `safeStorage` isn't available, saving is refused with: This computer can't store keys securely, so Promptly won't save it.
4. Automatic mode: every AI call uses Claude Code when it is ready, otherwise the saved key; if neither is available, the existing "Claude Code not set up" errors appear with a hint to add a key. **Claude ready** = `claudePath` resolved and the last `getClaudeStatus()` said signed in; refreshed at startup and after setup/Settings checks, and set false when a Claude call fails with `errorType: 'auth'`.
5. Covered on a key: all Craft text modes (streaming where the provider streams), email (JSON), Iterate/revise, image/video/workflow builder steps, style learning, the scorecard, and the Dictation clean-up (using the fast model).
6. Harness is Claude Code only: when the active provider isn't Claude Code, Harness shows "Harness needs Claude Code" instead of running; nothing else about Harness changes.
7. The setup wizard's Claude Code step offers **"Use an API key instead"**: pick a provider, paste a key, it's checked, and setup continues without Claude Code.
8. Errors name the provider (P = OpenAI, Gemini or Grok): 401/403 → `errorType: 'auth'`, "Your P key was refused. Check it in Settings › AI."; 429 → `'rate'`, "P says you've hit a rate or usage limit. Try again in a minute."; network failure → `'offline'`, "Couldn't reach P. Check your connection."; timeout → `'timeout'` and cancel → `cancelled`, as today.
9. In-app wording that promises "only text goes to Claude" becomes provider-neutral ("only text goes to your AI provider") where it's user-facing in the app (splash, Settings, Speech tab). The website is out of scope.
10. Claude Code users see no behaviour change: with no key saved, every call goes through Claude Code exactly as today (same prompts, flags, timeouts).

## 4. Scope
**In:** OpenAI, Gemini (its OpenAI-compatible endpoint), Grok (xAI) through one OpenAI-compatible HTTP client; Settings AI tab; setup path; provider-aware errors; Harness gate; tests.
**Deferred:** Ollama / local models and custom base URLs (the client supports a base URL, but no UI yet); per-feature provider choice; usage/cost display; team-wide shared keys; the website copy (index.html, site/) until the owner merges to main.

## 5. Integration points
- `main/llm.js` — stays the only place AI is called (ARCHITECTURE rule 1, amended): adds the provider router; `createClaudeRunner` unchanged.
- New `main/ai-api.js` (OpenAI-compatible client), `main/ai-providers.js` (provider table, model picking), `main/secrets.js` (safeStorage wrapper).
- `main.js` — the runners (`claude`, `evalClaude`, `cleanupClaude`) are wrapped by the router; call sites unchanged except Harness (Claude only) and the settings Test; new IPC handlers.
- `preload.js` + `tests/ipc-contract.test.js` — new channels.
- `src/renderer/components/SettingsPanel.jsx` (+ a new `AiProviderSection.jsx`), `useDictation.js` / `ExpandedErrorContent.jsx` (auth wording), Harness entry point (gate).
- `splash.html` — Claude Code step alternative.
- `config.json` (via `main/config.js`): new keys below.

## 6. Data model (config.json)
- `aiMode`: `'auto' | 'claude' | 'api'` (default `'auto'`)
- `apiProvider`: `'openai' | 'gemini' | 'grok'` (default none)
- `apiKeys`: `{ [provider]: '<base64 of safeStorage.encryptString(key)>' }`
- `apiModels`: `{ [provider]: { model: string, fastModel: string } }`
No history/profile format changes.

## 7. IPC (all via preload)
- `get-ai-settings` → `{ mode, provider, providers:[{id,label}], keys:{[id]:{saved,last4}}, models:{…}, claudeReady, active }`
- `save-ai-key` (provider, key) → `{ ok, error?, models?: string[], model, fastModel }`
- `remove-ai-key` (provider) → `{ ok }`
- `set-ai-settings` ({ mode?, provider?, model?, fastModel? }) → settings
- `list-ai-models` (provider) → `{ ok, models, error? }`
- `test-ai` () → `{ ok, provider, model, ms, error? }`

## 8. Edge cases
- Key saved but refused later (revoked) → auth error naming the provider; Automatic mode does not silently switch providers mid-request.
- Provider streams no deltas or doesn't support streaming → fall back to the final text.
- Gemini model ids come as `models/…` → normalised.
- `safeStorage` unavailable (some Linux, tests) → key saving refused with a message; tests inject a fake.
- Network offline → "Couldn't reach OpenAI" style error; Dictation clean-up falls back to local text as today.
- Very long outputs (workflow JSON) → provider max tokens set generously; timeouts as today.
- Claude Code becomes available after a key was used → Automatic uses Claude Code from the next call.

## 9. Non-functional
- Zero runtime npm dependencies (global `fetch`, no SDKs).
- Keys never logged, never sent to the renderer, never in plain text on disk.
- Cancel aborts the HTTP request (AbortController) through the same "cancel all" path.
- Works on macOS and Windows.

## 10. Conformance checklist
- [ ] Criteria 1–10 above hold
- [ ] Claude Code path byte-for-byte unchanged when no key is saved (existing tests green)
- [ ] New unit tests: client (streaming + errors, local HTTP server), model picking, router, secrets
- [ ] IPC contract test green with the new channels
- [ ] Lint 0 errors; `npm test` green
- [ ] e2e: only with the owner's go-ahead (it opens app windows)
- [ ] DECISIONS D-AI-PROVIDERS, ARCHITECTURE rule 1 + CLAUDE.md rule 1 amended, CODEBASE updated
