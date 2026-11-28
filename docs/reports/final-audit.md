# Final audit (package 13)

Auditor: Kiro. Scope: SUBMISSION_AUDIT.md sections 1, 3 and 5 (section 5 is provenance and was not part of this re-check, see the end). Nothing was committed. `.kiro/agents` was not touched. Secret values are never printed here, only file:line.

| # | Item | Result |
|---|---|---|
| 1 | `.kiro/` present and not ignored | PASS |
| 2 | LICENSE | PASS |
| 3 | README.md | PASS (with the layout defects in item 9) |
| 4 | CONTRIBUTING.md | FAIL (exists, but untracked) |
| 5 | docs/TEACHER_GUIDE.md | PASS (uncommitted edit) |
| 6 | `.env.example` files | PASS (existence only, contents not read) |
| 7 | Secret scan, tracked files | PASS (test fixtures and one doc example only) |
| 8 | Secret scan, `submission/` | PASS |
| 9 | README layout section accurate | FAIL |
| 10 | SUBMISSION_AUDIT.md claims | PARTIAL (two stale facts) |

## 1. `.kiro/` present and not ignored: PASS
- `git check-ignore -v .kiro .kiro/specs/ghost-touch/tasks.md` printed nothing, so neither path is ignored.
- `git ls-files .kiro` lists 22 tracked files: 3 specs plus `tasks.meta.json`, 5 steering files, 9 hooks, 4 agents.
- `.gitignore:35` is only a comment saying not to ignore `.kiro/`. No ignore rule matches it.
- Working-tree changes exist in `.kiro/agents/gt-*.json` and `.kiro/specs/ghost-touch/design.md` (shown as `M`). They are uncommitted, so they need committing by the owner. I left them as they are.
- SUBMISSION_AUDIT.md says "21 files". The real count is 22 because it omits `tasks.meta.json`.

## 2. LICENSE: PASS
`LICENSE` is tracked. Its first lines are the MIT text (per SUBMISSION_AUDIT.md, copyright 2026 Ratnesh Singh). README ends with `## License` / `MIT` (README.md:206-208).

## 3. README.md: PASS
Tracked. It links `docs/TEACHER_GUIDE.md` (README.md:200), `docs/DEPLOY.md` (README.md:199) and `docs/PRIVACY.md` (README.md:192). It has no link to CONTRIBUTING.md or SECURITY.md (both exist). Optional, not a failure.

## 4. CONTRIBUTING.md: FAIL (untracked)
- The file exists at the repo root with 44 lines, so SUBMISSION_AUDIT.md's "missing" finding is out of date.
- `git status --short` shows `?? CONTRIBUTING.md`. It is not tracked and not ignored. A repo pushed now would not contain it.
- Fix (owner): stage and commit it. I did not.

## 5. docs/TEACHER_GUIDE.md: PASS
Tracked, 108 lines per the earlier audit, linked from README.md:200. `git diff --stat` shows 6 uncommitted added lines. The owner needs to commit the edit.

## 6. `.env.example` files: PASS (existence only)
- `backend/.env.example` and `frontend/.env.example` are both tracked.
- `.gitignore:23-25` ignores `.env` and `.env.*` and allows `!.env.example`.
- Tooling rules in this workspace block reading `.env*` files, so I did not read the contents. The tracked-file secret scan in item 7 found no key-shaped value in either file.
- SUBMISSION_AUDIT.md's line numbers inside these files (12, 15, 18, 10) were not re-checked.
- `.env` itself is not tracked and does not appear in `git ls-files`.

## 7. Secret scan, tracked files: PASS
Command: `git grep -nIE` for `AIza`, `ghp_`, `sk-`, `nvapi-`.

Bare-prefix scan: about 180 hits. Nearly all are false positives, because `sk-` matches words such as `task-` and `ask-` (for example `docs/BUILD_LOG.md`, `docs/briefs/*`, `frontend/src/screens/Explore.tsx:3002`). No `ghp_` or `nvapi-` token appears.

