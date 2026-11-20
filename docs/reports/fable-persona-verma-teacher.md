# Ghost Touch through a teacher's eyes: Mr. Verma, special educator

Persona review, read-only. Written against `main` at `a82f7bf` (all hx lanes and the stacked
Explore lanes merged). Scope: the teacher and deployment path. It does not repeat
`docs/reports/fable-hardening-plan.md`; where a point touches that plan it says so and builds on it.
Everything below was read from the code. Nothing was run on a phone or on the deployed site, so
items that need a phone or a real network are marked "to confirm".

Who is speaking: I am Verma, 47. I teach blind and low-vision children in classes 8 to 10 in a
government school. I think in Hindi first, Gujarati second. My phone is an old Android with a
cracked screen, my 4G comes and goes, there is nobody to call for IT help, and tonight I have
40 minutes to prepare tomorrow's lesson on triangles.

---

## 1. Verdict

**I would try it this week. I would not yet depend on it for a lesson.**

What is good, and I mean it:

- The idea is right. A tactile diagram costs me an evening with thread and glue; this costs a photo.
- It is honest: it says when the AI failed (`raw.announce`) and when facts and drawing disagree
  (`verify.disagree`). No login, no student accounts, no trackers (`docs/PRIVACY.md` section 1).
- Samples and saved diagrams open with no network, and a share link carries the whole diagram.
- Errors are spoken and written, in my language, and tell me what to do next.

What stops me from depending on it:

1. **No teacher path.** My tools sit behind a build switch and a Settings toggle; nothing says so.
2. **I cannot check a result the next morning.** The photo is gone once I leave the screen.
3. **Hindi is a coat of paint.** Buttons are Hindi; the diagram's title, labels and facts are English.
4. **"It never fails" needs a network.** Raw Mode runs on the server, not on the phone.
5. **Twenty saved diagrams, no names I chose, no backup.** That is one chapter, not a term.

Fix 1, 2 and 3 and I use it weekly. Hit 4 once in front of a class and I return to thread and glue.

---

## 2. Top 10 problems I would hit

Ranked by how likely each is to make me stop using the app.

### P1. There is no teacher path, and my tools are hidden twice

- The Start screen is one big button that says "Wake the creature", in Hindi "जीव को जगाएं", in
  Gujarati "પ્રાણીને જગાડો" (`frontend/src/i18n/index.ts:246, 736, 1229`). In my language that means
  "wake the animal". I do not know what I am being asked to do.
- The Teacher Editor exists only if the site was built with `VITE_FEATURE_SHARE=1`
  (`frontend/src/config/features.ts:30-31`) **and** I turn on "Teacher tools" in Settings
  (`frontend/src/flow/teach.ts:60-62`). `docs/DEPLOY.md` does not mention that switch; only
  `docs/OWNER_CHECKLIST.md:9` does. If the owner forgot it, the toggle is not even shown.
- The Settings button reads "Settings: English, normal" and opens "Lab settings"
  (`i18n/index.ts:255-256`): Teacher tools among nine student switches. No doc is for a teacher.

Result: a teacher who is given only the link will take a photo, hear a result, and never learn
that correction, verification or sharing exist.

### P2. The app opens in English on a Hindi phone

`getStoredLang()` returns `'en'` unless a language was already saved
(`frontend/src/i18n/index.ts:29-33`); the phone's language is never read. The first words my
student hears are English, and the language choice is inside the Settings button from P1. A
blind child alone cannot find it, so I must set up every phone by hand.

### P3. I cannot verify the result after the first minute

- The Correct screen shows the photo under the drawing (`frontend/src/App.tsx:785`,
  `correct.photoOverlay`). That is exactly what I need to check the AI.
- But the photo lives only in memory. `handleBack` and `handleSavedOpen` both call
  `updatePhotoUrl(null)` (`App.tsx:634, 698`). A saved diagram stores a 120 px line thumbnail,
  never the photo (`docs/PRIVACY.md` section 7.1).
- So: I photograph ten diagrams tonight, open them tomorrow to check, and the overlay is empty. I
  must hold the textbook beside a cracked screen and compare by eye.

I understand the privacy reason, but for the teacher the photo is the answer key. Let me choose
to keep it on my own phone.

### P4. The diagram's own words come back in English

