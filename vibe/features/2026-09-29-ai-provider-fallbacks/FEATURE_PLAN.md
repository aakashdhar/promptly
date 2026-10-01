# FEATURE_PLAN — AI provider fallbacks
> Spec: FEATURE_SPEC.md · Branch: feature/ai-providers (no commits to main)

## 1. Impact map
**New files**
- `main/ai-providers.js` — provider table (id, label, baseUrl, key hint), `normaliseModelId`, `pickModels(ids, provider)` → `{ model, fastModel }` by pattern + version, never a hard requirement on a name.
- `main/ai-api.js` — `createApiRunner({ getConfig, children, fetchImpl })`: `run(prompt, { timeoutMs, onDelta, fast, json })` → same result shape as the Claude runner (`{ success, prompt, error, errorType, provider }`), SSE streaming, AbortController cancel, error mapping (401/403 auth, 429 rate, 5xx, network, timeout); `listModels(provider, key)`.
- `main/secrets.js` — `createSecrets({ safeStorage })`: `encrypt`, `decrypt`, `available()`.
- `src/renderer/components/AiProviderSection.jsx` — the Settings AI tab body.
- `tests/ai.test.js` — unit tests for all of the above against a local HTTP server.

**Modified**
- `main/llm.js` — `createAiRouter({ claude, api, getMode, isClaudeReady, hasKey })` with `run` / `cancelAll` / `active()`; export.
- `main.js` — wrap `claude`, `evalClaude`, `cleanupClaude` in routers (Claude runners unchanged); Harness handlers call the Claude runner and return `{ errorType: 'needs-claude' }` when the active provider isn't Claude; `claudeReady` tracking from the existing status check; new IPC handlers (§7 of spec); provider-aware error text; neutral privacy copy in setup-info copy if any.
- `preload.js`, `tests/ipc-contract.test.js` — new channels (extend, don't rewrite).
- `src/renderer/components/SettingsPanel.jsx` — `['ai', 'AI', …]` tab rendering `AiProviderSection`; Prompts tab "Claude model" hint unchanged.
- `src/renderer/hooks/useDictation.js`, `src/renderer/components/ExpandedErrorContent.jsx` — auth message uses the provider's message when `result.provider !== 'claude'`.
- `src/renderer/hooks/useHarnessBuilder.js` — show "Harness needs Claude Code" for `needs-claude`.
- `splash.html` — "Use an API key instead" on the Claude Code step (vanilla JS, same IPC).
- `e2e/fakes/` — a fake OpenAI-compatible server for an optional e2e (only run with owner's go-ahead).
- Docs: DECISIONS (D-AI-PROVIDERS), ARCHITECTURE rule 1, CLAUDE.md rule 1, CODEBASE.

## 2. Out of scope (don't touch)
`index.html`, `site/**` (website), `native/**`, release/packaging scripts, Harness prompts/scheduler, whisper/speech code, history/profile formats, `main/claude-setup.js` behaviour.

## 3. Data
config.json keys `aiMode`, `apiProvider`, `apiKeys` (encrypted, base64), `apiModels` — written only through `main/config.js`.

## 4. Backend
Router rule (per call): `mode==='claude'` → Claude; `mode==='api'` → API (error if no key); `mode==='auto'` → Claude if ready, else API if a key for `apiProvider` is saved, else Claude (existing not-set-up errors). Thinking flag, lean flags and prompts for Claude unchanged. API: system message = llm.js SYSTEM_PROMPT; user message = the same prompt text; `max_tokens` generous (8192; 16384 for workflow JSON); `stream: true` only when `onDelta`; `fast: true` (Dictation clean-up) uses `fastModel`.

## 5. Frontend
AI tab (Row/Section/Switch primitives, theme tokens, 11–17 px type): mode radio, provider select, key field + Save/Remove, model + fast model selects, Test button with result line. Splash: a secondary button on the Claude step opens a small form (provider select, key input, Check key), on success → next step.

## 6. Conventions
CommonJS `'use strict'` in main; IPC = preload method + `ipcMain.handle`; no shell strings; theme tokens only; `stateRef.current` in handlers; code and doc commits separate; `feat(ai-providers): AIP-0NN — …`.

## 7. Tasks
AIP-001 providers + API client · AIP-002 secrets · AIP-003 router + wiring · AIP-004 IPC · AIP-005 Settings AI tab · AIP-006 setup path · AIP-007 errors, Harness gate, wording · AIP-008 e2e fake (+ ask before running) · AIP-009 docs.

## 8. Rollback
Branch-only until merged. After merge: set `aiMode` to `claude` (or remove keys) to restore today's behaviour; code revert is one merge commit.

## 9. Testing
Unit: provider table/model picking; client streaming, non-streaming, JSON, 401/429/500, network error, abort; router resolution matrix; secrets with a fake safeStorage; prompts unchanged for Claude. IPC contract. e2e only with go-ahead.

## 10. CODEBASE.md sections
File map (3 new main modules, 1 component, tests), IPC list, config keys.
