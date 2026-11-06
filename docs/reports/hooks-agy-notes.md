# Kiro Hooks Implementation Notes

**Author:** Antigravity (agy), awaiting Kiro review  
**Date:** 2026-11-06  
**Context:** Implemented from Kiro Prompt 6 at the owner's request.

---

## 1. Status and Verification Warning

> [!WARNING]
> **UNTESTED INSIDE KIRO**: These hooks were created and validated syntactically and structurally by Antigravity outside of the active Kiro environment. Antigravity does NOT run inside Kiro's IDE process and cannot observe the Kiro hooks panel or runtime event bus.
> 
> The repository owner must open Kiro and explicitly verify that:
> 1. All hooks appear enabled in Kiro's Hooks panel (`.kiro/hooks/`).
> 2. `PostFileSave` triggers fire when editing matching CSS or component files.
> 3. `PreCommit` prompt appears when staging/initiating a git commit in Kiro.

---

## 2. Hooks Created

Three hooks were created in `.kiro/hooks/` conforming strictly to the existing schema (`version: "v1"`):

### Hook 1: `.kiro/hooks/css-guard-on-save.json`
- **Name:** CSS guard on save
- **Trigger:** `PostFileSave`
- **Matcher:** `frontend[\\/]src[\\/]styles[\\/].*\\.css$`
- **Action Type:** `command`
- **Command:** `npx vitest run tests/labTheme.prop.test.ts tests/css.imports.test.ts --reporter=dot`
- **Purpose:** Safeguards CSS import ordering, token conformance, and Frankenstein lab animation properties whenever stylesheets are saved.
- *Note:* `tests/labTheme.prop.test.ts` is being implemented by lane `x-kiro45` (Prompt 4); it is included in the command per Prompt 6 specifications. `tests/css.imports.test.ts` already exists and passes.

### Hook 2: `.kiro/hooks/a11y-on-save.json`
- **Name:** Accessibility guard on save
- **Trigger:** `PostFileSave`
- **Matcher:** `frontend[\\/]src[\\/](screens|components)[\\/].*\\.(tsx|ts)$`
- **Action Type:** `command`
- **Command:** `npx vitest run tests/a11y.contrast.test.ts tests/a11y.targets.test.ts tests/a11y.motion.test.ts tests/screens.render.test.ts --reporter=dot`
- **Purpose:** Automatically validates WCAG AAA contrast (7:1), minimum 48×48 px touch targets, motion preferences, and server rendering markup on every screen or UI component save.
- *Verification:* All 4 referenced test files exist on disk in `frontend/tests/` and pass.

### Hook 3: `.kiro/hooks/pre-commit-build-log.json`
- **Name:** Pre-commit build log check
- **Trigger:** `PreCommit`
- **Action Type:** `agent`
- **Prompt:** `"A commit is being prepared. Check docs/BUILD_LOG.md to ensure the latest changes are attributed honestly to the tool that built them (Kiro, Antigravity, or Claude Code). Verify that what was built, what broke, and all files touched are listed, and that agent work is never claimed as Kiro's."`
- **Purpose:** Prompts the agent before commit to enforce honest tool attribution in `docs/BUILD_LOG.md`.

---

## 3. Structural Validation

A dedicated Vitest test suite (`frontend/tests/kiro.hooks.test.ts`) parses every JSON hook file in `.kiro/hooks/`, verifying:
- Valid JSON formatting.
- Mandatory schema keys (`version`, `hooks`, `name`, `trigger`, `action`, `description`).
- Valid action types (`command` or `agent`).
- Compilability of all regex matcher strings (`new RegExp(matcher)`).
