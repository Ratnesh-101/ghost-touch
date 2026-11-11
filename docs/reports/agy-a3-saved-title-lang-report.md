# Lane Report: a3-saved-title-lang (Saved screen titles follow the active language)

**Status:** DONE
**Tool:** agy, reviewed by Claude
**Lane:** a3-saved-title-lang

## Brief Summary
Fixed the issue where untitled diagrams on the Saved Diagrams screen displayed and spoke English kind names (e.g. "geometry") regardless of the active language because titles were evaluated once at save time and read from `entry.title`. Updated `SavedDiagrams.tsx` so that every place reading `entry.title` for display, accessible names, and spoken announcements computes the displayed title at render time via `savedTitle(entry.scene, activeLang)` using the active language (subscribing to language changes via `subscribeLang`). Handed the displayed title to `onOpen(entry.scene, title, entry.id)` so Explore's heading matches what was spoken. Kept stored `entry.title` intact without schema changes or mutations.

## Implementation Details
1. `frontend/src/screens/SavedDiagrams.tsx`:
   - Subscribed to i18n language updates with `useSyncExternalStore(subscribeLang, getLang, getLang)` and supported optional `lang?: Lang` in `SavedDiagramsProps` as `const activeLang: Lang = propLang ?? currentLang;`.
   - Computed `const title = savedTitle(entry.scene, activeLang)` at render time for each entry.
   - Updated visible text: `<span className="gt-saved__title">{title}</span>`.
   - Updated accessible names (aria-labels):
     - Open button: `${t('saved.open')} ${title}`.
     - Pin / unpin button: `${pinLabel} ${title}`.
     - Delete request button: `${t('saved.delete')} ${title}`.
     - Confirm delete button: `${t('saved.confirmDelete')} ${title}`.
     - Cancel delete button: `${t('saved.cancel')} ${title}`.
   - Updated spoken announcements:
     - `handleOpen`: `t('saved.opened').replace('{title}', title)` and spoke with `LANG_BCP47[activeLang]`.
     - `handleDeleteRequest`: `t('saved.deleteConfirm').replace('{title}', title)`.
     - `handleConfirmDelete`: `deletedAnnouncement(title, remaining.length)`.
     - `handleTogglePin`: `t('saved.pinned.announced').replace('{title}', title)` / `t('saved.unpinned.announced').replace('{title}', title)`.
     - Initial list load: `joinAnnouncements(view.entries.map((e) => savedTitle(e.scene, lang)))`.
   - Updated `onOpen`: passed `onOpen(entry.scene, title, entry.id)` so Explore receives the rendered title.
   - Preserved `entry.title` in storage and state during pin toggling and list display without mutating entry objects.
2. `frontend/src/App.tsx`:
   - Made smallest possible edit passing `lang={currentLang}` to `<SavedDiagrams ... />` on line 746.
   - Left `Explore.tsx` untouched.
3. Architecture & Constraints:
   - TypeScript strict mode preserved; zero `any` types.
   - No browser APIs introduced outside drivers.
   - Preserved 48×48 px touch targets (`.gt-control`) and spoken state change flows.
   - No Kiro-owned files touched (`frontend/src/core/**`, `*.prop.test.ts`, `.kiro/**`).
   - Obeyed hard rule: zero shell commands executed.

## Tests
Created `frontend/tests/a3.savedTitleLang.test.tsx` containing comprehensive regression tests:
1. `renders Hindi kind name for untitled geometry scene stored in English`:
   - Stored untitled geometry diagram with `title: 'geometry'`.
   - In Hindi ('hi'), verifies visible text is 'ज्यामिति' (from `KIND_NAMES.hi.geometry`), open button aria-label is 'खोलें ज्यामिति', open click speaks Hindi announcement in 'hi-IN', `onOpen` receives 'ज्यामिति', and stored entry `title` is not mutated.
2. `renders "geometry" in English for untitled geometry scene`:
   - In English ('en'), verifies visible title, open button aria-label, and spoken open announcement use 'geometry'.
3. `shows scene own title in every language (en, hi, gu)`:
   - Verifies diagrams with custom titles (e.g. 'Pythagorean Triangle') preserve their title across English, Hindi, and Gujarati without modification.
4. `dynamically re-renders displayed titles when language changes without remounting`:
   - Verifies changing language dynamically via `setLang('hi')` and `setLang('gu')` triggers immediate re-render of displayed titles and aria-labels without remounting.
5. `uses active language title for pin, unpin, and delete announcements and aria-labels`:
   - Verifies pin, unpin, delete request, and deletion confirmation announcements and button labels format with the active language kind name ('बार चार्ट').
6. `synthesises kind with labelled points in the active language`:
   - Verifies untitled scene with labelled vertices synthesises kind in the active language ('ज्यामिति: A, B' in Hindi, 'ભૂમિતિ: A, B' in Gujarati, 'geometry: A, B' in English).
7. `respects optional lang prop when passed directly`:
   - Verifies passing `lang="gu"` directly overrides global language and renders Gujarati kind name ('વિધેય આલેખ').

## Deferred
None.

## Pass 2 (Supervisor Gate Follow-up)

**Status:** DONE

1. **Resolved TypeScript strict indexing errors (TS18048 and TS2769):**
   - In `frontend/tests/a3.savedTitleLang.test.tsx`, indexed lookups into `KIND_NAMES`
     (`KIND_NAMES['hi']?.['geometry']`, `KIND_NAMES['gu']?.['geometry']`,
     `KIND_NAMES['hi']?.['bar_chart']`, and `KIND_NAMES['gu']?.['function_graph']`) now extract
     the string into a local const guarded by explicit undefined checks that throw descriptive
     errors on failure (e.g. `if (hiGeometry === undefined) throw new Error(...)`).
   - Narrowed values to `string` without any non-null assertions (`!`), `any` types, or type casts.
   - Fixed dependent `.replace('{title}', ...)` calls so strictly typed `string` arguments are supplied.

2. **Fixed Vitest regression in English untitled geometry scene test:**
   - Updated test 2 ("renders geometry in English for untitled geometry scene") to assert against
     the dynamically computed value `t('saved.opened').replace('{title}', 'geometry')`
     ('Opening geometry.') rather than a hard-coded guess ('Opened geometry.').
   - Compared the spoken announcement directly with that computed string, verified BCP47 tag `'en-IN'`,
     and separately verified that both the computed string and spoken utterance contain the displayed
     title `'geometry'`, preventing future i18n drift.

3. **Constraints & Verification:**
   - Only `frontend/tests/a3.savedTitleLang.test.tsx` was modified; zero production code changes.
   - All lines kept strictly within 100 columns and clean formatting.
   - Zero shell commands executed during headless run.
