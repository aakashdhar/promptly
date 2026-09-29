# FEATURE_TASKS — AI provider fallbacks
> **Estimated effort:** 9 tasks — S: 2, M: 5, L: 2 — approx. 22 hours total
> Branch: feature/ai-providers. Never commit to main. Ask before running the full e2e suite.

---
### AIP-001 · Provider table and OpenAI-compatible client
- **Status**: `[x]` · **Size**: L · **Spec ref**: FEATURE_SPEC.md#5, #7, #8 · **Dependencies**: None
- **Touches**: main/ai-providers.js (new), main/ai-api.js (new), tests/ai.test.js (new)

**What to do**: Provider table for openai (`https://api.openai.com/v1`), gemini (`https://generativelanguage.googleapis.com/v1beta/openai`), grok (`https://api.x.ai/v1`). `listModels` (GET /models, Bearer key, normalise `models/…` ids). `pickModels(ids, provider)` → best general model and best fast model by pattern and version (newest first), falling back to the first id. `createApiRunner`: chat completions, SSE streaming with deltas, non-streaming, AbortController cancel through a shared set, timeout, error mapping (401/403 → auth, 429 → rate, other → unknown, network → offline), result shape identical to the Claude runner plus `provider`.

**Acceptance criteria**:
- [ ] Streams deltas and returns the final text; non-stream returns text
- [ ] 401 → `errorType:'auth'` with a provider-named message; 429 → `'rate'`; offline → `'offline'`; timeout → `'timeout'`; abort → `cancelled`
- [ ] Model picking works on sample lists for all three providers without exact names

**Test requirement**: tests/ai.test.js against a local http server (streaming, errors, abort).
**⚠️ Boundaries**: no SDKs, no runtime deps; keys never logged.
**CODEBASE.md update?**: Yes (AIP-009).
**Decisions**:
- Model picking works from each provider's own list (chat-only filter, version order, fast words as whole words — "gemini" contains "mini"); OpenAI gets max_completion_tokens for reasoning models.
---
### AIP-002 · Encrypted key storage
- **Status**: `[x]` · **Size**: S · **Spec ref**: #3, #6 · **Dependencies**: None
- **Touches**: main/secrets.js (new), tests/ai.test.js

**What to do**: `createSecrets({ safeStorage })` with `available()`, `encrypt(key)` → base64, `decrypt(b64)`; refuses when unavailable.
**Acceptance criteria**: - [ ] round-trip with a fake safeStorage - [ ] refuses when unavailable
**Test requirement**: unit tests with an injected fake.
**Decisions**:
- Refuse rather than fall back to plain text when safeStorage is unavailable; unreadable ciphertext (moved profile, reset Keychain) reads as 'no key'.
---
### AIP-003 · Router and wiring in main
- **Status**: `[ ]` · **Size**: M · **Spec ref**: #3.4, #3.5, #3.6, #3.10 · **Dependencies**: AIP-001, AIP-002
- **Touches**: main/llm.js, main.js, tests/ai.test.js

**What to do**: `createAiRouter` in llm.js (mode resolution per call, `active()`, `cancelAll` both). In main.js wrap `claude`, `evalClaude`, `cleanupClaude` (fast model) with routers; track `claudeReady` from the startup/settings status checks; Harness handlers use the Claude runner and return `needs-claude` when the active provider isn't Claude; the settings Test uses the router.
**Acceptance criteria**: - [ ] resolution matrix tested - [ ] no key saved → identical Claude calls (existing tests green) - [ ] Harness gated
**Decisions**:
- None yet.
---
### AIP-004 · AI settings IPC
- **Status**: `[ ]` · **Size**: M · **Spec ref**: #7 · **Dependencies**: AIP-003
- **Touches**: main.js, preload.js, tests/ipc-contract.test.js

**What to do**: handlers `get-ai-settings`, `save-ai-key` (validate by listModels, pick models, encrypt, save), `remove-ai-key`, `set-ai-settings`, `list-ai-models`, `test-ai`. Renderer never receives a key.
**Acceptance criteria**: - [ ] contract test green - [ ] refused key not saved
**Decisions**:
- None yet.
---
### AIP-005 · Settings › AI tab
- **Status**: `[ ]` · **Size**: L · **Spec ref**: #3.1, #3.2 · **Dependencies**: AIP-004
- **Touches**: src/renderer/components/AiProviderSection.jsx (new), src/renderer/components/SettingsPanel.jsx

**What to do**: tab with mode, provider, masked key + Save/Remove, model and fast model selects, Test with result line; theme tokens, 11–17 px.
**Acceptance criteria**: - [ ] all controls work against the IPC - [ ] saved keys show only last 4
**Decisions**:
- None yet.
---
### AIP-006 · Setup: "Use an API key instead"
- **Status**: `[ ]` · **Size**: M · **Spec ref**: #3.7 · **Dependencies**: AIP-004
- **Touches**: splash.html

**What to do**: on the Claude Code step (every state), a secondary button reveals provider select + key input + "Check key"; success saves (mode stays auto) and continues to the next step.
**Acceptance criteria**: - [ ] setup completes without Claude Code when a valid key is given - [ ] scripts/assert-splash.js still passes
**Decisions**:
- None yet.
---
### AIP-007 · Provider-aware errors, Harness message, neutral wording
- **Status**: `[ ]` · **Size**: M · **Spec ref**: #3.6, #3.8, #3.9 · **Dependencies**: AIP-003
- **Touches**: src/renderer/hooks/useDictation.js, src/renderer/components/ExpandedErrorContent.jsx, src/renderer/hooks/useHarnessBuilder.js, splash.html, SettingsPanel.jsx copy

**What to do**: auth/rate/offline messages come from main when the provider isn't Claude; Harness shows "Harness needs Claude Code" for `needs-claude`; "only text goes to Claude" copy in the app becomes provider-neutral.
**Decisions**:
- None yet.
---
### AIP-008 · e2e fake provider
- **Status**: `[ ]` · **Size**: M · **Spec ref**: #10 · **Dependencies**: AIP-004
- **Touches**: e2e/fakes/ (new fake server), e2e spec (new test only)

**What to do**: a local OpenAI-compatible fake and one e2e test (key saved, no Claude → a Craft prompt comes back). Ask the owner before running e2e.
**Decisions**:
- None yet.
---
### AIP-009 · Docs
- **Status**: `[ ]` · **Size**: S · **Dependencies**: all
- **Touches**: vibe/DECISIONS.md, vibe/ARCHITECTURE.md, CLAUDE.md, vibe/CODEBASE.md, vibe/IMPLEMENTATION_LOG.md
---

#### Conformance: AI provider fallbacks
- [ ] Spec criteria 1–10 hold
- [ ] All new tests pass · all existing tests pass · lint clean
- [ ] No change for Claude Code users with no key saved
- [ ] CODEBASE.md / ARCHITECTURE.md / DECISIONS.md updated
