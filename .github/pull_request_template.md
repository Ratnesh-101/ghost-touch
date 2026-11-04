## Summary

<!-- Briefly describe the purpose and outcome of this change. -->

## AI tools used
<!-- Check all AI tools that contributed to this PR -->
- [ ] Kiro
- [ ] Antigravity
- [ ] Claude Code
- [ ] Gemini

## Changes
- <!-- Bulleted list of notable changes -->

## Accessibility & Guidelines Checklist
- [ ] All touch targets meet or exceed 48×48 CSS px (`.gt-control` / button styling)
- [ ] Every user-facing string routes through `t()` / i18n
- [ ] State transitions are spoken or announced politely
- [ ] No `any`, no `console.log()` / `print()` left in code
- [ ] Does not edit Kiro-owned files without coordination (see `AGENTS.md`)
- [ ] No secrets, tokens or `.env` files committed

## Testing & Verification
- [ ] Frontend tests pass (`npm --prefix frontend test`)
- [ ] Frontend builds cleanly (`npm --prefix frontend run build`)
- [ ] Frontend typecheck clean (`npm --prefix frontend exec -- tsc -p frontend --noEmit`)
- [ ] Backend tests pass (`pytest backend`)
- [ ] Backend linter and formatter clean (`ruff check backend`, `ruff format --check backend`)
