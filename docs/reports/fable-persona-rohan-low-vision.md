# Ghost Touch through low-vision eyes: Rohan's review (2026-11-17)

Tool: Claude Code (persona review, read-only). Checked against `main` at `a82f7bf`.
Method: I read the CSS, the canvas drawing code, the Devpost gallery images and the product
docs, and computed every contrast ratio below from the actual hex values (WCAG 2.x relative
luminance). Nothing here was run on a phone. Where a claim needs a phone to confirm, I say so.

This builds on `docs/reports/fable-blind-user-plan.md`. That plan covers what a fully blind
student feels and hears (silence, corner stutter, compass, proximity click, graph scan, speech
pacing, page-edge cue). I do not repeat any of it. This report is about the other half of the
audience: students who can see a little and want to use that.

## 1. Verdict

I am Rohan. I am 15. I have about 5 percent central acuity, bright light hurts, and I read my
phone at 300 percent with high contrast. I use Select to Speak sometimes and TalkBack almost
never, because I can see enough that TalkBack gets in my way.

**Verdict: the app is kind to my eyes by accident and useless to them by design.** The dark
theme and the 14.6:1 green are the right starting point for a light-sensitive person. But every
visual decision after that was made for "sighted observers" (the code's own words, three times:
`frontend/src/screens/Explore.tsx:957`, `:1079`, `:1087`), meaning a teacher or a judge with
normal sight watching over a blind student's shoulder. Nobody drew this screen for a student
who is looking at it with a damaged eye from 8 cm away.

What that means in practice:

- The diagram is a 4 px line with a 16 px letter next to it. I cannot read the letter.
- Nothing on the screen changes when my finger finds something. The phone buzzes and speaks,
  but my eyes get no confirmation, so I cannot connect what I feel to what I see.
- The Settings sheet has ten sections for voice and vibration and not one for vision.
- The docs say "blind and low-vision" in six places and never once say what a low-vision
  student gets that a blind student does not.

The fix is not a redesign. The canvas already has everything it needs: one drawing function,
hard-coded constants, a cursor position. A visual profile (stroke width, label size, glow
on or off, highlight on or off) is a small change with a large effect, and it makes the app
honest about its own slogan.

I would use Ghost Touch today as a blind student would, eyes closed. I want to use it with
my eyes open.

---

## 2. Top 10 problems

Ranked by how much each one stops me using my remaining sight.

### P1. Labels on the canvas are 16 px and cannot be made bigger

`frontend/src/screens/Explore.tsx:1051` sets `ctx.font = '16px system-ui, sans-serif'` and
`:1059` draws the label at a fixed offset of `+10, -10` from the corner.

- 16 CSS px is about 2.5 mm tall on a phone. I need letters several times that size.
- It is canvas text. Browser text scaling, Android font size and Select to Speak do nothing
  to it. Select to Speak cannot read it at all, because it is pixels, not text.
- It uses `system-ui`, not the Atkinson Hyperlegible font the README advertises for
  low-vision character distinction (`README.md:98`). The one place where telling B from 8 and
  C from G matters most is the one place the legible font is not used.
- The fixed offset means a label near the top or right edge can be drawn partly off the
  canvas, and nothing stops a label from landing on top of a line.

In the gallery image `docs/media/devpost/03-explore-triangle.png` the letters A, B and C are the
smallest text on the whole slide.

### P2. Only point labels are drawn. Bars, axes, values and facts are invisible

The drawing function (`Explore.tsx:936-1063`) draws axes, segments, polylines, bar outlines
and vertex dots. It draws text only for `p.label` on points. So on screen:

- a bar chart is four empty green rectangles with no names and no numbers;
- a graph has two axis lines with no "x", no "y", no scale;
- "AB = 3 cm" exists in the scene's facts and is never painted anywhere on the canvas.

A blind student gets these by speech. I get them by speech too, but I am looking at a screen
that shows less than the textbook page I photographed. For me the app removes information.

### P3. Nothing lights up when I touch it (vision and touch never meet)

When my finger is on side AC the phone buzzes. The line on screen stays exactly as it was.
The only visual feedback is a white dot of radius 5 px (`Explore.tsx:1081-1084`) drawn exactly
under my fingertip, where I cannot see it, and white on the green line is 1.33:1 so it would
vanish there anyway.

