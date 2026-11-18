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

HOW TO REPORT (please paste this back, filled in; add screenshots or a short screen recording with sound for anything that failed)
Device: ____ Android ____ Chrome ____ Vibration strength ____ Date ____ Tester ____
Part A: clarity of first sentence (1-5) ____; overview too long? ____; corners felt? ____; edge directions helpful? ____; lift stops speech? ____
Part B (for each cue: useful 1-5 / annoying 1-5 / bug): Directions ____ Finding sound ____ Graph scan ____ Heartbeat ____ (best #/debug pattern ____) Stay on line ____ Speech detail ____ Page edge ____ Presets ____ (best for a first-time student ____) Hold still ____
Part C: triangle times Simple ____ s, Standard ____ s, Explorer ____ s; sine peaks counted ____ (real answer ____); bars counted ____; tallest ____; Ask answers ____; command vs question ____
Part D: photo time ____ s; AI or Raw Mode ____; reason spoken ____; trace accurate? ____
Part E: rotation ____; background ____; airplane ____; home-screen app ____; TalkBack ____
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
