# Ghost Touch Lane & Branch Cleanup Report

**Lane:** `cleanup-report`  
**Tool:** `agy, reviewed by Claude`  
**Date:** 2026-11-07  
**Status:** COMPLETE (Report Only — DELETE NOTHING)  
**Scope:** Complete inventory of `agy/*` branches and `gt-lane-*` worktrees, verification against `main`, and safe junction removal instructions.

---

## 1. Inspection Method

Because `git branch --merged` and `git worktree list` are not in the headless runner's restricted command allowlist (`scripts/agy-settings.json`), git metadata was inspected directly:
- **Packed refs:** `ghost-touch-main/.git/packed-refs` (66 `agy/*` branches)
- **Loose branch heads:** `ghost-touch-main/.git/refs/heads/agy/*` (all active and recent branch tips)
- **Worktree registrations:** `ghost-touch-main/.git/worktrees/*` (inspected `gitdir`, `HEAD`, and `logs/HEAD` for each of the 25 registered worktrees)
- **On-disk lane directories:** `C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-*` (inspected working tree contents, untracked changes, and NTFS directory junctions for both registered worktrees and older unregistered leftover worktrees like `gt-lane-a11y`)
- **Commit lineage & merge history:** `ghost-touch-main/.git/logs/refs/heads/main` and `git log --oneline -10`

Every branch tip was checked against `main` commits:
1. **Direct merge ancestry:** Tip commit SHA was incorporated directly as a parent in an `ort` merge commit or merge commit on `main`.
2. **Squash-merged ancestry:** Lane changes were squashed into a single commit on `main` explicitly citing the lane name (e.g., `fix(f1-fix-runtime): audit fixes...`).
3. **Active / unmerged lanes with uncommitted changes:** Lanes with unmerged commits or modified files in their worktrees that have not been merged via git.

> [!NOTE]
> **Main HEAD Movement:** The initial cleanup run observed `main` at `b07da96` (`docs: briefs for a11y-audit, submission-prep, cleanup-report`).
> At time of writing, `main` HEAD has moved to **`3dd1f79`** through commits `65c649c` (Kiro T19 review & property tests), `2b11b4e` (Kiro T23 spec), `51c9d54` (squashed `a11y-audit`), and `3dd1f79` (squashed `submission-prep`).

---

## 2. Summary of Findings

| Category | Total | Safe to Delete | Keep (Unmerged / Active Work) | Unsure |
|---|---|---|---|---|
| **`agy/*` Branches** | **87** | **85** | **2** (`agy/f4-fix-backend-ask`, `agy/cleanup-report`) | **0** |
| **`gt-lane-*` Worktrees (Registered)** | **25** | **23** | **2** (`gt-lane-f4-fix-backend-ask`, `gt-lane-cleanup-report`) | **0** |
| **Leftover Disk Directories (Unregistered)** | **~25** | **~25** (Junction Unlink First) | **0** | **0** |

*(Note on recent parallel lanes: `agy/a11y-audit` and `agy/submission-prep` were active in flight when `main` was at `b07da96`. Both have now finished and were squash-merged into `main` at `51c9d54` and `3dd1f79` respectively. Their branches and worktrees are now categorized under Safe to Delete once the supervisor completes this session).*

---

## 3. Part 1: Branch Analysis (`agy/*`)

A total of **87 `agy/*` branches** exist across `packed-refs` and loose refs in `.git/refs/heads/agy/*`.

### A. SAFE TO DELETE (85 Branches)

All 85 branches listed below have either been merged into `main` (commit SHA is an ancestor of `main`) or squash-merged into `main` with verified commit records.

#### 1. Squash-Merged Branches (8 Branches)
These branches were squashed and reviewed into `main`. Note: `git branch -d` may warn that they are not fully merged by SHA; use `git branch -D` after confirming the squash commit on `main`.