There is a pulse ring (`frontend/src/styles/global.css:1616-1675`), 44 to 56 px, cyan at
corners. That is the right idea. But it only appears when the fallback haptic driver is active
(`Explore.tsx:429-445`), that is, on phones with no vibration. On a phone that vibrates, which
is the target phone, I get no visual feedback at all. It also lasts 120 ms, which is too short
for me to find.

### P4. What I see and what I feel are different shapes

The line I see is 4 px wide. The line I feel is 28 px wide (hit radius 14 px each side, from
`tech.md`). The corner I see is a 6 px dot. The corner I feel is a 44 px disc (radius 22 px).

I am not asking to change the tuned values. They are right for a fingertip. But my eye says
"the line is here" and the buzz starts 14 px before I get there and continues 14 px after.
Near a corner the buzz switches to the corner pattern while I can still see I am clearly on
the line. For someone using both senses this feels like the app is wrong. Showing the touch
zone (a faint band and a ring) would make the two agree.

### P5. The glow is glare

`Explore.tsx:972-973` puts a 12 px green `shadowBlur` on every stroke, and the title has a
12 px `text-shadow` (`frontend/src/styles/explore.css:58`). For a light-sensitive eye, glow
around a bright line on black is halation: the edge I am trying to locate is the part that has
been blurred on purpose. A 4 px line with a 12 px halo has no crisp edge left. It is pretty in
the gallery. In a bright classroom, with reflections on the glass, it is the first thing to
wash out. There is no way to turn it off; `prefers-reduced-motion` does not cover it (it is
not motion) and the canvas ignores `prefers-contrast`.

### P6. No vision settings, and the media queries never fire on my phone

`frontend/src/components/LabSettings.tsx` has sections for language, speech speed, speech
detail, directions, finding sound, stay-on-line, graph scan, corner heartbeat, vibration help,
guide and teacher mode (headings at lines 310-638). There is nothing for stroke thickness,
label size, glow, colour or highlight.

The CSS does have `forced-colors` and `prefers-contrast` blocks (`global.css:1502-1533`,
`explore.css:784`). As far as I know, forced colours is a Windows feature and Chrome on Android
does not report it, and Android's "High contrast text" switch does not set `prefers-contrast`
for web pages. So on the one platform this app targets, those blocks are probably dead code.
This needs a phone check, but if it is true, the only way I can get high contrast is an
in-app switch, and there is none.

### P7. The status card is small, clipped, and changes faster than I can read

`explore.css:214-226` and `global.css:1022-1035`: status text is `0.875rem` (14 px), clamped to
three lines, in a card of fixed height `5rem` with `overflow: hidden`.

- 14 px is the second-smallest text on the screen, for the most important sentence.
- Anything longer than three lines is cut with an ellipsis and there is no way to see the
  rest. The opening overview sentence in the gallery image already fills all three lines.
- The text is replaced every time my finger crosses something. At 300 percent magnification I
  read slower than the speech, and there is no history, so a message I half-read is gone.
- The fixed height is there for a good reason (Requirement 25.4, the canvas must not move).
  I agree with the reason. But the result is that the card cannot grow when I ask for bigger
  text. The fix has to give me large print somewhere else, not by resizing this card.

Also: the card's own edge is nearly invisible. `global.css:1013` gives it a 1 px
`--gt-border-subtle` border (1.41:1), which wins over the copper border in `explore.css:202`
because global.css rules come after the import. The card background against the page is
1.08:1. I cannot see where the card is.

### P8. Landscape and large display size break the Explore layout

- `.gt-explore` is `height: 100dvh` with the canvas at `min-height: 220px`
  (`explore.css:20-35`, `:84`). In landscape a phone is roughly 360 px tall. Settings button
  (48) plus title plus status card (80) plus canvas (220) plus footer (52) plus gaps is well
  over 450 px, so the screen scrolls. But the canvas is `touch-action: none`, so I can only
  scroll by dragging on the thin strips above and below it.
- The landscape rule at `global.css:1572-1576` sets `min-height: 1.75rem` on the status card
  to save space, but `height: 5rem` (`global.css:1016`) still applies, so the card stays 80 px
  tall. The rule does nothing.
- `.gt-explore` is capped at `max-width: 640px`, so turning the phone sideways never gives me
  a bigger diagram. Landscape is strictly worse.
- With Android display size at the largest setting the CSS viewport gets narrower (often
  around 320 px or less). The footer can hold five buttons (Guide me, Where am I, Ask,
  Correct, Back; `Explore.tsx:2305-2350`) in a wrapping row, so they wrap to two or three rows
  of 52 px and the canvas is squeezed to its 220 px floor. The bigger I ask everything to be,
  the smaller the diagram gets.