- The upload sends only the image: `body.append('image', image, 'diagram.jpg')`
  (`frontend/src/api/scene.ts:162-166`). No language goes with it.
- The extraction prompt has no language instruction at all (`backend/app/vision/prompts.py:13-48`).
  It even asks for English teacher terms: "hypotenuse", "right angle at B".
- So with Hindi selected, the phone's Hindi voice reads "hypotenuse AC" and "AB = 3 cm". A Hindi
  voice reading English words is hard to follow for a child from a Hindi-medium school, where the
  word is कर्ण.
- Ask does reply in my language (`backend/app/ask.py:365`, `ask.py:40-46`), so the gap is only
  on the scene side. Half the app speaks Hindi and half does not.

Also the fact shapes are fixed English patterns ('AB is parallel to CD'), while my Hindi-medium
book prints "AB ∥ CD" and "सेमी". To confirm on real pages.

### P5. "It never leaves you with nothing" is true only with a network

- Raw Mode is OpenCV on the server (`backend/app/raw_mode.py`, `backend/app/main.py:680-764`).
  Offline, a new photo gets only "You are offline. Samples still work."
  (`frontend/src/flow/capture.ts:80-85`). Three samples are not my lesson.
- The upload is up to 1600 px at JPEG quality 0.85 (`frontend/src/drivers/camera.ts:21, 169`),
  a few hundred kilobytes, and the client waits 65 s (`api/scene.ts:28`). On 2G it may not finish;
  I then hear "The server took too long" though the server never saw the photo.
- Voice questions also need the network, so in a dead zone only the typed box is left.

### P6. When I get Raw Mode, I am not told why

The server sends a reason: `budget_exhausted`, `timeout`, `provider_error`, `no_provider`, `error`
(`backend/app/main.py:772, 844-890`). The client parses it (`frontend/src/api/scene.ts:136-137`)
and then drops it: `Capture.tsx:226` passes only `mode` to the app. For every cause I hear the
same sentence, "I couldn't fully read this diagram."

For me these are different instructions:

| Reason | What I should do |
|---|---|
| timeout | Try again now, or move near the window |
| budget_exhausted | Stop trying today; use saved diagrams |
| provider_error | Try once more in a minute |
| unreadable picture | Retake: closer, flatter, more light |

The hardening plan already covers the shared daily budget for a school on one network address
(its owner decision 1). My point is the next step: when it happens, tell the teacher in words.
Without that I will retake the same photo five times and burn data.

### P7. Twenty diagrams, auto-filled, with names I did not choose

- Every photo is saved automatically (`App.tsx:629-631`), including Raw Mode attempts and
  retakes. The cap is 20 (`frontend/src/core/savedDiagrams.ts:37`); the oldest unpinned entry is
  removed silently. If I pin all twenty, the next save fails (`saved.errorAllPinned`).
- The Saved screen offers open, pin and delete only (`frontend/src/screens/SavedDiagrams.tsx`).
  No rename, no date, no chapter. Five entries titled "Triangle ABC" are five identical lines.
- No export. If I clear Chrome data to free space, which I do often on this phone, all is gone.
  I need about 100 diagrams a term, for classes 8 to 10.

### P8. I verify it, and the app tells my student "not checked"

A shared link is announced as "Shared by {name}, not checked" plus "Ghost Touch cannot confirm
it is right" (`i18n/index.ts:322, 333`; built in `frontend/src/flow/share.ts`). I understand why:
a link can be forged. But the student hears, from the machine, that the teacher's work is
unchecked. In my classroom my word is the check.

Also the Correct button is shown to everyone in Explore (`App.tsx:769`,
`frontend/src/screens/Explore.tsx:2337-2345`); it is not behind Teacher tools. A student can move
a point by accident, and it then saves over the diagram I prepared (`App.tsx:677`).

### P9. Sharing is not shaped for WhatsApp, which is how my school works

- The link holds the whole diagram: up to 12,000 characters after `#s=`
  (`frontend/src/share/limits.ts:9`). A QR code is offered only up to 2,000 (`limits.ts:14`), then
  "Link too long for a QR code" (`i18n/index.ts:394`). A curve will likely exceed it.
- A message full of random letters looks like spam to a parent and breaks easily when forwarded.
- If the student's phone has never opened the app online, the link still needs the network.
- One link is one diagram, with a gate tap and a disclaimer each time. No "Chapter 6, all figures".

