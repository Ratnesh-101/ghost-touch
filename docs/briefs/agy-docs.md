# Lane F: Submission docs (docs only)
## Goal
Bring the submission documents up to date with what is really built, honestly.
## Allowed files
docs/DEMO_SCRIPT.md, docs/STEMERGENT_SUBMISSION.md, docs/KIRO_WRITEUP.md (new), docs/reports/agy-docs-report.md
## Forbidden
everything else, especially code, .kiro/**, docs/BUILD_LOG.md, docs/handoff.md, contact details of any person or organisation.
## Do
1. docs/KIRO_WRITEUP.md: honest write-up of how Kiro was used: specs (requirements -> design -> tasks), steering docs (tuned haptic values, pure-core rule), hooks (three in .kiro/hooks), property-based testing (list P1-P13 from .kiro/specs/ghost-touch/design.md, and the real finding: the P1 flake was a bug in the test generator, see docs/kiro-evidence/pbt-p1-flake.md), and how Antigravity and Claude Code were used (see docs/BUILD_LOG.md). Say plainly that Kiro ran out of credits on 2026-11-02 and what that changed. No claims you cannot back with a file in the repo.
2. docs/STEMERGENT_SUBMISSION.md: replace [FILL] markers ONLY where the repo gives a verifiable fact (tests counts: 249 frontend, 270 backend; stack; providers Gemini -> OpenAI -> Nebius -> Raw Mode; what is built). Leave a [FILL] with a short note for anything that needs the owner (live URL, user-test quotes, team details).
3. docs/DEMO_SCRIPT.md: keep under 3 minutes, update to the current feature set; add a "what to do if it fails on stage" line for each segment (offline samples, Raw Mode).
## Done
Report lists files touched and every remaining [FILL]. You can run only the allowed commands; you mostly just edit docs.
Shared rules: read AGENTS.md first. No git state changes, no .env access, do not invent results.