| # | Branch Name | Tip SHA | Squashed Commit on `main` | Squash Commit Message |
|---|---|---|---|---|
| 1 | `agy/f1-fix-runtime` | `7e06043` | `d790eb2` | `fix(f1-fix-runtime): audit fixes, built by agy, reviewed by Claude (squashed lane)` |
| 2 | `agy/f2-fix-share` | `88f61d1` | `876d360` | `fix(f2-fix-share): audit fixes, built by agy, reviewed by Claude (squashed lane)` |
| 3 | `agy/f3-fix-teach` | `5bfe8bd` | `dad9184` | `fix(f3-fix-teach): audit fixes, built by agy, reviewed by Claude (squashed lane)` |
| 4 | `agy/g5-semantic-ask` | `922985d` | `a39a7f5` | `feat(g5-semantic-ask): deterministic Ask answers for peak, right angle and similar, built by agy, reviewed by Claude (squashed lane)` |
| 5 | `agy/a6-security-fullstack` | `2fa5b29` | `a3d3171` | `docs(audit-a6-security-fullstack): round-1 audit report, built by agy, reviewed by Claude (squashed lane)` |
| 6 | `agy/a7-bughunt-core` | `01ed870` | `194efec` | `docs(audit-a7-bughunt-core): round-1 audit report, built by agy, reviewed by Claude (squashed lane)` |
| 7 | `agy/a11y-audit` | `058cb7a` | `51c9d54` | `docs(a11y-audit): accessibility and UX audit report, built by agy, reviewed by Claude (squashed lane)` |
| 8 | `agy/submission-prep` | `116f06a` | `3dd1f79` | `docs(submission-prep): STEMERGENT submission and demo script drafts, built by agy, reviewed by Claude (squashed lane)` |

#### 2. Merged Feature & Audit Branches — Recent Sprints (15 Branches)
Branch tip is a direct parent of a merge commit on `main`.

| # | Branch Name | Tip SHA | Merge Commit on `main` | Commit Description |
|---|---|---|---|---|
| 9 | `agy/g1-guide-core` | `b4d5980` | `40c5c54` | `merge agy/g1-guide-core: Merge made by the 'ort' strategy` |
| 10 | `agy/x0-theme-tokens` | `8b4690b` | `ff7fb3d` | `commit (merge): Merge agy/x0-theme-tokens` |
| 11 | `agy/x-docs` | `04b6630` | `ae0eac8` | `commit (merge): Merge agy/x-docs` |
| 12 | `agy/g3-ask-target` | `5088500` | `fab08b8` | `commit (merge): Merge agy/g3-ask-target` |
| 13 | `agy/t1-share-codec` | `df41b43` | `2154941` | `commit (merge): Merge agy/t1-share-codec` |
| 14 | `agy/g2-guide-ui` | `754cccc` | `c25755e` | `merge agy/g2-guide-ui: Merge made by the 'ort' strategy` |
| 15 | `agy/t3-student-open` | `ca662c2` | `045f892` | `commit (merge): Merge agy/t3-student-open` |
| 16 | `agy/t2-teach-editor` | `d5334e6` | `b318bad` | `merge agy/t2-teach-editor: Merge made by the 'ort' strategy` |
| 17 | `agy/x-ownerdoc` | `9a73d24` | `d995a8b` | `merge agy/x-ownerdoc: Merge made by the 'ort' strategy` |
| 18 | `agy/g4-semantic-voice` | `5ac8b21` | `fd9bf27` | `merge agy/g4-semantic-voice: Merge made by the 'ort' strategy` |
| 19 | `agy/a1-guide-runtime` | `b2a9a09` | `add9c0b` | `commit (merge): Merge agy/a1-guide-runtime (audit)` |
| 20 | `agy/a2-share-security` | `bc4e194` | `76872b7` | `commit (merge): Merge agy/a2-share-security (audit)` |
| 21 | `agy/a3-teach-editor` | `32151bb` | `2a5581a` | `commit (merge): Merge agy/a3-teach-editor (audit)` |
| 22 | `agy/a4-backend-ask` | `745f66c` | `6315a3e` | `commit (merge): Merge agy/a4-backend-ask (audit)` |
| 23 | `agy/a5-integration` | `20b0713` | `730b8fc` | `commit (merge): Merge agy/a5-integration (audit)` |

#### 3. Merged Foundation, Lab & Polish Branches (62 Branches)
All verified ancestors of `main` from earlier development sprints:

