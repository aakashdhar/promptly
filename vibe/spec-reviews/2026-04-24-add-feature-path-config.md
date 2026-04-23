# Spec Review — FEATURE-013 Path Configuration Panel
> Date: 2026-04-24 | Trigger: add-feature | Verdict: fixed

## Documents audited
- vibe/features/2026-04-23-path-config/FEATURE_SPEC.md
- vibe/features/2026-04-23-path-config/FEATURE_PLAN.md
- vibe/features/2026-04-23-path-config/FEATURE_TASKS.md
- vibe/ARCHITECTURE.md (cross-check)

## Findings and resolutions

### P0-001 · electron-store runtime dependency — FIXED
- **Issue**: FEATURE_SPEC.md listed electron-store as a dependency, violating ARCHITECTURE.md zero-runtime-deps hard constraint.
- **Fix**: Replaced with native `readConfig()` / `writeConfig()` using built-in `fs` + `app.getPath('userData')`. No npm install. FEATURE_SPEC.md, FEATURE_PLAN.md PCFG-001 detail, and FEATURE_TASKS.md PCFG-001 all updated.

### P1-001 · PCFG-003 HTML not captured in any doc — FIXED
- **Issue**: PCFG-003 task referenced FEATURE_SPEC.md for exact HTML markup, but spec contained none.
- **Fix**: Full gear icon button HTML + pathPanel div HTML added to FEATURE_PLAN.md under PCFG-003 detail section, including all element IDs used by PCFG-004 JS.

### P1-002 · Tray acceptance criterion unverifiable — FIXED
- **Issue**: "Tray menu opens the panel" criterion could not be satisfied — panel only exists in splash.html, not in main app renderer.
- **Fix**: Criterion updated in FEATURE_SPEC.md and FEATURE_TASKS.md conformance list to clarify: sends open-settings to main renderer (console stub); full in-app panel deferred to future SETTINGS state feature.

### P1-003 · electron-store ESM incompatibility — MOOT
- **Issue**: electron-store v9+ is ESM-only; would break CommonJS require() in main.js.
- **Resolution**: Moot — P0-001 fix removes electron-store entirely.

### P2-001 · innerHTML for static hint span — NOTED
- Noted in FEATURE_PLAN.md PCFG-004 detail. Content is developer-controlled static HTML (not user input), so compliant with ARCHITECTURE.md. Alternative: two sibling elements.

### P2-002 · Missing visual spec for hint text — FIXED
- **Fix**: Acceptance criterion updated with visual spec: font-size 10px, opacity 0.5, margin-left 4px.

### O'Reilly gap · Git commit format missing — FIXED
- **Fix**: Commit format added to FEATURE_TASKS.md header.

## Final verdict
✅ All P0 and P1 findings resolved. Spec ready for build.