### P9. I cannot zoom the diagram

The page allows pinch zoom (`frontend/index.html:5` has no `user-scalable=no`, good). But the
canvas container is `touch-action: none` (`explore.css:85`, `:154`) and two-finger gestures on
it are app gestures (swipe down to leave, long-press to ask). So the one thing I want to
magnify is the one thing I cannot pinch. Android's own magnifier (triple tap) should still
work, but then the bitmap is capped at device pixel ratio 2 (`Explore.tsx:1131`), so at 300
percent the 4 px line and 16 px letters are enlarged blur. Needs a phone check for how the
system magnifier's two-finger pan interacts with the app's two-finger gestures.

### P10. The words leave me out

- The tagline on the first screen is "Feel diagrams you can't see"
  (`frontend/src/i18n/index.ts:42`, `:247`). I can see them. Badly. This sentence tells me the
  app is for someone else.
- `.kiro/steering/product.md:4` and `:13`, `README.md:11`, `docs/STEMERGENT_SUBMISSION.md:7`
  and `:9` all say "blind and low-vision". None says anything specific about low vision. The
  README's accessibility list (`README.md:97-98`) offers contrast and a font, which are about
  reading the buttons, not the diagram.
- `STEMERGENT_SUBMISSION.md:7` says a diagram is "a blank on the page" for a low-vision
  student. It is not blank for me. It is small, faint and crowded. That is a different
  problem with a different fix, and the app could solve it.
- The Devpost gallery (`docs/media/devpost/`) has ten slides. None shows or mentions a
  student looking at the screen. The teacher editor slide is the only one about someone with
  sight.

### Smaller things I noticed

- Correct and Teach editors show selection by hue only: selected `#58a6ff` against unselected
  `#3fb950` is 1.01:1 in luminance (`frontend/src/screens/Correct.tsx:385`, `:453`). Width
  changes from 4 to 6 px help a little. Their canvas labels are `bold 12px sans-serif`
  (`Correct.tsx:472`, `frontend/src/components/teach/TeachCanvas.tsx:125`), smaller still.
- The centre cross that marks "you start at the centre" is 1 px at 20 percent white
  (`Explore.tsx:960-961`), 1.80:1. I cannot see it.
- The "Diagram" badge (`explore.css:229-241`) is 12 px uppercase, hidden from screen readers,
  and tells me nothing. It is clutter next to a title that needs the room.
- The raw-mode notice is 12 px (`explore.css:254`). That is the message that tells me the AI
  failed and the picture may be wrong. It should be the largest text, not the smallest.
- Body text is `font-size: 18px` in px (`global.css:70`) while everything else is rem. Mixed
  units mean a root font-size change scales some text and not other text.
- Buttons are 52 px tall and meet the 48 px rule. Good. But their fill against the page is
  1.12:1, so a button is only its 2 px border and its label. The base `.gt-control` border is
  transparent (`global.css:87`), so any control without a modifier class has no visible edge.

---

## 3. Contrast table (computed from the real colours)

Background is the canvas and page colour `#0b0e0c` unless stated. Text needs 4.5:1 (AA) or 7:1
(AAA). Non-text parts that carry meaning need 3:1 (WCAG 1.4.11).

