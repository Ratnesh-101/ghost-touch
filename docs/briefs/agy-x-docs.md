# Lane x-docs (agy)
Read `docs/briefs/guide-share-contract.md` and AGENTS.md first. Docs only; run no tests.
Allowed files: `docs/PHONE_TEST.md`, `README.md`, `docs/DEMO_SCRIPT.md`, `docs/STEMERGENT_SUBMISSION.md` (feature list sentences only; keep every `[FILL]`), `docs/reports/agy-x-docs-report.md`, `docs/BUILD_LOG.md`.
Forbidden: all code, `.kiro/**`, `.env*`.
Tasks:
1. `docs/PHONE_TEST.md`: add sections. GUIDE: TalkBack OFF and ON (relative cursor, double-tap-hold-drag), speaker vs headphones (stereo pan only audible on headphones; spoken hints must work on the speaker), cancel by voice "stop", by Back, by 20 s timeout, arrival buzz, "take me to B", "find the peak", "next corner", Ask then "Guide me". SHARE: open a shared link cold on the phone, then again in airplane mode, a bad link (truncated) gives a spoken friendly error, teacher route `#/teach` on laptop and phone, QR scan from a second device. Pass/fail table style matching the file.
2. README feature list: both features, flagged OFF by default, and the honesty line "Verified means a person reviewed this diagram. It is not cryptographic proof. Shared links live in the URL fragment and never reach our server."
3. `docs/DEMO_SCRIPT.md`: draft beats only, marked DRAFT: (a) Ask "where is the right angle?" -> "Guide me" -> finger arrives -> buzz; (b) teacher fixes a label on a laptop -> QR -> student phone opens "Verified by ...". Keep total <= 3 minutes; say what to cut.
4. Do not claim anything is verified on hardware.