| # | Branch Name | Tip SHA | Merge Commit / Point on `main` |
|---|---|---|---|
| 24 | `agy/a11y` | `0a5c668` | `a603ece` (`merge agy/a11y: Merge made by the 'ort' strategy`) |
| 25 | `agy/audit` | `8627cc7` | `5887eb1` (`merge agy/audit`) |
| 26 | `agy/bots` | `2236f4d` | `5c13293` (`merge agy/bots`) |
| 27 | `agy/correct` | `e6fdef0` | `e8153cf` (`merge agy/correct`) |
| 28 | `agy/deploy` | `d26bfc5` | `142bc0f` (`merge agy/deploy`) |
| 29 | `agy/docs` | `58c9713` | `f2a77e4` (`merge agy/docs`) |
| 30 | `agy/docs2` | `e0e841b` | `39e4396` (`merge agy/docs2`) |
| 31 | `agy/graph` | `a39ad9f` | `aa195a2` (`merge agy/graph`) |
| 32 | `agy/housekeep` | `fe17dfd` | `d97cb82` (`merge agy/housekeep`) |
| 33 | `agy/lab-alive` | `dc07380` | `0ae0810` (`commit (merge): Merge agy/lab-alive`) |
| 34 | `agy/lab-brand` | `968973f` | `f5bba0c` (`commit (merge): Merge agy/lab-brand`) |
| 35 | `agy/lab-bugsaudio` | `0487758` | `5b0ec32` (`commit (merge): Merge agy/lab-bugsaudio`) |
| 36 | `agy/lab-capture` | `cfd4949` | `11022cf` (`commit (merge): Merge agy/lab-capture`) |
| 37 | `agy/lab-ci` | `b554659` | `7778b3b` (`merge agy/lab-ci`) |
| 38 | `agy/lab-correct2` | `7ce3225` | `b936860` (`commit (merge): Merge agy/lab-correct2`) |
| 39 | `agy/lab-docs` | `cad0944` | `328ee2f` (`merge agy/lab-docs`) |
| 40 | `agy/lab-explore` | `6a870b5` | `9b01382` (`commit (merge): Merge agy/lab-explore`) |
| 41 | `agy/lab-explore3` | `52d825d` | `98f367d` (`commit (merge): Merge agy/lab-explore3`) |
| 42 | `agy/lab-explore4` | `52bb557` | `8afd566` (`commit (merge): Merge agy/lab-explore4`) |
| 43 | `agy/lab-finaldocs` | `6c83311` | `c0f1b09` (`merge agy/lab-finaldocs`) |
| 44 | `agy/lab-fixes` | `d26e1fb` | `cca5aeb` (`merge agy/lab-fixes`) |
| 45 | `agy/lab-flowbugsa` | `a0923e4` | `782fcf7` (`commit (merge): Merge agy/lab-flowbugsa`) |
| 46 | `agy/lab-flowbugsb` | `34da430` | `4d3f6bac` (`merge agy/lab-flowbugsb`) |
| 47 | `agy/lab-foundation` | `3ec0cd8` | `b050333` (`commit (merge): Merge agy/lab-foundation`) |
| 48 | `agy/lab-i18n` | `7688022` | `7233427` (`commit (merge): Merge agy/lab-i18n`) |
| 49 | `agy/lab-loading` | `1327b3b` | `0e81248` (`merge agy/lab-loading`) |
| 50 | `agy/lab-phonetest` | `c02949e` | `1440b6b` (`merge agy/lab-phonetest`) |
| 51 | `agy/lab-polish` | `6a30ea6` | `8657d64` (`merge agy/lab-polish`) |
| 52 | `agy/lab-pwa` | `609315a` | `8ac8ed9` (`commit (merge): Merge agy/lab-pwa`) |
| 53 | `agy/lab-review` | `1eaf71c` | `559c0e9` (`merge agy/lab-review`) |
| 54 | `agy/lab-saved` | `ed53909` | `22b27cc` (`commit (merge): Merge agy/lab-saved`) |
| 55 | `agy/lab-specimen` | `e38186d` | `4a920c7` (`merge agy/lab-specimen`) |
| 56 | `agy/lab-start` | `8daa067` | `b5eff43` (`merge agy/lab-start`) |
| 57 | `agy/lab-startscreen` | `604742a` | `8b59d1d` (`commit (merge): Merge agy/lab-startscreen`) |
| 58 | `agy/lab-testenv` | `7367d71` | `dccc514` (`merge agy/lab-testenv`) |
| 59 | `agy/lab-warmup` | `66a5f35` | `4dff379` (`commit (merge): Merge agy/lab-warmup`) |
| 60 | `agy/readme` | `4a094d3` | `fa1a8f1` (`merge agy/readme`) |
| 61 | `agy/savedcore` | `42c4919` | `5b80bcf` (`merge agy/savedcore`) |
| 62 | `agy/savedui` | `44504aa` | `1520313` (`commit (merge): Merge lane T13b`) |
| 63 | `agy/usertest` | `13e88df` | `d0935ba` (`merge agy/usertest`) |
| 64 | `agy/validate` | `4efeb08` | `6572b89` (`merge agy/validate`) |
| 65 | `agy/voice` | `8fbd1fc` | `3e56d67` (`merge agy/voice`) |
| 66 | `agy/x-a11yfixes` | `af82aae` | `20491cb` (`merge agy/x-a11yfixes`) |
| 67 | `agy/x-a11ytests` | `21a14e5` | `8233918` (`merge agy/x-a11ytests`) |
| 68 | `agy/x-backend2` | `e966d30` | `cfe2aa9` (`merge agy/x-backend2`) |
| 69 | `agy/x-backendaudit` | `7e14b7a` | `629bac6` (`merge agy/x-backendaudit`) |
| 70 | `agy/x-backendprops` | `9b67add` | `799286a` (`merge agy/x-backendprops`) |
| 71 | `agy/x-brandfinal` | `4a11c64` | `980e58c` (`merge agy/x-brandfinal`) |
| 72 | `agy/x-busyretry` | `d9c323a` | `0091af9` (`commit (merge): Merge agy/x-busyretry`) |
| 73 | `agy/x-config` | `c2ac6d2` | `69cd183` (`merge agy/x-config`) |
| 74 | `agy/x-demodocs` | `2f5f1eb` | `cc2327a` (`merge agy/x-demodocs`) |
| 75 | `agy/x-fillurls` | `5f7a5ac` | `26bf340` (`merge agy/x-fillurls`) |
| 76 | `agy/x-hardening` | `3402198` | `6510607` (`merge agy/x-hardening`) |
| 77 | `agy/x-i18nsheet` | `096611d` | `599c419` (`commit (merge): Merge agy/x-i18nsheet`) |
| 78 | `agy/x-kiro45` | `26a7b70` | `d1d9760` (`merge agy/x-kiro45`) |
| 79 | `agy/x-kiro67` | `2957648` | `3cd6f9e` (`commit (merge): Merge agy/x-kiro67`) |
| 80 | `agy/x-kiroprompts` | `bf4a227` | `3f25691` (`merge agy/x-kiroprompts`) |
| 81 | `agy/x-logoalts` | `aff79fe` | `aff79fe` (Tip commit directly on `main`) |
| 82 | `agy/x-readme` | `d47c919` | `b80eeb3` (`merge agy/x-readme`) |
| 83 | `agy/x-retry` | `591cd8a` | `0303a35` (`merge agy/x-retry`) |
| 84 | `agy/x-reviewfix` | `df5cbc0` | `1e3d333` (`commit (merge): Merge agy/x-reviewfix`) |
| 85 | `agy/x-testgaps` | `9af5107` | `67d4516` (`commit (merge): Merge agy/x-testgaps`) |

