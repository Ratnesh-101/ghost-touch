# Backend API robustness review (Claude Sonnet subagent, read-only, 2026-11-08)
Read-only code review of committed `schema.py`, `validate.py`, `ask.py`, `semantic.py`, `main.py`. Nothing was run. **Supervisor has NOT re-verified these; verify each before fixing** (fix lanes record FIXED / NOT REPRODUCED / SKIPPED). There is no `/improve` route; the improve pass is a background task in `/scene`.

| ID | Sev | Where | Problem and failing input | Fix |
|---|---|---|---|---|
| F1 | HIGH | semantic.py:276-283, 338-364 | Semantic pre-empt runs before LLM/facts. Bar chart + "What is the maximum value?" answers "There is no peak in this diagram."; "minimum" gives "no lowest point". Only polylines are searched. | Fall back to bars/points when no polylines, else return None. |
| F2 | HIGH | semantic.py:476-549 | Lengths/angles computed in bbox-normalised coords (aspect lost) and facts ignored. A(0,0) B(1,0) C(.5,1), facts ["AB = 4 cm"], 4:1 image: names AC longest (1.118 vs 1). | Add `aspect` to the scene and scale x, or prefer facts. |
| F3 | HIGH | ask.py:349-351 | `clamp_answer` strips `*`, `_`, `#` from fact answers: "3*4 = 12 cm²" is spoken "34 = 12 cm²". | Strip markdown only for `source="ai"`. |
| F4 | HIGH | ask.py:451-469 | `facts_lookup`: (a) point id in `q_content` makes every AB fact tie, `[:3]` drops the length fact; (b) "2.5" tokenised as 2 and 5; (c) threshold 3 lets one noun answer "What colour is the triangle?" with a fact instead of "I don't know from this diagram." (fails CLAUDE.md Task 9 DoD when providers are down); (d) no unit conversion ("in mm?" returns cm). | Drop id tokens, boost numeric facts, tokenise `\d+(?:\.\d+)?`, require id/number or 2 content tokens. |
| F5 | HIGH | validate.py:99-104, 165-178 | A point >0.02 outside [0,1] is dropped with its segments, still `mode:"ai"`. Triangle with C.y=1.05 becomes one line AB while facts say "triangle ABC". | Fail validation if referenced elements were dropped (retry/Raw Mode). |
| F6 | MED | validate.py:79-86, schema.py:71 | NaN/Infinity accepted: NaN x clamps to 1.0; `Bar.value` Infinity wins "tallest", spoken "inf"; may 500 on serialisation and repeat from cache (SUSPECTED). | `math.isfinite` in `_clamp_coord`, `allow_inf_nan=False`. |
| F7 | MED | validate.py:165-178, 242 | Unhashable endpoint crashes `/validate`: segment `a: ["x"]` raises TypeError, 500. | try/except around repair block. |
| F8 | MED | ask.py:491-532 | `_check_scene_size` dict path: `{"scene":{"points":5}}`, `{"facts":5}`, `{"polylines":[{"points":null}]}` give 500 not 422. | `isinstance(list)` checks. |
| F9 | MED | schema.py:49-59, validate.py:304-310 | Empty polyline counts as drawable; `{"kind":"function_graph","polylines":[{"id":"p","points":[]}]}` passes as `mode:"ai"`. | `min_length=2`. |
| F10 | MED | semantic.py:418-473 | Tallest/shortest by `value`, geometry not checked: b1 value 10 but shorter than b2 points the finger at the wrong bar. Ties go to first; negative values; `y_top>y_base` accepted. | Validate bars; say so on a tie. |
| F11 | MED | semantic.py:476-514 | "Is angle A 90 degrees?" / "AB perpendicular to BC?" answer with the first right-angle vertex, not yes/no; rectangle reports one of four; says "no right angle" even when facts say "angle B = 90°". | Use semantic path only when no point id in question, else check facts. |
| F12 | MED | ask.py:346-356, semantic.py:552-661, schema.py | No sanitising of labels/titles/facts: U+202E, U+200B, U+FEFF, U+2028 pass through to speech; semantic answers skip `clamp_answer`; `/scene` has no length caps; empty or duplicate ids accepted. | Normalise in `validate_scene` (strip Cf/Cc/Zl/Zp, cap lengths, reject empty ids), clamp semantic answers. |
| F13 | MED | main.py:299-335 | Improve pass skips the function_graph equation-sampling route and overwrites the precise cached curve with an imprecise trace. | Same post-processing or do not overwrite. |
| F14 | LOW | main.py:780-784 | `suppress(CancelledError): await work` may swallow cancellation aimed at the handler (SUSPECTED). | Re-raise unless `work.cancelled()`. |
| F15 | LOW | validate.py:181-204 | Dangling segment checked before dedupe; duplicate point ids bind to the first. | Reorder. |
| F16 | LOW | main.py:299-301, validate.py | `/validate` returns `str(ValidationError)` and "Unexpected error: {exc}"; `X-Vision-Provider` and `reason:"provider_error"` expose provider names; 415 echoes Content-Type. No stack traces leak. | Generic messages. |
| F17 | LOW | semantic.py:396-415 | "Origin" spoken even if axes cross at x=3 (SUSPECTED). | |
| F18 | LOW | main.py:124-133 | `acquire_slot` `wait_for(sem.acquire())` timeout race could leak a permit on old asyncio (SUSPECTED). | |

Sound: `/ask` cancellation handling, scene semaphore released in `finally`, deep JSON nesting, `PointTarget`/`validate_ask_target` reject non-finite values.

Supervisor priority for the fix lane: F1, F3, F4, F5, F7, F8, F9, F6 first (wrong spoken information for blind users and 500s). These overlap Kiro's Task 24 area (`ask.py`), so run after Kiro's current work and check whether Kiro already fixed any.
