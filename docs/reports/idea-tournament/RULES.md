# Idea tournament rules (shared by every agent)

Project: Ghost Touch, a PWA that lets blind and low-vision students feel STEM diagrams on an ordinary Android phone (vibration on lines, corner pulses, speech, theremin tone for graphs, voice Ask, Raw Mode fallback, Teacher correction, Guide, Share, Hindi/Gujarati). Read first: CLAUDE.md, .kiro/steering/product.md, tech.md, README.md, docs/reports/fable-project-improvement-report.md (what exists, what was rejected or deferred), docs/BUILD_LOG.md tail.

Goal of the tournament: ONE new feature for Kiroween (Dec 5, 2026), judged on creativity, usefulness to blind and low-vision students, and fit with the Frankenstein theme (nerves = vibration, eyes = vision AI, voice = synthesis). The owner says there is no time limit, so ambition is allowed, but the feature must be buildable by Kiro and agy agents in this repo, with the stack as it is (React + Vite + TS strict, FastAPI, Gemini/OpenAI/Nebius vision providers, web APIs on Android Chrome only: vibration, WebAudio, SpeechSynthesis, SpeechRecognition, camera). No paid services, no iOS, no new hardware.

Hard constraints: never change the tuned haptic values; accessibility is the product (usable eyes-closed, spoken state changes, 48 px targets); pure core (no browser APIs in frontend/src/core); honest claims only (nothing is tested on a real phone unless a doc says so); Kiro writes specs and property tests, agy builds screens.

Do NOT edit any file outside docs/reports/idea-tournament/. Do not run git commands that change anything. Write your output to the file named in your task, in plain Markdown, concise but complete, no filler.