### P10. Hindi and Gujarati wording, and the voice

The text reads like a translation of a software manual, not like a classroom. Examples, all in
`frontend/src/i18n/index.ts`:

| Line | Now | A teacher would say |
|---|---|---|
| 572 | "फ़ाइल प्रकार समर्थित नहीं है" | "यह फ़ाइल नहीं चलेगी। फ़ोटो चुनें।" |
| 562 | "कोई छवि चुनें" | "गैलरी से फ़ोटो चुनें" |
| 604 | "तत्वों पर टैप करें ... बिंदुओं को खींचें" | "जिसे बदलना है उसे छुएँ" |
| 559 | "पूर्ण हैप्टिक्स के लिए" | "कंपन के लिए" |
| 649 | "सभी स्लॉट पिन हैं" | "जगह भर गई है" |
| 566 vs 569 | "पुन: प्रयास" and "पुनः प्रयास" | one spelling; or simply "फिर कोशिश करें" |
| 541 vs 636 | "चित्र" and "आरेख" for the same thing | pick one; textbooks say "आकृति" |
| 1385 | "ખૂણા {vertex}" | "ખૂણો {vertex}" (singular) |

Voice problems:

- Many old phones have no Gujarati voice. The notice then says "{lang} के लिए कोई सिस्टम आवाज़
  नहीं मिली" with the code "GU" or "HI" in the gap (`frontend/src/drivers/speech.ts:314-317`),
  and continues in the default voice, which reads Gujarati script badly or not at all. It does not
  tell me how to install the voice.
- `docs/PRIVACY.md` section 2 itself marks the Hindi and Gujarati notices "machine-translated,
  needs native review". A review sheet exists (`docs/user-test/translation-review.csv`).

### Smaller things I noticed

- No crop step: text, two figures and my thumb all go to the AI. A PDF gives only its first
  page (`capture.firstPagePdf`); my chapter PDF has the figure on page 7.
- The build is about 2.8 MB, about 1.7 MB of it the PDF reader, and the service worker precaches
  `mjs` files up to 3 MB (`frontend/vite.config.ts:46-48`). I may pay for a reader I never use.
- The API host is `onrender.com` and the page is on Vercel (`frontend/vercel.json:24`). School
  and office networks sometimes block such shared hosting names. If only the API is blocked, I
  get the generic "Something went wrong" (`capture.ts:84`), not "this network blocks Ghost Touch".
- The privacy notice is a document, not a screen. Photos go to OpenAI, then Gemini, then Nebius
  (`docs/PRIVACY.md` 4.1); the plain rule "no faces, names or notebooks in the photo" is missing.

---

## 3. What would make me use it every week, or abandon it

**Every week if:** I can prepare at home on wifi and teach with no network; I can see photo and
drawing together, fix a label in ten seconds and mark it checked; the diagram speaks Hindi words
my students know; one WhatsApp message gives the class a chapter; and a pack covers the chapters
I teach, so most days I take no photo.

**Abandon if:** it fails once in front of the class with no explanation; a wrong label reaches a
child (a blind student cannot see that "B" should be "D", so a wrong diagram is worse than none);
my prepared diagrams vanish when I clear storage; or each student's phone takes more than two
minutes to set up.

---

## 4. Top 10 improvements, ranked by impact against effort

Effort: S = under a day, M = one to three days, L = a week or more. Each is sized to be one Kiro
task or one small lane.

| # | Improvement | Fixes | Impact | Effort |
|---|---|---|---|---|
| 1 | One-page teacher guide in three steps, in English, Hindi, Gujarati | P1 | High | S |
| 2 | Pick language on first run; default from the phone's language | P2 | High | S |
| 3 | Say why Raw Mode happened, with the next step | P6 | High | S |
| 4 | Send the chosen language with the photo; AI writes title and labels in it | P4 | High | M |
| 5 | "Check before you hand over" screen; keep the photo on the phone if the teacher asks | P3, P8 | High | M |
| 6 | Diagram packs for common chapters, bundled and offline | P5, P7 | High | M to L |
| 7 | Saved diagrams for a teacher: rename, folders, higher cap, export and import | P7 | High | M |
| 8 | WhatsApp sharing: short message, a file for long diagrams, a whole set at once | P9 | Medium | M |
| 9 | Raw Mode on the phone when offline; queue the photo for later | P5 | Medium | L |
| 10 | Native review of Hindi and Gujarati text; voice install help | P10 | Medium | S to M |