| Pair | Where | Ratio | Verdict |
|---|---|---|---|
| Stroke `#39ff88` on canvas | `Explore.tsx:970` | 14.63 | Excellent |
| Vertex label `#e8ffe8` on canvas | `Explore.tsx:1050` | 18.39 | Excellent colour, wrong size |
| Vertex dot `#e8ffe8` on green line | `Explore.tsx:1056` | 1.26 | Fail: the dot disappears into the line it sits on |
| White cursor on canvas | `Explore.tsx:1081` | 19.40 | Fine, but under my finger |
| White cursor on green line | same | 1.33 | Fail |
| Cyan guide ring `#00f0ff` on canvas | `Explore.tsx:1091` | 13.77 | Good |
| Cyan guide ring on green line | same | 1.06 | Fail: ring vanishes where it crosses a line |
| Centre cross, white 20 percent | `Explore.tsx:960` | 1.80 | Fail |
| Status text `#eafff5` on card `#121814` | `explore.css:220` | 17.25 | Excellent colour, 14 px |
| Bone `#ded6c4` on card | badges, hints | 12.45 | Good |
| Muted `#a8c5b5` on page | secondary text | 10.46 | Good |
| Muted `#a8c5b5` on surface `#141c17` | secondary text on buttons | 9.37 | Good |
| Danger text `#ff7b72` on page | errors | 7.69 | Good |
| Danger `#f85149` on page | error borders | 5.79 | OK for borders, not AAA for text |
| Copper `#c88a4b` on page | borders, settings text | 6.65 | Good for borders; below 7:1 as text |
| Copper on card `#121814` | `settings.css:177` text | 6.17 | Below the 7:1 the docs claim |
| Copper on surface | button borders | 5.95 | Good |
| Button surface `#141c17` vs page | button fill | 1.12 | Shape is invisible without its border |
| Card `#121814` vs page | status card fill | 1.08 | Shape is invisible without its border |
| `--gt-border-subtle` `#233028` | status card border (`global.css:1013`) | 1.41 | Fail |
| `--gt-border` green 22 percent | generic borders | 1.72 | Fail |
| `--gt-border-canvas` `#20202e` | canvas frame when not focused (`global.css:1049`) | about 1.2 | Fail: I cannot see where the diagram area ends |
| Stitch dim `#8c8577` | decoration | 5.30 | Fine as decoration |
| Green dim `#25a357` | accents | 5.96 | Below 7:1 if used for text |
| Copper dim `#9e6432` | accents | 3.99 | Borders only |
| Disabled control (opacity 0.55) | `global.css:126` | 5.71 | Readable, but looks almost the same as enabled |
| Dark text `#051309` on green | hover and active states | 14.35 | Excellent |
| Correct: segment `#3fb950` | `Correct.tsx:385` | 7.64 | Good |
| Correct: polyline `#2ea043` | `Correct.tsx:432` | 5.75 | OK |
| Correct: selected `#58a6ff` vs unselected `#3fb950` | `Correct.tsx:385` | 1.01 | Fail: selection is hue only |
| Specimen preview stroke, green 35 percent on card | `specimen.css:34` | 2.69 | Fail if the preview is meant to be seen |
| Green `#39ff88` on white | hypothetical light theme | 1.33 | The brand colour cannot be used on a light background |

What the table says:

1. **Text colours are honestly good.** The AAA claim holds for body text. I have no complaint
   about colour choice for words.
2. **Every overlay drawn on top of the green line fails.** Dot, cursor and guide ring are all
   light colours on a light line. On a dark canvas the fix is a dark outline around each
   marker (a 2 px `#0b0e0c` ring), which costs nothing.
3. **Containers are invisible.** Surfaces differ from the page by 1.08 to 1.12 and the subtle
   borders are 1.2 to 1.7. I find buttons by their text only. I cannot see the edge of the
   canvas, which is the edge of the touch area.
4. **The contrast test covers text pairs** (`docs/a11y-audit.md:26-28` describes 25 tests on
   text and background pairs). It does not cover non-text contrast or anything drawn in
   canvas. That is why items 2 and 3 were never caught.
5. **A light theme is not a quick win.** I do not want one (light hurts), and the brand green
   is 1.33:1 on white. If a light or outdoor mode is ever added it needs its own stroke
   colour. A better answer to classroom glare is thicker strokes and no glow.

---

## 4. Do vision and touch ever disagree? Yes, in five places

| What I see | What I feel or hear | Why |
|---|---|---|
| A 4 px line | A buzz across a 28 px band | Hit radius 14 px each side; band is not drawn |
| A 6 px dot | Corner pattern across a 44 px disc | Vertex radius 22 px; disc is not drawn |
| A letter "A" beside the corner | Nothing when I touch the letter itself, unless I am within 22 px of the dot | Label is paint, not a target |
| Four empty rectangles | "Maths, 72" spoken | Bar labels and values are never drawn |
| The same static picture | A changing stream of speech | No highlight follows the finger |

None of these is a bug in the haptics. They are missing pictures. Each one is fixed by drawing
what the engine already knows.

---

## 5. Top 10 improvements, ranked by impact against effort

Impact is for a low-vision student. Effort assumes Kiro builds it from a spec task, as the
project rules require. None of these touches the tuned haptic values, and none needs new
dependencies or a paid service. Rendering options stay in the screen layer; the profile type
and its validation are plain data and can live in `core/` without breaking the pure-core rule.

