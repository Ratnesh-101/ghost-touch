# Ghost Touch: real-phone test brief for a teammate

Copy everything inside the box below and send it to the person who will test. It works as a message to a human tester, and it also works if they paste it into an AI assistant to help them run the session and write up the results.

```text
You are helping me phone-test "Ghost Touch" on a REAL Android phone. Ghost Touch is a web app (a PWA) for blind and low-vision students: you drag one finger over a diagram on the screen, and the phone vibrates on lines, buzzes and speaks at corners, and plays a tone that rises with a graph's height. Nothing in the last few days of work has been tried on a real phone by anyone, so your honest results matter more than anything else. Please do NOT try to be nice: tell me what is confusing, annoying, too loud, too long or broken.

WHAT YOU NEED
- An Android phone with Chrome (a mid-range or cheap phone is ideal; a flagship is fine too). Vibration must be on: Settings > Sound and vibration > Vibration strength at medium or high; do-not-disturb OFF.
- Headphones are optional. Test once on the phone speaker, then once with one earbud if you can.
- A stopwatch (the phone's other clock app) and a sighted helper if you test with your eyes closed.
- About 45 minutes. Charge above 50 percent. Stop if the phone gets hot.
- If possible, one blind or low-vision person to try it too (only with their consent; ask them what they felt, do not coach them). Do not photograph people, and do not use any real student data.

LINKS
- App: https://ghost-touch-iota.vercel.app (open it in Chrome on the phone)
- Backend wake-up (the free server sleeps): open https://ghost-touch-api.onrender.com/api/v1/health first and wait until it shows {"ok": true}, up to 60 seconds. Do this before testing.

RECORD FIRST (for the report): phone make and model, Android version, Chrome version, vibration strength setting, battery %, date and time, whether you installed the app to the home screen, TalkBack on or off for each part.

PART A: FIRST 5 MINUTES (as a new user)
1. Open the app. Tap "Wake the creature". Was the first spoken sentence clear? Did anything speak too much or not at all? (Rate clarity 1-5.)
2. Is a language chooser offered on first run? Pick English, then later repeat the key steps in Hindi and in Gujarati.
3. Choose the Triangle sample. Listen to the spoken overview: does it tell you how many corners there are and roughly where they are? Is it too long (over about 10 seconds)? 
4. Eyes closed (or looking away), drag one finger slowly over the screen. Can you tell when you are ON a line (buzz) and when you are OFF it (silence)? Can you tell when you hit a corner (a double buzz and a spoken label like "A")?
5. After a corner, does the app tell you which way the edges go (for example "down-right to B, down to C")? Is that helpful, too slow or too wordy?
6. Lift your finger in the middle of a spoken sentence: does the speech stop within about half a second? (It should.) Touch again quickly: does it carry on correctly?

PART B: THE NEW CUES. Open Settings (the gear or the Settings button) and test each switch OFF and ON. For each: what you felt or heard, whether it helped, whether it annoyed you, and any bug. Rate usefulness 1-5 and annoyance 1-5.
1. Directions (spoken compass at corners and line names when you rest on a line): rest your finger still on a side of the triangle for about a second. Does it say the side's name and its two directions? Does it fire while you are still moving (it should not)?
2. Finding sound (a soft click when you are close to a line but not on it, faster as you get closer): drift a finger off a line by a finger-width. Can you tell which way to go to find the line again? Is the click too loud next to the buzz? Test on the phone speaker and with one earbud.
3. Graph scan: open the Sine sample. Sweep slowly left to right across the curve. Does the tone rise and fall with the curve? Can you count the peaks by sound alone? Does the tone ever sound wrong when you are on a point or a corner?
4. Corner heartbeat (OFF by default; turn it ON in Settings; it may be listed as Corner heartbeat): rest your finger on a corner of the triangle. Do you feel a slow repeating "lub-dub" while you rest, and does it stop the moment you move off the corner? Is it distinguishable from the line buzz? Is it comfortable or annoying after 10 seconds? Also try the heartbeat candidates on the hidden test page: add #/debug to the end of the app address (https://ghost-touch-iota.vercel.app/#/debug) and tell me which pattern feels most like a heartbeat.
5. Stay on line (OFF by default; turn it ON): trace a side of the triangle. Does the buzz stay with you if your finger drifts a little off the line (a "sticky" line)? Is that helpful, or does it make it hard to leave the line? Turn it OFF again when done.
6. Speech detail (Short or Full), page-edge cue (what happens when your finger goes off the diagram edge: one short spoken sentence, no sound, no repeats?), and presets (Simple, Standard, Explorer): try each preset. Which one would you give a first-time student?
7. Hold still on a line for 3 seconds: does the line buzz keep going while you do not move (it should)? Hold still in empty space: does it speak where you are after about a second?

PART C: TASKS WITH THE STOPWATCH (eyes closed, helper times it)
1. Trace the whole triangle once, start to finish, and say "done" when you think you have been round every side and every corner. Time it. Do this three times: with the Settings on Simple (cues off), with Standard, and with Explorer. Write the three times and which felt easiest.
2. Sine sample: say how many peaks you counted by touch and sound. 
3. Bar chart sample: say how many bars there are and which is tallest, using only touch and sound. Does a bar's value get spoken when you rest on it? Does it get cut off, for example "Q1, 2024" read as "Q1"?
4. Ask (the Ask button, or two-finger long press): ask "How long is AB?" in English, then a question in Hindi or Gujarati. Does it answer in a short sentence? Ask "What colour is it?": it should say "I don't know from this diagram."
5. Say a command: for example "describe", "where am I", "repeat". Then ask a longer real question that contains a command word, for example "where is the top of the curve". It should go to Ask, not run a command.

PART D: A REAL PHOTO
1. Take a photo of a real textbook diagram (a triangle, a graph, a bar chart) with "Take photo". Does it say "Reading your diagram" and play a soft tone while waiting? How long did it take? Does the app tell you whether the AI result or the rougher Raw Mode outline was used, and why? Trace it: are the lines where they should be?
2. Take a messy photo (clutter, a table, a face-free wall). The app should not crash; Raw Mode should give some outlines.

PART E: THINGS THAT SHOULD NOT BREAK
- Rotate the phone while holding a finger on the diagram. Does the canvas jump or resize? (It must stay put.)
- Press the phone's home button during a vibration or speech, then come back: does anything keep vibrating or talking? 
- Switch to airplane mode: do the samples still work? Does a new photo give a clear spoken message instead of silence?
- Install the app to the home screen (Chrome menu > Add to Home screen) and open it from there. Anything different?
- Turn TalkBack ON and explore a sample (double tap, hold and drag): does TalkBack read extra text over the cues, or does anything get stuck? Note exactly what you did.
- Only if there is a Teacher or Share option visible: open it and tell me what it shows; do not test shared links unless I ask.

PART F: NEWEST FEATURES (added 2026-11-22; NOTHING here has been tried on a real phone by anyone, so expect problems). Do each with TalkBack OFF; if you use TalkBack, repeat the marked rows with it ON (double-tap-and-hold, then drag) and say so. For each row write pass / fail / notes. If you have no TalkBack, write "no TalkBack" and skip the ON rows.
F1. Highlight (on by default, no switch). Open the Triangle. Hold a finger on a side: that side should look thicker and brighter. On a corner: a bigger bright dot. On a bar (Bar chart sample): a thicker, brighter outline. Check indoors and then outdoors in daylight. FAIL: nothing changes, wrong element, it flashes, it stays lit after you lift, or you cannot see it outdoors. Write the colour and how thick it looks. Also check the buzz, tones and speech feel exactly as in Part A (the highlight must add none). Result: ____
F2. Help button. Find "Help" under the drawing (about finger-sized). Tap it with no finger on the drawing: it should speak how to touch, go Back and Ask, once, and show the same text. Then rest one finger on the middle of a triangle side, tap Help with a SECOND finger and lift the second finger: Help should speak exactly once, the first finger should keep buzzing and keep exploring, and the highlight should stay. Do the same with the "Where am I" button. FAIL: no speech, it speaks twice, the buzz stops, the highlight clears, the second finger takes over. Also press down on Help and slide off before lifting: nothing should speak. TalkBack ON: focus Help and double-tap, it should speak once. Result: ____
F3. Help on a rough photo. Take a messy photo so the app says it could only read rough outlines (Raw Mode). Press Help and read the card on screen. The last sentence says the outlines are rough; it must be fully visible or scrollable. The drawing and buttons must not move when the help text appears. Repeat in Hindi and Gujarati. Result: ____
F4. Landscape. Rotate to landscape on the Triangle without scrolling. Every footer button (Back, Where am I, Ask, Help, and Correct or Guide me if on) should be fully on screen and finger-sized, and the drawing should still be usable. Hold a finger on the drawing and rotate: the drawing must not keep growing. Result: ____
F5. Walk me through (Planchette). Open the Triangle and press "Walk me through". You should hear a short opening and a prompt for the first part to find (for example a side), with no number yet. Touch a wrong spot: no step sentence. Reach the right part: its sentence is spoken once. Say "next step" (then try the on-screen next control) for each step: it must not skip a step you have not reached, and the numbers must match the lengths on the diagram. After the last step, "next step" gives a "Your turn" prompt with no number in it: rest on a wrong side for about a second, then another wrong one: after the second wrong rest it should tell you the answer once and guide your finger; sliding quickly past things counts as nothing; touching the right part ends it with a success line. FAIL: any step spoken without reaching it, an answer given too early, it tells you that you are "correct" or "verified", voice phrase not recognised (write what you said). Result: ____
F6. Walk details. (a) Start a step, then lift your finger immediately: the step sentence should finish (a plain corner label is still cut on lift, as in Part A). (b) Say "stop": one short spoken line, nothing keeps speaking. (c) Say "repeat" at a prompt: it is spoken again. (d) Say the long sentence "can you walk me through the proof of this triangle": it must go to Ask, not start a walk. (e) Leave a started walk alone for about two minutes: it should end quietly. (f) Trace the triangle during a walk: buzz and corner pulses must be the same as without a walk. Result: ____
F7. Bar chart walk. Start the walk on the Bar chart sample: the steps name the tallest and the shortest bar and the difference (highest minus lowest). The numbers must match the values you hear when you rest on each bar normally. Result: ____
F8. Where no walk should be offered. Open the Sine wave sample and look for "Walk me through"; say "walk me through". Also try on the rough photo from F3. The request is: no walk on a rough photo, and none on the sine sample. NOTE: the written design (design.md, P170) actually expects a short curve walk on the sine sample, so just write exactly what happened on the sine (no button, or a button and what the steps said). A walk on a rough photo is a FAIL. Result: ____
F9. Make my own graph (Ghost Hand). On the first screen open "Make my own graph". You should see two sliders (x and y), Pin, Undo, "Stitch in order", Feel and Hand in; Feel and Hand in are disabled until you pin something. TalkBack ON: swipe to each slider and change it; it should read like "x 3" and "y 5" and move one whole step at a time (x 0 to 6, y 0 to 8). Set x 2, y 5 and press Pin: it should speak the new point and "x 2 y 5". Press Pin again without moving the sliders: nothing is added and it says the spot is taken. Pin (0,1), (1,3), (2,5). Undo removes exactly one pin and says which. Press "Stitch in order": the pins are joined left to right (two lines for three pins), and one Undo removes the whole stitch. FAIL: a slider without a name or that jumps, wrong coordinates, two pins on one spot, wrong order of lines. Result: ____
F10. Feel your graph. Press Feel: the normal diagram screen should open on your graph. Touch each pin: you should feel the corner double pulse and hear "x 1 y 3" style labels; between stitched pins you feel the line buzz. There is no rising or falling tone for slope. Press Back: you return to the sliders with every pin still there; press Back again: it should ask before leaving. Make a 3-4-5 triangle of pins: no "Walk me through" and no "facts and drawing disagree" sentence should appear. FAIL: a pin missing or at the wrong place, pins lost on the first Back, a walk or disagreement sentence. Say if neighbouring pins feel too close together on this phone. Result: ____
F11. Hand in. Needs the sharing feature (the site must be built with VITE_FEATURE_SHARE=1 and Teacher tools turned ON in Settings). FIRST open one existing share link on this phone to prove sharing works on this build; if it does not open, write "share not on this build" and skip this row. Then press Hand in: you should get a link and a text list such as "A: x 0 y 1", one line per pin in order; both must say the work is not checked, and must not say "verified", "correct" or "approved". Open the link in a new tab: the same pins and lines should open in Explore. With no pins, Hand in and Feel are disabled and say why. Result: ____
F12. Compact footer at 360 px width. In portrait at about 360 CSS px wide (if your phone is wider, set Android Display size to the largest, or say your real width), open the Triangle in English, then Hindi, then Gujarati (Settings), and then press Help in each. Every footer button should be fully visible, readable, finger-sized, and not touching its neighbour; no label may be cut off; the drawing and the card must not change size when Help text appears (a long Help text should scroll inside the card). TalkBack ON: swipe through every footer button; each has a name and none is skipped. FAIL: clipped text, a button off screen, a button without a name, a tiny drawing. Hindi and Gujarati wording is machine-translated and not reviewed by native speakers: tell me anything that sounds wrong. Set the language back to English at the end. Result: ____

HOW TO REPORT (please paste this back, filled in; add screenshots or a short screen recording with sound for anything that failed)
Device: ____ Android ____ Chrome ____ Vibration strength ____ Date ____ Tester ____
Part A: clarity of first sentence (1-5) ____; overview too long? ____; corners felt? ____; edge directions helpful? ____; lift stops speech? ____
Part B (for each cue: useful 1-5 / annoying 1-5 / bug): Directions ____ Finding sound ____ Graph scan ____ Heartbeat ____ (best #/debug pattern ____) Stay on line ____ Speech detail ____ Page edge ____ Presets ____ (best for a first-time student ____) Hold still ____
Part C: triangle times Simple ____ s, Standard ____ s, Explorer ____ s; sine peaks counted ____ (real answer ____); bars counted ____; tallest ____; Ask answers ____; command vs question ____
Part D: photo time ____ s; AI or Raw Mode ____; reason spoken ____; trace accurate? ____
Part E: rotation ____; background ____; airplane ____; home-screen app ____; TalkBack ____
Part F (pass / fail / notes each): F1 highlight (colour, thickness, indoors, outdoors) ____; F2 Help incl. second-finger tap ____; F3 Help on rough photo ____; F4 landscape footer ____; F5 Walk me through ____; F6 walk lift / stop / repeat / question / idle ____; F7 bar chart walk ____; F8 no walk on rough photo, what happened on sine ____; F9 Make my own graph (sliders, Pin, Undo, Stitch) ____; F10 Feel, touch a pin, Back keeps pins ____; F11 Hand in link (share on this build? yes / no) ____; F12 footer at 360 px in English / Hindi / Gujarati ____; TalkBack used for Part F? ____
Top 3 things that were confusing or annoying: ____
Top 3 things that worked well: ____
Anything that crashed, froze, got hot, or drained the battery: ____
Would a blind student use this on their own after 5 minutes of explanation? ____ Why/why not: ____

SAFETY AND HONESTY RULES
- Report what you felt, not what you think I want to hear.
- If anything keeps vibrating or speaking after you stop touching, tell me exactly what you did and stop the test.
- Never include real names, faces, addresses or student data in photos or notes.
```

## Notes for the owner

- The existing 20-minute checklist `docs/PHONE_TEST.md` covers install, TalkBack, PDF upload, saved diagrams and teacher share in more detail. This brief adds the cues that landed on 2026-11-16 to 2026-11-18 (Directions, Finding sound, Graph scan, Corner heartbeat, Stay on line, speech detail, page edge, presets, commands vs questions).
- Corner heartbeat and Stay on line are OFF by default and phone-untested, so a bad result there changes nothing for the demo.
- Ask the tester to send the filled-in report and any recordings back to you; paste the report into `docs/PHONE_TEST.md` results (or tell me and I will log it in BUILD_LOG and update the README wording).