### Detail

**1. Three-step teacher guide (S).** One page, `docs/TEACHER_GUIDE.md`, also reachable from
Settings. Step 1: at home on wifi, photograph and check. Step 2: save and name. Step 3: hand over
the phone or send the link. Add a "before class" list (volume up, vibration on, battery saver
off; the per-brand help at `i18n/index.ts:262-274` is good) and the photo rule: flat page, no faces.

**2. Language on first run (S).** If no language is stored, read the phone's language; if it
starts with `hi` or `gu`, use it. Then speak one line in all three: "English. हिंदी के लिए दो
बार टैप करें." Rename "Wake the creature" to a plain verb in Hindi and Gujarati ("शुरू करें",
"શરૂ કરો"); keep the creature for the English pitch.

**3. Reasons for Raw Mode (S).** Pass `reason` from `Capture.tsx:226` into the announcement: four
short sentences per language, as in the P6 table. For `budget_exhausted` add "Saved diagrams and
packs still work."

**4. Language to the AI (M).** Add a `lang` form field to `/api/v1/scene`; add one prompt line:
"Write the title and descriptive labels in {language}; keep point ids (A, B, C) and printed
measurements exactly as printed." Include `lang` in the cache key (`scene_cache.py`) so a Hindi
request does not return a cached English scene. Fact shapes stay machine-readable; speak them
through a small table (cm to सेमी, angle to कोण, parallel to समांतर). Backend change, so pair it
with a Hypothesis property: ids never change with language.

**5. Check before hand-over (M).** After a photo, when Teacher tools are on, show photo and
drawing side by side with three large buttons: "Correct", "Fix a label", "Take again". List the
labels and facts as text so I can read them in five seconds. Put the existing `verify.disagree`
warning at the top in red. Options inside it:
- "Keep this photo on this phone" (off by default; stored with the saved diagram; never uploaded
  again). This makes next-morning checking possible.
- "Checked by me": a flag on the saved diagram, spoken to the student as "Checked by your
  teacher" for diagrams opened from Saved on the same phone. Keep "not checked" for links.
- Hide the Correct button in Explore unless Teacher tools are on.

**6. Chapter packs (M to L).** The samples are already JSON files in `frontend/public/samples/`,
about 20 KB for three. Fifty diagrams would be well under 1 MB. Start with one pack that a
teacher has checked by hand, for example NCERT Class 9 Maths: lines and angles, triangles,
quadrilaterals, circles; and Class 10: similar triangles, trigonometry, a parabola, a bar chart.
Draw them fresh from the mathematics rather than copying textbook artwork. Labels in three
languages. Opens offline, uses no AI quota, needs no photo. This single feature covers most of my
week and makes the 2G and quota problems rare.

**7. Teacher's saved list (M).** Rename; show the date; group by a free-text "chapter"; raise the
cap for teachers (scenes are small; 200 is safe). "Export all" to one file and "Import", so a
cleared browser or a new phone is a two-minute repair. Keep Raw Mode results and retakes in a
separate "recent" row that cannot push out prepared work.

**8. WhatsApp-friendly sharing (M).** The Web Share driver exists
(`frontend/src/drivers/clipboard.ts`). Send a human sentence first, then the link: "कक्षा 9,
त्रिभुज ABC. खोलने के लिए छुएँ:". Over the QR limit, offer "Send as file" (a small JSON the app
imports) instead of an error; allow a set of diagrams in one file. On the student's side offer
"Save to this phone" so the gate and disclaimer are heard once.

**9. Offline Raw Mode and a queue (L).** Do the queue first, it is cheaper: when offline, keep
the photo on the phone and say "I will read this when the network is back." Later, a small edge
detector in the browser (in a driver, not in `core/`); weaker than OpenCV but better than
nothing. Cheap first step: split `capture.errorTimeout` into "your connection is slow" versus
"the server is slow" by checking whether the upload finished.

