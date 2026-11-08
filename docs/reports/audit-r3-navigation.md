# Round-3 re-audit: Back and navigation (Claude Sonnet subagent, read-only, 2026-11-08)
Scope: CORE-01 code from commit 8f60415 (App.tsx hash handler, flow/navigation.ts, Teach.tsx). Code read only; nothing run. **Supervisor has not re-verified; verify before fixing.**

| ID | Sev | Finding | Fix | Test |
|---|---|---|---|---|
| R3-01 | MED CONFIRMED | `App.tsx:279-283` and `Teach.tsx:195-199` call bare `window.confirm(t('teach.confirmLeave'))`; the app never speaks the question or the "staying" outcome. If Chrome suppresses dialogs, `confirm` returns false silently and Back looks dead. | Speak `teach.confirmLeave` before the confirm; after cancel speak "still in the editor" and focus the heading; treat a suppressed dialog as "stay" and say so. | confirm stubbed false: speech.speak called, view still `teach` |
| R3-02 | MED CONFIRMED | Dirty flag never cleared after a successful save/share: `Teach.tsx:174-175` `isDirty = canUndo(history) \|\| name \|\| note`, no baseline. Back and Exit keep asking "unsaved changes" after sharing. | `cleanSnapshot` ref at last successful share/save; compute dirty against it. | edit, share, `onDirtyChange(false)` called |
| R3-03 | MED CONFIRMED | Browser Back from Teach goes to Start (navigation.ts), the in-app Exit (`handleTeachBack`, App.tsx ~428) returns to Explore with the diagram; hardware Back loses the diagram view and `photoUrl` is not cleared. | Add `hasScene` to the `leaveByBack` context; route hash-Back through the Explore branch. | `leaveByBack('teach',{hasScene:true})` case; App test |
| R3-04 | LOW CONFIRMED | Part of `leaveByBack` is dead code (hash handler only uses teach, shareError, share-explore; Saved/Correct use their own back handlers). | Comment that it is the policy table; table test over every `ScreenName`. | |
| R3-05 | LOW-MED CONFIRMED (known gap) | Capture and Start still exit the PWA on hardware Back with no warning (no history entry, hash stays `''`, so no hashchange). | Push a sentinel entry on Capture and handle Back with a spoken message, or document the gap. | |
| R3-06 | LOW CONFIRMED | Cold-loaded `#s=` link exits the app on Back; user is not stuck (`clearHash` uses replaceState). Expected. | none | |
| R3-07 | LOW SUSPECTED | Android Chrome cancelled-dialog quirk after repeated dialogs; same root cause as R3-01. | R3-01 fix | |

Sound: "put the URL back" does not loop (lastProcessedHash guard and isTeachHash branch; history count stable); rapid double Back is safe (confirm blocks); `clearHash` then `setView` race-safe (viewRef assigned during render); hooks order correct (only early return is after all hooks); dirty-flag lifecycle resets on unmount; i18n complete (teach.confirmLeave, start.intro, capture.prompt, explore.gestureHint in en/hi/gu).

Priority: R3-01, R3-02, R3-03 (small, Teach-local). Fix lane: `h6-nav-fixes` (frontend; files App.tsx, Teach.tsx, flow/navigation.ts, i18n).
