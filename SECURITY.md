# Security Policy

## Supported Versions

Only the latest commit on the `main` branch is actively supported with security fixes and updates.

| Branch / Version | Supported |
|---|---|
| `main` | :white_check_mark: Supported |
| Releases / Tags | :x: Unsupported (update to `main`) |

---

## Reporting a Vulnerability

We take the security and privacy of our users—especially blind and low-vision students and teachers—seriously.

If you believe you have discovered a security vulnerability in Ghost Touch:

1. **Report Privately via GitHub:** Navigate to the **Security** tab of this repository, select **Advisories**, and click **Report a vulnerability** to open a private disclosure draft.
2. **Do Not Open Public Issues:** Please do not file public GitHub issues, discussions, or pull requests for suspected security vulnerabilities or credential disclosures.
3. **Information to Include:**
   - A description of the issue and potential impact.
   - Step-by-step reproduction instructions or a minimal proof of concept.
   - Any relevant logs (with secrets and personal identifiers redacted).
4. **Response Timeline:** We acknowledge vulnerability reports within 48 hours and coordinate fixes and disclosures privately through GitHub Security Advisories.

---

## What the App Stores and Does Not Store

### What We Do Not Store
- **No User Accounts:** Ghost Touch has no login screens, passwords, usernames, or user profiles.
- **No Analytics or Trackers:** The frontend and backend include zero telemetry SDKs, analytics scripts, advertising beacons, or tracking cookies.
- **No Persistent Server-Side Database:** The backend uses no PostgreSQL, MySQL, SQLite, or Redis. It does not write camera photos, uploaded images, or voice audio recordings to disk.
- **No Audio Retention:** Voice questions use the browser's native speech recognition. Microphone audio never streams to our backend server.

### What Is Stored
- **Client-Side Saved Diagrams (Device Only):** When a student or teacher saves a diagram, it is stored exclusively in the browser's local IndexedDB (`ghost-touch` database, maximum 20 diagrams). Saved diagrams are never uploaded to the cloud or synced to our server.
- **Client-Side Settings (Device Only):** Non-identifying user preferences (language, speech rate, and feature toggles) are stored in browser `localStorage`.
- **Ephemeral Server-Side Caching (RAM Only):** To avoid burning AI quota on repeated scans, the backend caches extracted mathematical diagram coordinates (JSON only; never the original image bytes) in process memory for up to 6 hours (maximum 64 entries).
- **Ephemeral Rate-Limiting & Budget Counters (RAM Only):** Client request timestamps (60-second sliding window) and daily paid call consumption counters are stored strictly in server process memory and are wiped on process restart or Render container sleep.

---

## Summary of Security Controls

Ghost Touch enforces strict input size/type caps, in-memory rate limits, and an automatic OpenCV Raw Mode fallback that processes diagrams locally if vision APIs fail or budgets expire.
All network data flows over TLS/HTTPS, API keys are server-side only and redacted from logs, and diagrams shared via URLs decode entirely in the browser without server transmission.