**10. Language review and voices (S to M).** One Hindi-medium and one Gujarati-medium maths
teacher go through `docs/user-test/translation-review.csv`, starting with the table under P10 and
using textbook words (आकृति, कर्ण, शीर्ष, समकोण; આકૃતિ, કર્ણ, શિરોબિંદુ). The missing-voice notice
names the language, not "GU", says how to install it, and offers Hindi before the default voice.

### Quick wins outside the ten (each S)

- A crop box after the photo (also cuts upload size), and a "low data" switch (1024 px).
- Load the PDF reader only when a PDF is chosen; keep it out of the precache; add a page picker.
- If `/api/v1/health` fails but the page loaded, say "This network may be blocking Ghost Touch.
  Try mobile data."
- Show the three-sentence privacy notice (`docs/PRIVACY.md` section 2) once in the app, after review.

---

## 5. Monday morning: a walkthrough

**Sunday, 9:10 pm, home wifi.** My nephew sent me the link. I open it in Chrome.

1. A dark screen, a stitched phone, "Wake the creature". English. I tap; it buzzes and says "Take
   a photo, choose an image, or pick a sample diagram." Clear.
2. I look for Hindi. The only candidate is "Settings: English, normal", then "Lab settings",
   then Language. Two minutes gone (P2).
3. I try the triangle sample with my eyes closed. Buzz on the lines, a double buzz and the name at
   each corner. I find the right angle by touch. This is the moment I believe in the app.
4. I photograph figure 7.3 from the Class 9 book. "आपके चित्र को पढ़ा जा रहा है" and a soft beep.
   The server is waking; about forty seconds. Then an English title, and the Hindi voice
   struggling with "hypotenuse" (P4).
5. Is it right? Corner "B" seems to be where the book has "D". I tap "सुधारें" and here is the
   photo under the green lines. I fix the label and save. Good, but nobody told me it was here (P1).
6. Five more photos. Two come back as "मैं इस चित्र को पूरी तरह नहीं पढ़ सका". Bad photo, or
   free limit finished? I retake both twice. Same sentence (P6).
7. I want to send the triangle to Kavya's mother on WhatsApp. No share button in Explore or
   Saved. I give up for tonight (P1, P9).

**Monday, 8:40 am, classroom. One bar of signal, then none.**

8. The app opens offline. Saved diagrams: nine entries, three with the same name, no dates, two
   of them last night's failed outlines (P7).
9. I re-check figure 7.5 before giving the phone to Arjun. सुधारें shows green lines on black, no
   photo (P3). I compare with the book by eye: three minutes I do not have.
10. Arjun traces the triangle, finds all three corners, and smiles. He asks by voice "AC कितना
    लंबा है?" No network, so listening fails, and he cannot type. I read the fact aloud (P5).
11. Meena wants the next figure, which I did not prepare. Photo: "आप ऑफ़लाइन हैं। नमूने अभी भी
    काम करते हैं।" Nothing to feel. I draw it on her palm, as I have for twenty years (P5).
12. Arjun's finger slips onto सुधारें. He is in an editor he cannot see, dragging a point. I take
    the phone back and cancel (P8).

**Monday, 9:20 am.** The lesson worked for the one diagram I had prepared and checked, which is
already more than last week. It did not work for anything unplanned.

**The same morning after improvements 1 to 7:** the app opens in Hindi. Chapter 7 is in the
pack, checked, offline. At home I photograph only two unusual figures, see photo and drawing
together, fix one label, press "Checked by me", and file them under "कक्षा 9, त्रिभुज". In class
with no signal, everything opens and speaks Hindi. For Meena's unplanned figure the phone says
"नेटवर्क नहीं है, बाद में पढ़ूँगा", an honest answer I can work with. That app I would use weekly.

---

## 6. Notes for the orchestrator

- Read from code only; P4, P5, P9, P10 and the production value of `VITE_FEATURE_SHARE` need a
  real phone or network to confirm.
- One file written. No source, spec, `tasks.md`, commit or BUILD_LOG change (single-file rule).
  Please log it as: tool = Claude Code, "persona review, teacher path, read-only".
- All ten improvements are feature work, so they belong to Kiro as spec tasks. Improvement 4
  touches the backend prompt and cache key; improvement 3 builds on hardening-plan owner decision 1.
- Improvement 6 needs a human teacher to check each pack diagram. That check is the product.
