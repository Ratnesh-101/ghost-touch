# Lane x-i18nsheet: native-speaker review sheet for the Hindi and Gujarati strings

Create `docs/reports/agy-x-i18nsheet-report.md` FIRST. Run no tests. Edit only the two new files named here, plus the report and `docs/BUILD_LOG.md`.

The Hindi (hi) and Gujarati (gu) UI strings in `frontend/src/i18n/index.ts` are machine-translated and must be checked by a native speaker before the school session. Produce `docs/user-test/translation-review.md`:
- A short instruction block for a non-technical reviewer (they only judge wording; they never edit code). Say strings are SPOKEN aloud to blind students, so natural spoken phrasing matters more than literal accuracy.
- One table per screen/group (derive groups from key prefixes): columns `Key | English | Hindi | Gujarati | Hindi OK? | Gujarati OK? | Better wording`. Copy every string EXACTLY from the source (do not retranslate or fix anything). Keep placeholders such as `{name}` or `{n}` visible and add a note column entry "keep {n}" where present.
- Mark with "(spoken)" any key the code speaks via the speech driver rather than only shows (grep `speak(` / `t('...')` usage in `frontend/src` to decide; if unsure leave it unmarked and say so in the report).
- A final section listing strings that look suspicious to YOU (same text as English, missing script, mixed scripts, very long) as hints only; do not change the source file.
Also create `docs/user-test/translation-review.csv` with the same rows (UTF-8, header row, quoted fields) so it can be opened in a spreadsheet.
In the report state the total key count per language and confirm hi/gu key counts equal en.
End with **Commit groups** (one commit: `docs: add Hindi and Gujarati translation review sheet`).