Key-shaped scan (`AIza[...]{20,}`, `ghp_[...]{20,}`, `sk-[...]{16,}`, `nvapi-[...]{16,}`) gave 9 hits:
- `backend/tests/test_openai_provider.py:15` (`FAKE_KEY`)
- `backend/tests/test_shared_http_client.py:20` (`FAKE_API_KEY`)
- `backend/tests/test_x1_w2_fixes.py:43, 50, 60, 69, 92, 101` (scrubber tests)
- `docs/reports/audit-a6-security-fullstack.md:309` (example error message)

Why these are fixtures and not real keys:
- Each hit sits in a variable named FAKE, or in a test that asserts the value is scrubbed.
- The 5 `AIza` values are 30 to 37 characters long. A real Google key is 39.
- The `sk-` values start with `sk-a` or `sk-t`, which suggests `sk-abc...` or `sk-test...` placeholders. I confirmed this from the first four characters and the length only.
- Confidence: high for the tests. Medium for `audit-a6-security-fullstack.md:309`, which I only saw with the value redacted, in a quoted error message. The owner should glance at that line.

`gitleaks.yml` also exists in `.github/workflows/` as an automated guard.

## 8. Secret scan, `submission/`: PASS
- `submission/` has 5 files: `built_with.txt`, `checklist.md`, `demo_script.md`, `devpost_description.md`, `stemergent_extras.md`.
- The same key-shaped regex over all five found 0 hits.
- `submission/` is not tracked. `.git/info/exclude:8` excludes it locally. Whatever the submission guard expects, these files will not reach the repo unless the owner adds them or removes that exclude.

## 9. README layout section accurate: FIXED by Claude Code (graphify-out and logs lines removed)
README.md has two layout sections ("Project structure" at README.md:87-101 and "Repository layout" at README.md:103-114). Compared with `git ls-files`:

- **README.md:111-112** (`graphify-out/` and `logs/`) list directories that are not in the repository. `graphify-out/` is excluded in `.git/info/exclude:7` and `logs/` is ignored in `.gitignore`. A reader who clones the repo will not find them. Remove both lines.
- **README.md:88-100** omits tracked top-level files: `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` (once tracked), `AGENTS.md`, `CLAUDE.md`, `render.yaml`. Optional but incomplete.
- **README.md:89** names the root `ghost-touch/`. Fine.
- **README.md:93** lists `.kiro/agents/` as a separate line from `.kiro/`. This is accurate: the four `gt-*` files exist.
- **README.md:98** claims `scripts/` holds `setup-dev.ps1`. This is accurate: `scripts/setup-dev.ps1` exists.
- Entries that are correct: `.github/`, `.kiro/`, `backend/`, `frontend/`, `prototypes/`, `research/`, `scripts/`, `docs/`.

Owner: README is not Kiro-owned, so agy or the owner can fix it.

## 10. Stale claims in SUBMISSION_AUDIT.md
- It says `CONTRIBUTING.md` is missing. It now exists but is untracked (item 4).
- It says `.kiro/` has 21 files. The real count is 22 (item 1).
- Its executive summary says "Zero shell commands executed". That is why it missed both of the above. The table at the top is therefore out of date.

## Section 5 (provenance)
Not re-checked in depth. One point to carry forward: the audit flags the first commit at 2026-11-01 against a Nov 7 start. That is a timeline decision for the owner, not a code defect.

## Actions needed from the owner
1. Commit `CONTRIBUTING.md` (currently untracked).
2. Commit the pending edits to `docs/TEACHER_GUIDE.md`, `.kiro/specs/ghost-touch/design.md` and `.kiro/agents/gt-*.json`.
3. Remove `graphify-out/` and `logs/` from README.md:111-112.
4. Decide whether `submission/` should stay untracked (`.git/info/exclude:8`).
5. Glance at `docs/reports/audit-a6-security-fullstack.md:309`.