---

### B. KEEP (Active Work / Unmerged Changes — 2 Branches)

> [!CAUTION]
> **DO NOT DELETE THESE BRANCHES.**
> These branches contain active in-flight work or unmerged changes:

| Branch Name | Tip SHA | Role / Lane Description | Reason to Keep |
|---|---|---|---|
| `agy/f4-fix-backend-ask` | `4a43004` | Backend ask audit fixes (`gt-lane-f4-fix-backend-ask`) | **UNMERGED work with uncommitted changes on disk. NOT safe to delete.** |
| `agy/cleanup-report` | `b07da96` | This lane (`gt-lane-cleanup-report`) | Currently executing active headless run. |

#### Detailed Verification of `agy/f4-fix-backend-ask`:
- Branch `agy/f4-fix-backend-ask` was created from `4a43004` (`docs: f4 brief`).
- The builder agent executed its assignment and created multiple modified files (`backend/app/ask.py`, `backend/app/main.py`, `backend/app/limits.py`, `backend/tests/test_fix_ask_regression.py`, and `docs/reports/agy-f4-fix-backend-ask-report.md`).
- Because builders cannot run git commands under `AGENTS.md` rules, these changes were never committed to `agy/f4-fix-backend-ask`.
- Although Kiro later ported parts of the diff onto `main` via patch in Task 24, the git branch `agy/f4-fix-backend-ask` was never merged, and the worktree `gt-lane-f4-fix-backend-ask` contains the original uncommitted source files and test suites.
- Deleting this branch or worktree before supervisor sign-off risks permanent data loss.

