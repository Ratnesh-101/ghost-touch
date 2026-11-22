# Round 2, A (Ghost Skin) vs B (Planchette)
I checked every claim below in the repo (file:line) or in the spec. I edited no file except this one.

## 1. Three attacks on Planchette

**A1. Its trigger breaks Requirement 45, and its own failure path costs more than Ask.**
- B says the trigger "follows Requirement 45", but describes a prefix rule: a question "that starts with 'show me' or 'why'".
- Requirement 45 (`requirements.md`, around line 657) allows a command to match only an exact phrase or a transcript of at most 3 words. Clause 2 says a command word inside a longer sentence "SHALL NOT match: it parses as `unknown` and goes on to Ask". `flow/commands.ts:142-153` (`matchesCommand`) does exactly that.
- "Show me why AB is 5" has 6 words. Recognising it means bringing back the `startsWith` behaviour Kiro wrote Requirement 45 to remove.
- Worse, every ordinary "why" question ("Why is the curve flat here?") becomes a walk request.
- When no template fits, the flow is: a model walk (one paid call), which is rejected when an ungrounded number appears, then the fallback Ask (a second paid call).
- So the worst case is not "today's behaviour", as B claims. It is today's behaviour plus one more paid, rate-limited call. Both go through the same `paid_budget` guard B relies on.

**A2. The offline template path covers less than claimed: the bar chart sample gives zero template walks.**
- B says templates build from what `parseFacts` "already parses: ... two bar values".
- The bar chart sample's facts are `['values are in thousands of units', 'Q4 was the highest quarter', 'Q1 was the lowest quarter']` (`frontend/public/samples/barchart.json`). None matches the bar patterns in `core/verify.ts:288` ("label has a value of n") or `:310` ("label: n"). So `parsed.bars` is empty.
- The sine sample's facts (`amplitude = 1`, `period = 2 pi`) give no walk either.
- The repo's own figure: facts parse on about 35% of scenes, 21 of 60 (`docs/DEPLOY.md:271`, `KIRO_WRITEUP_LONG.md:358`).
- So the offline, AI-free core runs on about a third of scenes. Of the three samples, only the triangle works.
- The demo also explains a fact the scene already prints: the triangle's facts include `'AB = 5 cm'`. A judge asking "why is AB 5?" is asking the app to justify its own input.

**A3. It is not a new way to feel, and it overlaps with Ask and Guide, which already exist.**
- By B's own words the finger gets nothing new: "no new vibration, tone or earcon ... reuses only the engine's own cues". The finger feels exactly what it feels today, and the new thing is spoken text.
- Ask already returns a target element: `backend/app/ask.py:366-367` returns `{"answer", "target": {"elementId"}}`, carried as `target?: GuideTarget` in `flow/ask.ts:75`. The README already lists "Ask followed by 'Guide me'".
- Geometry answers already come from code (`backend/app/semantic.py`).
- Planchette is a multi-target Ask, plus a new backend route (`explain.py`), new prompt hardening, new budget exposure and one EX lane. It adds new spoken text, not a new sensation.
- The one piece that does help the finger is "guide me to the anchor", and Guide is off by default and untested (README).
- Also, B says "lifting her finger ends it". In Explore a blind student lifts constantly, and Requirement 37 (lift means quiet) cuts speech after a lift. B never says whether a lift between steps ends the walk or only the sentence. As written, normal exploring would abort the lesson.

## 2. Attacks I expect from B, and my answers

- **"Ghost Skin adds a new cue; the improvement report's ruling 1 says no new cue before Dec 5."**
  - It ships OFF by default and only the Explorer preset turns it on. That is the same treatment the report itself kept for sticky line and heartbeat (ruling 11).
  - The owner has since had held features built (BUILD_LOG 2026-11-20).
  - It adds zero motor patterns and changes no tuned value. Planchette also adds new speech, which is the top complaint ruling 1 was answering.
- **"Phone speakers cannot play 165 Hz."** The meaning is carried by the pulse rate (8 Hz vs 3 Hz), not the pitch. A triangle wave's harmonics at 495 and 825 Hz are inside phone-speaker range. The values are marked PROPOSED and Debug buttons are in scope for tuning by ear.
- **"Too many sounds at once."**
  - The purr is the quietest layer (0.08 against the theremin's 0.15 and the clicks' 0.3).
  - It is silent on lines, vertices, bars, in the quiet window after a corner, under speech and after a lift.
  - It is told apart from the other sounds by rhythm, not pitch.
- **"AI shapes will not close."**
  - The extraction prompt already asks for "every drawn edge" as "a segment between point ids" (CLAUDE.md §6, Task 8). The triangle sample closes (`CA`, `AB`, `BC`).
  - When no shape closes, silence means "no region found". "Outside" is spoken only when a region exists.
  - Teach can add an edge (Ghostwriter, README).
- **"A purr's length depends on sweep speed, so it cannot compare areas."** True as pitched. My demo line "the same length" needs a steady sweep. See the improvement below, which makes the comparison independent of speed.
- **"Audio is not touch."** A phone has one motor and the Web Vibration API cannot change strength (`fable-blind-user-plan.md` §3). The plan itself says direction and distance must go through sound. Ghost Skin keeps the motor's two meanings (edge and corner) clean.

## 3. Improvement: spoken size ranking, independent of sweep speed

When a student rests inside a region (on the existing where-am-I rest), the clause adds the region's rank, computed with the shoelace formula in `core/skin.ts`:
- Geometry: "Inside triangle A B C, the larger of 2 parts."
- Graphs: "Under the first hump, above the axis. Same size as the hump below."

The rank compares area over the whole curve: equal within 5%, otherwise "larger" or "smaller". This turns the comparison claim from "count how long the purr lasts" into something exact.

It still makes no AI call and needs no backend. It adds two properties:
- the rank is unchanged by translating or scaling the scene;
- on a sine over one full period, the two humps compare as "same size".

These are cheap for Kiro to test and make the "area" story honest.
