# Lane claims (to avoid two sessions doing the same work)
Several sessions drive agy lanes in this checkout. Before launching a lane, read this file and `git log`, and add your lane here. Lane names must be unique (check `git branch --list 'agy/*'`).
| Lane | Owner session | Scope | State |
|---|---|---|---|
| u1-g1-audit | Claude (session B, 2026-11-10 00:45) | read-only audit of the Ghostwriter UI (g1) | DONE, report docs/reports/audit-u1-g1.md |
| v1-g1-fixes | Claude (session B) | fixes for the u1 audit: Teach.tsx speech/focus, teach.editor + ghostwriter tests | launched 2026-11-10 |
Not mine (seen running, owner is the other session): q1-share-sanitize, q2-frontend-round5, r1-correct-delete-curves, r2-share-aspect, t1 (Kiro oracles P74/P76/P77).

## agy quota (2026-11-10 00:57)
agy returned RESOURCE_EXHAUSTED (429) "Individual quota reached ... Resets in 50m43s" (resets about 01:48). The quota is shared by every session, so every lane launched before then exits with status 3 and an empty report. Wait for the reset before relaunching; v1-g1-fixes is scheduled to relaunch itself at 01:50 (relaunch-v1.sh). If you see a status-3 lane, rerun it after the reset with a new run name (-2).
