# Pitch B: Planchette

**Hook:** the creature stops *answering* and starts *teaching*. Ask "why?" and it walks your finger through the reasoning on the diagram itself, one step at a time: you feel each side, each corner, each bar as it is named in the argument.

## The problem
Ask today gives at most 2 sentences (`backend/app/ask.py:362`). "How long is AB?" gets "5 cm". A sighted classmate gets more: the teacher points at the board. "This side is 4, this one is 3, and the corner here is square, so..." The pointing is the lesson. A blind student hears the conclusion but never feels the path to it.

Scenario: NCERT Class 10, Chapter 6 (Triangles), a right triangle with legs 4 cm and 3 cm. The student traces it and asks "Why is AB 5 centimetres?" A text answer ("by Pythagoras, 4² + 3² = 25") makes her hold three sides, one corner and an equation in her head at once, with nothing under her finger. The same happens with bar charts ("how much more did Q3 sell than Q1?") and graphs ("where does the curve turn?"). Ghost Touch can let her feel a diagram. It cannot yet let her feel an argument about it.

## How it works and sounds
1. **Trigger.** The student says or types a question that starts with "show me" or "why" (for example "Show me why AB is 5", "why is B the biggest bar"), or says "show me" right after any Ask answer. The phrase rule follows Requirement 45: whole phrases only, never a word inside a question.
2. **Plan.** The client asks for a *walk*: 2 to 6 steps. Each step has a sentence, one anchor element id, and an optional checked calculation:
   `{"steps":[{"say":"Side CA is 4 centimetres.","anchor":"CA"},{"say":"Side BC is 3 centimetres.","anchor":"BC"},{"say":"Corner C is a right angle.","anchor":"C"},{"say":"So AB squared is 4 squared plus 3 squared, 25. AB is 5 centimetres.","anchor":"AB","calc":{"expr":"sqrt(4^2+3^2)","result":5}}]}`
3. **Walk.** The phone says: "Four steps. Step one: find side CA." The student explores as usual. The step sentence plays only when her finger is **on the anchor**, decided by the existing `hitTest` target id (a segment counts anywhere along it). She hears the existing line buzz, then "Side CA is 4 centimetres." "Next step" moves on, "repeat" re-says the step (the command already exists, `flow/commands.ts:158`), "go back" and "stop" do what they say. If Guide is on, "guide me" uses the existing Guide to lead her finger to the anchor.
4. **Close.** On the last anchor: "That is why. Say 'show me' again to repeat the walk, or ask another question."

The walk adds **no new vibration, tone or earcon**. It reuses only the engine's own cues and existing speech. This respects ruling 1 of the improvement report (no new cue before Dec 5) and the tuned values. Planchette is a conductor for the existing parts, not another instrument.

**Two sources of walks:**
- **Template walks, offline, no AI:** pure code builds walks from facts that `core/verify.ts parseFacts` already parses: Pythagoras (right-angle fact plus two lengths), "which bar is bigger and by how much" (two bar values), and "the longest side". The triangle sample's facts (`angle C = 90 degrees`, `AC = 4 cm`, `BC = 3 cm`) are enough to build the walk above with no network.
- **Model walks:** `POST /api/v1/explain` sends the scene JSON (text only, like Ask) with this prompt: "Explain the answer to the student's question as 2 to 6 steps. Each step: one sentence of at most 20 words, one anchor id chosen ONLY from Scene Element IDs, an optional calc as an arithmetic expression and its result. Use only the scene and its facts. If the scene cannot support it, return {"steps": []}."

## Frankenstein fit
Today the three organs work side by side. Planchette makes them work *together* on one task. The **eyes** (vision LLM) plan the argument, the **voice** says it step by step, and the **nerves** confirm each step under the finger. A planchette is the pointer on a spirit board that a hand seems to be led across. Here the creature is the one doing the leading. The spooky part stays with the creature, never with the student (product principle 5).