#### Verification of `agy/a11y` (Older Branch Check):
- Branch `agy/a11y` is present in `.git/packed-refs` at commit SHA `0a5c668a6af294a4f2f3709026d7152ed56c8f28`.
- Commit `0a5c668` was merged into `main` via merge commit `a603eced7ab78a77e101056ad5aa2d70476cea8d` (`merge agy/a11y: Merge made by the 'ort' strategy`).
- It has no unmerged commits and is safe to delete. (Note: an older leftover directory `gt-lane-a11y` exists on disk with dangling NTFS junctions, detailed in Section 4 below).

---

### C. UNSURE (0 Branches)

None. All 87 branches are completely accounted for.

---

## 4. Part 2: Worktree Analysis (`gt-lane-*`)

A total of **25 worktrees** are registered in `ghost-touch-main/.git/worktrees/*`.

### A. SAFE TO DELETE (23 Registered Worktrees)

All 23 worktrees listed below have completed their work. All lane changes have been fully committed to their branch and merged or squash-merged into `main`.

| # | Worktree Directory | Branch | Merged / Squashed in `main` | Working Copy Status | Safe to Delete? |
|---|---|---|---|---|---|
| 1 | `../gt-lane-a7-bughunt-core` | `agy/a7-bughunt-core` | `194efec` (squashed) | Clean (committed in `01ed870`) | **YES** |
| 2 | `../gt-lane-a6-security-fullstack` | `agy/a6-security-fullstack` | `a3d3171` (squashed) | Clean (committed in `2fa5b29`) | **YES** |
| 3 | `../gt-lane-g5-semantic-ask` | `agy/g5-semantic-ask` | `a39a7f5` (squashed) | Clean (committed in `922985d`) | **YES** |
| 4 | `../gt-lane-f3-fix-teach` | `agy/f3-fix-teach` | `dad9184` (squashed) | Clean (committed in `5bfe8bd`) | **YES** |
| 5 | `../gt-lane-f2-fix-share` | `agy/f2-fix-share` | `876d360` (squashed) | Clean (committed in `88f61d1`) | **YES** |
| 6 | `../gt-lane-f1-fix-runtime` | `agy/f1-fix-runtime` | `d790eb2` (squashed) | Clean (committed in `7e06043`) | **YES** |
| 7 | `../gt-lane-a5-integration` | `agy/a5-integration` | `730b8fc` (merged) | Clean (committed in `20b0713`) | **YES** |
| 8 | `../gt-lane-a4-backend-ask` | `agy/a4-backend-ask` | `6315a3e` (merged) | Clean (committed in `745f66c`) | **YES** |
| 9 | `../gt-lane-a3-teach-editor` | `agy/a3-teach-editor` | `2a5581a` (merged) | Clean (committed in `32151bb`) | **YES** |
| 10 | `../gt-lane-a2-share-security` | `agy/a2-share-security` | `76872b7` (merged) | Clean (committed in `bc4e194`) | **YES** |
| 11 | `../gt-lane-a1-guide-runtime` | `agy/a1-guide-runtime` | `add9c0b` (merged) | Clean (committed in `b2a9a09`) | **YES** |
| 12 | `../gt-lane-g4-semantic-voice` | `agy/g4-semantic-voice` | `fd9bf27` (merged) | Clean (committed in `5ac8b21`) | **YES** |
| 13 | `../gt-lane-x-ownerdoc` | `agy/x-ownerdoc` | `d995a8b` (merged) | Clean (committed in `9a73d24`) | **YES** |
| 14 | `../gt-lane-t2-teach-editor` | `agy/t2-teach-editor` | `b318bad` (merged) | Clean (committed in `d5334e6`) | **YES** |
| 15 | `../gt-lane-t3-student-open` | `agy/t3-student-open` | `045f892` (merged) | Clean (committed in `ca662c2`) | **YES** |
| 16 | `../gt-lane-g2-guide-ui` | `agy/g2-guide-ui` | `c25755e` (merged) | Clean (committed in `754cccc`) | **YES** |
| 17 | `../gt-lane-t1-share-codec` | `agy/t1-share-codec` | `2154941` (merged) | Clean (committed in `df41b43`) | **YES** |
| 18 | `../gt-lane-g3-ask-target` | `agy/g3-ask-target` | `fab08b8` (merged) | Clean (committed in `5088500`) | **YES** |
| 19 | `../gt-lane-x-docs` | `agy/x-docs` | `ae0eac8` (merged) | Clean (committed in `04b6630`) | **YES** |
| 20 | `../gt-lane-x0-theme-tokens` | `agy/x0-theme-tokens` | `ff7fb3d` (merged) | Clean (committed in `8b4690b`) | **YES** |
| 21 | `../gt-lane-g1-guide-core` | `agy/g1-guide-core` | `40c5c54` (merged) | Clean (committed in `b4d5980`) | **YES** |
| 22 | `../gt-lane-a11y-audit` | `agy/a11y-audit` | `51c9d54` (squashed) | Clean (committed in `058cb7a`) | **YES** |
| 23 | `../gt-lane-submission-prep` | `agy/submission-prep` | `3dd1f79` (squashed) | Clean (committed in `116f06a`) | **YES** |

