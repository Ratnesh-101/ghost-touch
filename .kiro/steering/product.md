# Product: Ghost Touch

## One-liner
Ghost Touch lets blind and low-vision students *feel* STEM diagrams on an ordinary Android phone: photograph a textbook diagram, then trace it with a finger — the phone vibrates on lines, pulses at corners, speaks labels, and plays a theremin tone that rises with a graph's curve.

## The Frankenstein
We stitched together three parts that were never meant to meet:
- **Nerves:** the phone's notification vibration motor (the cheapest part in the phone)
- **Eyes:** a vision LLM that turns a photo into structured diagram data
- **Voice:** a browser synthesizer (theremin tone) + speech

## Users
- **Primary:** blind / low-vision students (school and college) studying math and science in India.
- **Secondary:** teachers and parents who photograph diagrams and correct the AI's reading.

## Problem
Diagrams are central to STEM but inaccessible without tactile graphics, which are slow and expensive to produce. Most blind students already own a basic Android phone.

## Principles (follow in every feature)
1. **Non-visual first.** Every screen must be fully usable with eyes closed: TalkBack-compatible, large touch targets, spoken feedback for every state change. Visual UI is secondary.
2. **Never silent failure.** If the AI cannot read a diagram, fall back to Raw Mode (vibrate on detected edges) and say so out loud.
3. **Haptics must stay distinct.** A line buzz, a corner pulse, and a label must never blur together.
4. **Works on budget phones.** Target Chrome on Android, mid-range and budget hardware. No feature may require a flagship phone.
5. **Halloween lives in the creature, never the user.** Theme the *story* (we built a creature from spare phone parts) and the visuals (dark UI, glowing green lines, theremin). Blindness is never the spooky element.

## Hackathons
- **STEMergent Hacks 2026** — MVP due Nov 16, 9:00 am IST (Hackathon Pathway).
- **Kiroween 2026, Frankenstein category** — polished version due Dec 5, 3:30 am IST. Also targeting Best Student Project, Best Demo, Blog, and Social Blitz.

## Out of scope (for now)
- iOS (no Web Vibration API in Safari).
- Handwritten diagram recognition from notebooks.
- Full braille output.