| Rank | Improvement | Impact | Effort | Depends on |
|---|---|---|---|---|
| 1 | "Show me" highlight: redraw the touched element thick and bright, with its name in large text | Very high | Small | none |
| 2 | Visual profile in Settings: stroke width, label size, glow on or off | Very high | Small to medium | none |
| 3 | Large-print label rendering: Atkinson font, scalable size, dark backing plate, kept on canvas | High | Small | 2 |
| 4 | Draw the missing text: bar labels and values, axis names | High | Small | 3 |
| 5 | Dark outline on every marker (dot, cursor, guide ring), and a visible canvas edge | Medium | Very small | none |
| 6 | Large-print caption: tap the status card to open the current message full-width in big text | High | Medium | none |
| 7 | Landscape and large-display layout: controls beside the canvas, drop the 640 px cap in landscape | Medium | Medium | none |
| 8 | Presets: "Eyes closed", "Low vision", "Observer" as one-tap profiles, remembered per device | Medium | Small | 2 |
| 9 | "What I can see" card: a short, shareable summary of my profile for my teacher | Medium | Small | 2, 8 |
| 10 | Words and docs: tagline, product.md, README and submission say what low-vision students get | Medium | Very small | 1 to 4 shipped |

How each one works, in order:

1. **Show me.** When the hit test returns an element, redraw it in `draw()`
   (`Explore.tsx:1065-1097`): a line or curve at 10 px in white with no glow; a corner as a
   22 px ring (the real touch zone) with its label in large type; a bar filled at about 35
   percent green with its label and value inside. Hold it until the finger moves on or lifts,
   not for 120 ms, and do not animate it. Blind users lose nothing; observers follow the demo.
2. **Visual profile.** One Settings section, "What you see", with large buttons, not sliders:
   line thickness 4, 8 or 12; label size 16, 28 or 40; glow on or off. It replaces the constants
   at `Explore.tsx:971`, `:973` and `:1051`. Only the picture changes, never the hit radius.
3. **Large-print labels.** Use Atkinson Hyperlegible at weight 700, a dark plate behind each
   label (the Correct editor already does this, `Correct.tsx:480-489`), placed away from the
   shape's centre and clamped inside the canvas. "Every label stays inside the canvas" is a
   natural property test for a pure placement helper.
4. **Missing text.** Bar label below and value above; axis names. Facts go in the caption.
5. **Outlines and edges.** A 2 px `#0b0e0c` outline on the dot, cursor and guide ring; a
   copper border (6.65:1) on the canvas frame and on the status card.
6. **Caption sheet.** The status card keeps its fixed height and becomes a button. Tapping it
   opens the message full-width at 2rem or more, with the last five messages and the scene's
   facts. It is real text, so Select to Speak works, and it covers the canvas without moving it.
7. **Layout.** In landscape, canvas on the left at full height and controls on the right, with
   no 640 px cap. Fix the dead rule at `global.css:1572-1576`. At narrow widths, fold Correct
   and Where am I into one "More" button so the footer stays one row.
8. **Presets.** "Eyes closed" (today), "Low vision" (extra thick, extra large, glow off,
   highlight on), "Observer". One skippable Start question: "Will you look at the screen?"
9. **"What I can see" card.** A short text of my profile for my teacher, sent by the system
   share sheet: "Rohan uses extra thick lines and 40 px labels. Keep labels short and a
   thumb-width apart." No account, no server.
10. **Words.** Only after 1 to 4 ship: a new tagline in three languages, a low-vision user and
    the principle "sight and touch must agree" in `product.md`, and one gallery slide.

**What I would not do:** add a light theme (green is 1.33:1 on white, and light hurts); change
the tuned hit radii; rely on media queries alone; add pinch-zoom inside the canvas, which would
move the diagram under a blind student's finger.

**Order:** 5, then 1 (both small, both before the Kiroween deadline, neither touches the
blind-user path), then 2 to 4 as one spec task, then 8 and 6, then 10, then 7 and 9.

## 6. Needs the owner, and what only a phone can show

- Decide: highlight on by default or only in presets; the Start question; the new tagline;
  no low-vision claim in the write-up until a low-vision person has tried it.
- Phone: does Chrome on Android report `prefers-contrast` with High contrast text on (P6)?
- Phone: display size and font size both Largest, and landscape: footer rows, canvas height,
  can the screen be scrolled (P8)? System magnifier at 3x over the canvas with tracing and the
  two-finger gestures (P9)? The 4 px glowing line under a classroom tube light?
- One low-vision student, eyes open, on the triangle: "Point to side AC."