## What to build
**Kiro (pure core, spec, properties):** `frontend/src/core/walk.ts` (new) with:
- `WalkStep` and `Walk` types;
- `validateWalk(scene, walk)`, which drops the walk if any anchor is missing or the walk has more than 6 steps;
- `templateWalk(scene, parsedFacts)`;
- a reducer `walkStep(state, input)`. Inputs are `hit(targetId)`, `next`, `back`, `repeat`, `stop`. It returns only `speak` and `guideTo(id)` effects.

Properties (next free numbers):
- every anchor of an accepted walk exists in the scene;
- a step's sentence is spoken only after a hit on its anchor;
- `stop` from any state gives idle, and no effect follows;
- the reducer never emits vibrate or tone, so haptics stay the engine's;
- for any scaled 3-4-5 or 5-12-13 fact set, `templateWalk`'s calc is exact, and with any needed fact missing it returns null;
- a walk never builds on a segment that `verifyScene` flags.

A new requirement in `requirements.md` and a task entry. A save hook runs `walk.prop.test.ts`.

**agy (backend):**
- `backend/app/explain.py` (new): prompt builder, the injection hardening from `ask.py` (question delimiters, tag stripping, canary), and output parsing.
- Each `calc` is checked with the existing safe evaluator `app/graphs/expr.py` (`parse_expression` / `evaluate`, no eval), within 1%.
- Every number in a `say` must appear in the facts or in a checked calc. Otherwise the whole walk is rejected and the client falls back to a normal Ask answer.
- Route in `main.py` with the same rate limits and `paid_budget` guard as Ask.
- pytest plus Hypothesis tests: a forged calc, a forged number, a bad anchor and an injected fact are all rejected.

**agy (frontend):**
- `api/explain.ts`;
- `flow/walk.ts` glue;
- phrases in `flow/commands.ts`;
- i18n keys in en, hi and gu;
- one serialized EX lane in `Explore.tsx`, which feeds each move's `hitTest` target into `walkStep`. A visible "Show me why" button (48 px) next to Ask for typed use.

## 20-second demo
Triangle sample, eyes closed. Typed: "Show me why AB is 5." Phone: "Four steps. Step one: find side CA." The finger sweeps, buzz: "Side CA is 4 centimetres." "Next step." Buzz: "Side BC is 3 centimetres." "Next step." Corner pulse: "Corner C is a right angle." "Next step." She traces the long side: "AB squared is 4 squared plus 3 squared, 25. AB is 5 centimetres." The camera sees a finger performing a proof. This works offline: it is a template walk with no network.

## Risks, and why they are survivable
- **Hallucination.** An anchor is accepted only if it is a real id. Arithmetic is checked by code, not trusted. Numbers are grounded in facts. The walk refuses if Spec Ghost disputes a segment it uses. Without facts to ground on, the walk does not run, and the student hears "I can't show the steps for this one", then the plain Ask answer. The worst case is today's behaviour.
- **Honesty.** A model walk opens with "These steps come from the AI reading" (this also covers I27). Template walks say nothing extra, because they are computed. Nothing here is phone-tested. Guide is off by default and untested, so the walk is designed to work **without Guide**: finding the anchor by exploring is the core path.
- **Cost.** Template walks are free. A model walk is one text-only call per walk, the same size as Ask, under the existing budget guard and cache. On Raw Mode scenes no walk is offered: no labels means no anchors, so nothing is spent.
- **Speech load (Amara's top complaint).** Speech comes one step at a time, paced by the student. Nothing plays unless she asks, and "stop" or lifting her finger ends it (I02).
- **Scope.** If time runs out, templates plus the reducer alone are a complete, offline, AI-free feature. The model route can follow.

## Why this beats the other three
1. **It changes what the app is for:** from "access to a picture" to "access to the lesson". Teachers grade the reasoning, not only the answer.
2. **It is honest by construction:** every number is checked by code that is already in the repo (`expr.py`, `parseFacts`, `verifyScene`), so the AI is held in place by the existing tests.
3. **It is cheap to build:** no new sensation, no new screen, no new hardware, no paid service. Only one Explore lane.
4. **Kiro has real work:** a reducer with clean properties is exactly where property tests can catch bugs.
5. **The demo is unforgettable:** you watch a blindfolded hand walk through Pythagoras. No other feature makes all three organs act as one creature.