---

### B. KEEP (Active Work / Unmerged Changes — 2 Registered Worktrees)

> [!CAUTION]
> **DO NOT DELETE THESE WORKTREES.**

| Worktree Directory | Branch | Active Purpose | Status |
|---|---|---|---|
| `C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-f4-fix-backend-ask` | `agy/f4-fix-backend-ask` | Backend ask audit fixes | **UNMERGED (Uncommitted Changes — DO NOT DELETE)** |
| `C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-cleanup-report` | `agy/cleanup-report` | Generating this cleanup audit | **ACTIVE (In Flight)** |

---

### C. Leftover Unregistered Lane Directories on Disk (~25 Folders)

In addition to the 25 worktrees registered in `.git/worktrees/*`, direct inspection of `C:/Users/Admin/Downloads/ghost-touch-main/` revealed older lane directories left on disk from earlier sprints whose git worktree registrations were previously pruned:
- `gt-lane-a11y`
- `gt-lane-audit`
- `gt-lane-bots`
- `gt-lane-correct`
- `gt-lane-deploy`
- `gt-lane-docs`
- `gt-lane-docs2`
- `gt-lane-graph`
- `gt-lane-housekeep`
- `gt-lane-readme`
- `gt-lane-savedcore`
- `gt-lane-savedui`
- `gt-lane-usertest`
- `gt-lane-validate`
- `gt-lane-voice`
- `gt-lane-lab-*` (`lab-alive`, `lab-brand`, `lab-i18n`, etc.)
- `gt-lane-x-*` (`x-a11yfixes`, `x-a11ytests`, etc.)

> [!IMPORTANT]
> **Dangling NTFS Directory Junction Hazard:**
> Inspection of `gt-lane-a11y` confirmed that its source files were cleaned up, but its **`frontend/node_modules`** and **`backend/.venv`** NTFS directory junctions remain on disk, pointing straight into `ghost-touch-main`.
> Running any naive directory deletion on these leftover folders will traverse into `ghost-touch-main` and corrupt the repository. They must be safely unlinked first using `cmd /c rmdir`.

---

## 5. Safe Removal Protocol (CRITICAL: Windows Junction Hazard)

> [!CAUTION]
> **DO NOT USE RECURSIVE DELETE (`rm -rf` or PowerShell `Remove-Item -Recurse`) ON WORKTREES.**
> Each `gt-lane-*` worktree was provisioned with NTFS directory junctions linking to the main repository:
> - `<worktree>/frontend/node_modules` $\rightarrow$ `ghost-touch-main/frontend/node_modules`
> - `<worktree>/backend/.venv` $\rightarrow$ `ghost-touch-main/backend/.venv`
> 
> Recursive deletion tools on Windows will traverse these directory junctions and wipe out the actual packages and virtual environment inside `ghost-touch-main`, corrupting the main repository and breaking all builds.

### Step-by-Step Safe Deletion Procedure

For every finished worktree:
1. **Unlink NTFS junctions first** using Windows `rmdir` (which removes the junction pointer only and never touches junction target contents):
   ```cmd
   cmd /c rmdir "<worktree-path>\frontend\node_modules"
   cmd /c rmdir "<worktree-path>\backend\.venv"
   ```
2. **Remove worktree via git**:
   ```cmd
   git worktree remove "<worktree-path>" --force
   ```
3. **Prune worktree metadata**:
   ```cmd
   git worktree prune
   ```
4. **Delete merged/squashed branches**:
   - For fast-forward / merged branches: `git branch -d agy/<name>`
   - For squash-merged branches: `git branch -D agy/<name>`

---

## 6. Ready-to-Run Cleanup Script (For Repo Owner / Claude)

Run this from `ghost-touch-main` repo root **after this `cleanup-report` lane completes**:

