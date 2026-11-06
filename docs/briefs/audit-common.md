# Audit lanes: common rules (AUDIT ONLY, no code changes)
You are an auditor. You change NO source, test, config or doc file except your own report `docs/reports/audit-<lane>.md` and one `docs/BUILD_LOG.md` entry. Read AGENTS.md first. Never open `.env*`.
Scope: the Guide-my-finger and Teacher-verify-and-share features merged on 2026-11-06 (contract in `docs/briefs/guide-share-contract.md`; reviews in `docs/reviews/`). Frontend is React + Vite + TS in `frontend/`, backend FastAPI in `backend/`.
Method: read the code for real, trace the failure paths, try to break it with concrete inputs. You may run `npm --prefix frontend test`, tsc and the build. You may NOT write new test files in this lane (put a proposed failing test as a code block in the report instead).
Report format (create the file FIRST, save as you go). For every finding:
`ID · severity (high/med/low) · file:line · what is wrong · concrete failure scenario (exact input/steps) · proposed minimal fix · proposed test`.
Rank by severity. Separate CONFIRMED (you traced it in code or reproduced it) from SUSPECTED. Do not pad: if an area is sound, say so in one line with what you checked. End with a "Top 5 to fix first" list.
Ignore: styling taste, things the contract explicitly allows, and anything under `frontend/src/core/**` (locked; mention only if the feature misuses its interface).
