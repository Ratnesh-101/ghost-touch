# Ghost Touch — Owner Final Checklist

> **Purpose:** Single-page operational punch list for the repository owner to execute end-to-end verification, phone testing, translation review, and submission.  
> **Status:** All items require owner action; no hardware verification is claimed in advance.

---

### (A) Before the Phone Test
- [ ] **Vercel Feature Flags:** Verify `VITE_FEATURE_GUIDE=1` and `VITE_FEATURE_SHARE=1` are set in Vercel project environment variables (Production & Preview).
- [ ] **Render Environment Check:** Confirm vision provider keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are active on the Render dashboard.
- [ ] **Redeploy & Confirm Build:** Trigger a fresh Vercel deployment of `main` to serve the current build (creature theme, Guide, and Teacher Share).
- [ ] **Backend Health Check:** Open `https://ghost-touch-api.onrender.com/api/v1/health` in Chrome; wait for HTTP 200 `{"ok":true}` to warm the container (~32–35 s cold start).
- [ ] **One Real Photo AI Mode:** Capture one test diagram photo; verify the backend returns `mode: "ai"` (no raw mode fallback banner or timeout).

---

### (B) Phone Test (OnePlus Nord CE6)
*Full procedures and pass/fail criteria are in [docs/PHONE_TEST.md](./PHONE_TEST.md).*

- [ ] **[Step 0–3](./PHONE_TEST.md#step-0-wake-the-render-backend-pre-test-0-min-on-stopwatch): Environment & PWA Baseline** `[PASS / FAIL]`  
  Wake Render, install PWA to home screen, single-tap audio unlock, verify Settings persistence (language, rate, feature toggles).
- [ ] **[Step 4](./PHONE_TEST.md#step-4-explore-samples-with-talkback-off-3-min): Direct Touch Exploration (TalkBack OFF)** `[PASS / FAIL]`  
  Continuous line buzz (`80 ms` / `70 ms`), corner double-pulse (`[50, 90, 50] ms`), 450 ms quiet window, sine theremin pitch glide.
- [ ] **[Step 5](./PHONE_TEST.md#step-5-explore-samples-with-talkback-on-3-min): TalkBack Pass-Through Exploration** `[PASS / FAIL]`  
  TalkBack focus speaks Explore diagram name first; double-tap-and-hold then drag delivers 25 ms centre tick and tracks relative touches cleanly.
- [ ] **[Step 6–7](./PHONE_TEST.md#step-6-voice-commands-in-explore-2-min): Voice Commands & Spoken Ask Q&A** `[PASS / FAIL]`  
  Commands recognized (`where am I`, `repeat`, `next corner`, `describe`, `help`, `faster`); grounded Ask answers; fallback on unanswerable query.
- [ ] **[Step 8–10](./PHONE_TEST.md#step-8-take-photo-of-a-real-textbook-diagram-2-min): Camera, PDF & Offline Saved Diagrams** `[PASS / FAIL]`  
  Photo scene extraction; 1-page PDF rendering; Airplane Mode offline loading from IndexedDB (`ghost-touch-db`).
- [ ] **[Step 11–12](./PHONE_TEST.md#step-11-teacher-correct-mode-15-min): Teacher Correct & Hindi/Gujarati TTS** `[PASS / FAIL]`  
  Drag point with photo underlay, undo/redo, validate and save; natural Hindi/Gujarati speech playback or missing-voice notice.
- [ ] **[Step 13](./PHONE_TEST.md#step-13-guide-my-finger-talkback-off--on-pan-vs-speaker-cancel-ask-3-min): Guide My Finger (TalkBack OFF & ON)** `[PASS / FAIL]`  
  Settings toggle on; voice target `"take me to B"` (`guide.start`); speaker direction cues vs. headphone stereo pan; arrival buzz (`guide.arrived`); TalkBack pass-through guiding; Ask `"Guide me"` button; cancel via `"stop"`, Back, or 20 s timeout.
- [ ] **[Step 14](./PHONE_TEST.md#step-14-teacher-verify--share-routes-teach-link-decompression-offline-bad-links-qr-3-min): Teacher Verify & Share** `[PASS / FAIL]`  
  Teacher tools toggle on; "Open Teacher Editor" button / `#/teach` route; Mark verified; QR code generation ($\le 2000$ chars); cold open `#s=...`; offline Airplane Mode exploring; damaged link friendly error (`share.error.badFormat`).

---

### (C) After the Phone Test Passes
- [ ] **Flip Feature Defaults:** Decide whether to default `gt_guide_enabled` and `gt_teacher_enabled` to ON or keep as user-toggled features.
- [ ] **Update Submission Claim:** Tick the TalkBack physical verification row in `docs/STEMERGENT_SUBMISSION.md` and replace pending qualifiers with measured facts.
- [ ] **Record Demo Video:** Record 2:50–3:00 video following [docs/DEMO_SCRIPT.md](./DEMO_SCRIPT.md); capture physical motor hum with lavalier mic.

---

### (D) Owner-Only Content & Native Checks
- [ ] **Hindi & Gujarati Native Review:** Check translations using [docs/user-test/translation-review.md](./user-test/translation-review.md), including new `guide.*`, `share.*`, and `teach.*` keys.
- [ ] **Resolve Media `[FILL]` Markers:** Insert screenshots, GIFs, repository link, and demo video URL into `docs/STEMERGENT_SUBMISSION.md`.
- [ ] **Resolve Team `[FILL]` Markers:** Enter team member names, student details, and assigned roles (max 4 people).
- [ ] **Resolve School-Session `[FILL]` Marker:** Provide the single sentence describing the BPA Ahmedabad school session (or record an honest note if session did not take place).

---

### (E) Submission Day & Competition Deadlines
- [ ] **Re-run Automated Test Counts:** Run `npm --prefix frontend test` and `backend/.venv/Scripts/python -m pytest backend`; log exact counts in submission documents.
- [ ] **Review Deadlines:**
  - Feature Freeze: **Nov 13, 2026**
  - STEMergent Submission Target: **Nov 14, 2026** (Hard Deadline: **Nov 16, 2026, 09:00 IST**)
  - Kiro Credits Renewal: **Before Dec 1, 2026**
  - Kiroween Hackathon Deadline: **Dec 5, 2026, 03:30 IST**
- [ ] **Kiro Review Queue:** Queue prompts in [docs/handoffs/kiro-prompts.md](./handoffs/kiro-prompts.md) (Task 13 spec retro, Task 11 review, Task 17 Lab theme P18–P20 spec & properties).