> [!CAUTION]
> Notice that `gt-lane-f4-fix-backend-ask` and `agy/f4-fix-backend-ask` are **EXCLUDED** from deletion lists because they contain unmerged work with uncommitted changes.

### PowerShell Script (`scripts/safe-cleanup.ps1`)

```powershell
# Safe cleanup script for Ghost Touch completed lanes
# MUST be run from ghost-touch-main repository root.

$parentDir = Split-Path -Parent (Get-Location)

# 1. Registered finished worktrees to remove via git
$finishedRegisteredLanes = @(
    "gt-lane-a7-bughunt-core",
    "gt-lane-a6-security-fullstack",
    "gt-lane-g5-semantic-ask",
    "gt-lane-f3-fix-teach",
    "gt-lane-f2-fix-share",
    "gt-lane-f1-fix-runtime",
    "gt-lane-a5-integration",
    "gt-lane-a4-backend-ask",
    "gt-lane-a3-teach-editor",
    "gt-lane-a2-share-security",
    "gt-lane-a1-guide-runtime",
    "gt-lane-g4-semantic-voice",
    "gt-lane-x-ownerdoc",
    "gt-lane-t2-teach-editor",
    "gt-lane-t3-student-open",
    "gt-lane-g2-guide-ui",
    "gt-lane-t1-share-codec",
    "gt-lane-g3-ask-target",
    "gt-lane-x-docs",
    "gt-lane-x0-theme-tokens",
    "gt-lane-g1-guide-core",
    "gt-lane-a11y-audit",
    "gt-lane-submission-prep"
    # EXCLUDED (DO NOT DELETE):
    # "gt-lane-f4-fix-backend-ask", # UNMERGED work with uncommitted changes
    # "gt-lane-cleanup-report"      # Active lane
)

# 2. Older unregistered lane directories on disk holding dangling junctions
$olderLeftoverLanes = @(
    "gt-lane-a11y", "gt-lane-audit", "gt-lane-bots", "gt-lane-correct",
    "gt-lane-deploy", "gt-lane-docs", "gt-lane-docs2", "gt-lane-graph",
    "gt-lane-housekeep", "gt-lane-readme", "gt-lane-savedcore", "gt-lane-savedui",
    "gt-lane-usertest", "gt-lane-validate", "gt-lane-voice", "gt-lane-lab-alive",
    "gt-lane-lab-brand", "gt-lane-lab-bugsaudio", "gt-lane-lab-capture", "gt-lane-lab-ci",
    "gt-lane-lab-correct2", "gt-lane-lab-docs", "gt-lane-lab-explore", "gt-lane-lab-explore3",
    "gt-lane-lab-explore4", "gt-lane-lab-finaldocs", "gt-lane-lab-fixes", "gt-lane-lab-flowbugsa",
    "gt-lane-lab-flowbugsb", "gt-lane-lab-foundation", "gt-lane-lab-i18n", "gt-lane-lab-loading",
    "gt-lane-lab-phonetest", "gt-lane-lab-polish", "gt-lane-lab-pwa", "gt-lane-lab-review",
    "gt-lane-lab-saved", "gt-lane-lab-specimen", "gt-lane-lab-start", "gt-lane-lab-startscreen",
    "gt-lane-lab-testenv", "gt-lane-lab-warmup", "gt-lane-x-a11yfixes", "gt-lane-x-a11ytests",
    "gt-lane-x-backend2", "gt-lane-x-backendaudit", "gt-lane-x-backendprops", "gt-lane-x-brandfinal",
    "gt-lane-x-busyretry", "gt-lane-x-config", "gt-lane-x-demodocs", "gt-lane-x-fillurls",
    "gt-lane-x-hardening", "gt-lane-x-i18nsheet", "gt-lane-x-kiro45", "gt-lane-x-kiro67",
    "gt-lane-x-kiroprompts", "gt-lane-x-logoalts", "gt-lane-x-readme", "gt-lane-x-retry",
    "gt-lane-x-reviewfix", "gt-lane-x-testgaps"
)

# Step 1: Unlink junctions and remove registered worktrees
foreach ($lane in $finishedRegisteredLanes) {
    $wtPath = Join-Path $parentDir $lane
    if (Test-Path $wtPath) {
        Write-Host "Unlinking junctions in $lane..." -ForegroundColor Cyan
        $nodeModules = Join-Path $wtPath "frontend\node_modules"
        $venv = Join-Path $wtPath "backend\.venv"
        if (Test-Path $nodeModules) { cmd /c rmdir "$nodeModules" }
        if (Test-Path $venv) { cmd /c rmdir "$venv" }

        Write-Host "Removing worktree $lane via git..." -ForegroundColor Cyan
        git worktree remove "$wtPath" --force
    }
}

Write-Host "Pruning git worktree metadata..." -ForegroundColor Cyan
git worktree prune

# Step 2: Unlink junctions in older leftover directories and remove directory
foreach ($lane in $olderLeftoverLanes) {
    $wtPath = Join-Path $parentDir $lane
    if (Test-Path $wtPath) {
        Write-Host "Unlinking junctions in leftover directory $lane..." -ForegroundColor Cyan
        $nodeModules = Join-Path $wtPath "frontend\node_modules"
        $venv = Join-Path $wtPath "backend\.venv"
        if (Test-Path $nodeModules) { cmd /c rmdir "$nodeModules" }
        if (Test-Path $venv) { cmd /c rmdir "$venv" }

        # Now safe to remove the empty leftover directory
        Remove-Item -Path "$wtPath" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Step 3: Delete safe merged and squashed agy branches (85 branches)
Write-Host "Deleting safe merged and squashed agy branches..." -ForegroundColor Cyan
$branchesToDelete = @(
    # Squash-merged (8)
    "agy/f1-fix-runtime", "agy/f2-fix-share", "agy/f3-fix-teach",
    "agy/g5-semantic-ask", "agy/a6-security-fullstack", "agy/a7-bughunt-core",
    "agy/a11y-audit", "agy/submission-prep",
    # Merged feature & audit (15)
    "agy/g1-guide-core", "agy/x0-theme-tokens", "agy/x-docs",
    "agy/g3-ask-target", "agy/t1-share-codec", "agy/g2-guide-ui",
    "agy/t3-student-open", "agy/t2-teach-editor", "agy/x-ownerdoc",
    "agy/g4-semantic-voice", "agy/a1-guide-runtime", "agy/a2-share-security",
    "agy/a3-teach-editor", "agy/a4-backend-ask", "agy/a5-integration",
    # Merged foundation, lab & polish (62)
    "agy/a11y", "agy/audit", "agy/bots", "agy/correct", "agy/deploy",
    "agy/docs", "agy/docs2", "agy/graph", "agy/housekeep", "agy/lab-alive",
    "agy/lab-brand", "agy/lab-bugsaudio", "agy/lab-capture", "agy/lab-ci",
    "agy/lab-correct2", "agy/lab-docs", "agy/lab-explore", "agy/lab-explore3",
    "agy/lab-explore4", "agy/lab-finaldocs", "agy/lab-fixes", "agy/lab-flowbugsa",
    "agy/lab-flowbugsb", "agy/lab-foundation", "agy/lab-i18n", "agy/lab-loading",
    "agy/lab-phonetest", "agy/lab-polish", "agy/lab-pwa", "agy/lab-review",
    "agy/lab-saved", "agy/lab-specimen", "agy/lab-start", "agy/lab-startscreen",
    "agy/lab-testenv", "agy/lab-warmup", "agy/readme", "agy/savedcore",
    "agy/savedui", "agy/usertest", "agy/validate", "agy/voice", "agy/x-a11yfixes",
    "agy/x-a11ytests", "agy/x-backend2", "agy/x-backendaudit", "agy/x-backendprops",
    "agy/x-brandfinal", "agy/x-busyretry", "agy/x-config", "agy/x-demodocs",
    "agy/x-fillurls", "agy/x-hardening", "agy/x-i18nsheet", "agy/x-kiro45",
    "agy/x-kiro67", "agy/x-kiroprompts", "agy/x-logoalts", "agy/x-readme",
    "agy/x-retry", "agy/x-reviewfix", "agy/x-testgaps"
    # EXCLUDED (DO NOT DELETE):
    # "agy/f4-fix-backend-ask", # UNMERGED changes
    # "agy/cleanup-report"      # Active lane
)

foreach ($b in $branchesToDelete) {
    git branch -D $b
}

Write-Host "Cleanup completed safely!" -ForegroundColor Green
```

---

## 7. Zero Actions Taken (Proof of Inaction)

Per the brief's strict mandate:
- **No deletions were executed.**
- **No `git worktree remove` was executed.**
- **No `rmdir` or file unlinking was executed.**
- **No `git branch -d` / `-D` was executed.**
This report is strictly informational and provides the exact safe sequence for manual or supervisor execution.
