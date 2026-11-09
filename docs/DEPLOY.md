# Ghost Touch — Production Deployment Guide & Owner Checklist

This document is the definitive, step-by-step deployment guide for Ghost Touch. It covers deploying the backend to **Render** and the frontend to **Vercel**, connecting the two services with CORS and environment configuration, and verifying the deployment with curl and real device smoke tests.

---

## You must do these yourself

Because Antigravity (and CI/CD pipelines) cannot log into third-party cloud dashboards or access private account credentials, the repository owner must complete the numbered steps below directly in the Render and Vercel dashboards.

---

### Numbered Owner Checklist

#### 1. Accounts Required

Before you begin, ensure you have active accounts on:
1. **GitHub** — hosting the repository.
2. **[Render](https://render.com/)** — for hosting the FastAPI backend web service (Free Tier).
3. **[Vercel](https://vercel.com/)** — for hosting the Vite React PWA frontend (Hobby / Free Tier).
4. **[OpenAI Platform](https://platform.openai.com/)** — for `OPENAI_API_KEY` (primary provider in `render.yaml`).
5. *(Optional)* **[Google AI Studio](https://aistudio.google.com/)** — to generate your `GEMINI_API_KEY` (primary in code default, fallback after OpenAI in `render.yaml`).
6. *(Optional)* **[Nebius Token Factory](https://tokenfactory.nebius.com/)** — for `NEBIUS_API_KEY` (last fallback and bulk test runs).

---

#### 2. Step 1: Deploy Backend on Render (Blueprint)

The repository root contains `render.yaml`, an infrastructure-as-code Blueprint that configures the Python runtime, build command, start command, health check path, and all environment variables.

1. Log in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** at the top right and select **Blueprint**.
3. Connect your GitHub repository (`ghost-touch`).
4. Render detects `render.yaml` and displays the `ghost-touch-backend` service.
5. In the environment configuration screen, enter your secret API keys (marked with `sync: false`):
   - **`OPENAI_API_KEY`**: Paste your OpenAI API key from OpenAI Platform (Primary in `render.yaml`).
   - **`GEMINI_API_KEY`**: *(Optional)* Paste your Google Gemini API key from AI Studio (primary in code default, fallback after OpenAI in `render.yaml`).
   - **`NEBIUS_API_KEY`**: *(Optional)* Paste your Nebius API key. If omitted, Nebius is skipped in the fallback chain.
6. Leave all non-secret settings at their Blueprint defaults:
   - `PYTHON_VERSION`: `3.11.10`
   - `GEMINI_MODEL`: `gemini-3.5-flash-lite`
   - `GEMINI_THINKING`: `minimal`
   - `OPENAI_MODEL`: `gpt-4.1-mini`
   - `OPENAI_BASE_URL`: `https://api.openai.com/v1`
   - `NEBIUS_MODEL`: `openbmb/MiniCPM-V-4_5`
   - `NEBIUS_TEXT_MODEL`: `nvidia/Nemotron-3-Ultra-550b-a55b` (text-only, used for Ask answers)
   - `NEBIUS_BASE_URL`: `https://api.tokenfactory.nebius.com/v1`
   - `VISION_PROVIDERS`: `openai,gemini,nebius`
   - `PROVIDER_TIMEOUT_SECONDS`: `12.0`
   - `PROVIDER_RETRIES`: `1` (number of immediate retries on transient 429/5xx errors before fallback)
   - `PROVIDER_RETRY_BACKOFF_SECONDS`: `0.8` (backoff delay in seconds before retrying the same provider)
   - `SCENE_TIMEOUT_SECONDS`: `25.0`
   - `ASK_TIMEOUT_SECONDS`: `10.0`
   - `SCENE_CACHE_SIZE`: `64`
   - `SCENE_CACHE_TTL_SECONDS`: `21600`
   - `RATE_LIMIT_ASK_PER_MIN`: `40`
   - `RATE_LIMIT_SCENE_PER_MIN`: `20`
   - `RATE_LIMIT_VALIDATE_PER_MIN`: `40` (per-minute rate limit for teacher validate endpoint)
   - `SCENE_MAX_CONCURRENCY`: `2` (maximum concurrent heavy scene processing operations)
   - `SCENE_QUEUE_WAIT_SECONDS`: `6.0` (maximum queue wait time before returning HTTP 503 Retry-After)
   - `ENVIRONMENT`: `production` (when set to production, interactive /docs, /redoc, and /openapi.json are disabled)
   - `ALLOWED_ORIGINS`: `https://ghost-touch-iota.vercel.app`
7. Click **Apply**.
8. Wait for Render to complete the build (`pip install -r requirements.lock`, SEC-05) and start the service (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
9. Once live, copy your backend URL from the top of the Render service page:
   ```
   https://ghost-touch-backend-xxxx.onrender.com
   ```
   *(Note: Do **not** include a trailing slash.)*

---

#### 3. Step 2: Deploy Frontend on Vercel

The frontend is a Vite + React 19 Progressive Web App configured via `frontend/vercel.json`.

1. Log in to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`ghost-touch`).
4. Configure the project settings:
   - **Root Directory**: Click edit and select `frontend`.
   - **Framework Preset**: `Vite` (automatically detected).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Render backend URL from Step 1 (e.g., `https://ghost-touch-backend-xxxx.onrender.com`, **strictly without trailing slash**).
   - **Key**: `VITE_SITE_URL` *(Optional on initial deployment; configure in Step 3 once your production domain is established)*
   - **Value**: Your frontend URL (e.g., `https://ghost-touch-iota.vercel.app`, **strictly without trailing slash**).
6. Click **Deploy**.
7. Wait ~60 seconds for the build to complete.
8. Copy your production frontend URL:
   ```
   https://ghost-touch-iota.vercel.app
   ```
   *(or your assigned Vercel URL, e.g. `https://ghost-touch-iota.vercel.app`)*

---

#### 4. Step 3: Social Preview and Domain (`VITE_SITE_URL`)

Social crawlers (Twitter / X cards, WhatsApp, Discord, LinkedIn, Slack) require absolute URLs for OpenGraph image and canonical URL tags (`og:image`, `twitter:image`, `og:url`). Social crawlers do not execute JavaScript or install Service Workers, so these URLs must be injected into the static HTML at build time.

1. Once your frontend is deployed and you know its assigned domain (e.g. `https://ghost-touch-iota.vercel.app` or a custom production domain):
2. In the [Vercel Dashboard](https://vercel.com/dashboard), navigate to **Settings** -> **Environment Variables**.
3. Add (or edit) the variable:
   - **Key**: `VITE_SITE_URL`
   - **Value**: Your production frontend origin (e.g. `https://ghost-touch-iota.vercel.app`, **strictly without trailing slash**).
4. Redeploy the frontend (click **Deployments** -> select the latest deployment -> click `...` -> **Redeploy**) so the Vite `siteUrlPlugin` rewrites the metadata tags into absolute URLs during `transformIndexHtml`.
5. **How to test**:
   - Use an online link preview tool such as [OpenGraph.xyz](https://www.opengraph.xyz/), [Social Share Preview](https://socialsharepreview.com/), or paste your link into a Discord or Slack channel to verify the preview card displays the creature artwork, title, and description.
   - You can also verify via curl from a terminal:
     ```bash
     curl -s https://<VERCEL_URL> | grep -E "og:image|twitter:image|og:url"
     ```
     Confirm the output contains absolute URLs:
     ```html
     <meta property="og:url" content="https://<VERCEL_URL>/" />
     <meta property="og:image" content="https://<VERCEL_URL>/brand/og-image.png" />
     <meta name="twitter:image" content="https://<VERCEL_URL>/brand/og-image.png" />
     ```

---

#### 5. Step 4: Connect Frontend & Backend (`ALLOWED_ORIGINS` & Redeploy)

To allow the Vercel frontend to make cross-origin requests to the Render backend:

1. Return to the [Render Dashboard](https://dashboard.render.com/) and open `ghost-touch-backend`.
2. Navigate to **Environment**.
3. Find `ALLOWED_ORIGINS` and edit it to your production Vercel URL:
   ```
   https://ghost-touch-iota.vercel.app
   ```
   *(If you also want local development access, separate origins with a comma: `https://ghost-touch-iota.vercel.app,http://localhost:5173`. Trailing slashes and spaces are automatically sanitized by the backend.)*
4. Click **Save Changes**. Render will automatically trigger a zero-downtime redeploy.

---

#### 6. Step 5: Smoke Tests & Verification

Verify the end-to-end deployment using the following command-line and mobile checks.

##### A. Command-Line Verification (curl)

Replace `<RENDER_URL>` with your backend domain (e.g. `https://ghost-touch-backend-xxxx.onrender.com`) and `<VERCEL_URL>` with your frontend domain (e.g. `https://ghost-touch.vercel.app`).

1. **Liveness / Health Check**:
   ```bash
   curl -i https://<RENDER_URL>/api/v1/health
   ```
   **Expected Response:** HTTP 200 OK
   ```json
   {"ok": true}
   ```

2. **CORS Preflight Test (Allowed Origin)**:
   ```bash
   curl -i -X OPTIONS https://<RENDER_URL>/api/v1/health \
     -H "Origin: https://<VERCEL_URL>" \
     -H "Access-Control-Request-Method: GET"
   ```
   **Expected Response:** HTTP 200 OK with header:
   ```
   access-control-allow-origin: https://<VERCEL_URL>
   ```

3. **CORS Preflight Test (Disallowed Origin)**:
   ```bash
   curl -i -X OPTIONS https://<RENDER_URL>/api/v1/health \
     -H "Origin: https://unauthorized-domain.com" \
     -H "Access-Control-Request-Method: GET"
   ```
   **Expected Response:** HTTP 400 Bad Request (`Disallowed CORS origin`).

4. **Scene Endpoint Preflight Test**:
   ```bash
   curl -i -X OPTIONS https://<RENDER_URL>/api/v1/scene \
     -H "Origin: https://<VERCEL_URL>" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type"
   ```
   **Expected Response:** HTTP 200 OK with `access-control-allow-origin: https://<VERCEL_URL>`.

##### B. Mobile Device & Accessibility Checklist (Android Chrome over HTTPS)

> [!IMPORTANT]
> Ghost Touch must be tested on an Android device using Google Chrome over **HTTPS**. HTTPS is strictly required by modern mobile browsers for both the **Vibration API** and **Camera / getUserMedia API**.

1. **Offline Sample Diagram Exploration (No Backend Dependency)**:
   - Open your Vercel URL on an Android device in Chrome over HTTPS.
   - Tap **Start**.
   - Tap any of the built-in diagrams: **Right Triangle**, **Sine Wave**, or **Bar Chart**.
   - Confirm the diagram loads instantly without contacting the backend.
   - Touch and drag a finger across the canvas:
     - **Line Hit**: Device vibrates with short buzzes.
     - **Corner / Vertex Hit**: Device vibrates with a double-tap pattern and speaks the corner label (e.g. "Corner B").
     - **Function Graph Curve**: Audio pitch tone varies smoothly with curve y-position.

2. **Accessibility Mode 1: Testing with TalkBack OFF (Built-in Speech Synthesizer)**:
   - Ensure Android TalkBack is disabled.
   - Interact with the app: every screen transition and button press is announced aloud by the app's internal voice engine via Web Speech API.

3. **Accessibility Mode 2: Testing with TalkBack ON (Android Screen Reader)**:
   - Enable TalkBack under Android **Settings -> Accessibility -> TalkBack**.
   - Navigate buttons using swipe right and double-tap gestures.
   - Verify all controls announce descriptive `aria-label` text and meet the minimum **48×48 CSS px** accessible touch target size.
   - Enter the **Explore screen**: because TalkBack consumes single-finger touch gestures for screen navigation, explore using TalkBack's **pass-through gesture: double-tap, hold down on the second tap, then drag**. The engine fires a 25 ms centre tick and tracks the cursor relative to hold position, generating continuous vibration and theremin pitch (unverified on physical hardware).

4. **Live Diagram Photo Extraction**:
   - On the Capture screen, tap **Take Photo** or upload a photo of a printed textbook diagram (e.g., triangle or function graph).
   - Hear spoken status: *"Analyzing diagram..."*.
   - Verify the diagram is returned and rendered within 15 seconds:
     - Clear diagrams load in AI Mode (`mode: "ai"`).
     - Heavy clutter or complex handwriting automatically and gracefully falls back to OpenCV Raw Mode (`mode: "raw"`).

5. **Feature Flagged & Optional Features (Unverified on Hardware)**:
   - **Guide My Finger (`VITE_FEATURE_GUIDE=1`):** Directional haptic pulses and stereo pan (default OFF; unverified on hardware).
   - **Teacher Verify & Share (`VITE_FEATURE_SHARE=1`):** URL fragment compression (`#s=...`) and QR code sharing at `#/teach` (default OFF; unverified on hardware).

---

#### 6. Step 5: Render Free-Tier Cold Starts & Demo Preparation

Render free-tier web services automatically spin down into a sleep state after **15 minutes of inactivity**. When a service is sleeping, the first incoming HTTP request wakes the container, taking **30 to 60 seconds (up to 70 seconds under heavy load)** to boot the Python environment, load OpenCV, and serve traffic.

> [!WARNING]
> **Pre-Demo Protocol:**
> Exactly 5 minutes before recording a demonstration video, presenting to judges, or performing a live test, send a warm-up request to the backend health endpoint:
> ```bash
> curl https://<RENDER_URL>/api/v1/health
> ```
> Once it responds `{"ok": true}`, the container is active and warmed up. Subsequent photo extraction and question-answering requests will execute with full performance (~3 to 8 seconds).

---

#### 7. Known Limits, Privacy & Open Items

- **Hardware Verification Pending:** TalkBack pass-through gesture, tactile motor strength, and stereo panning are unverified on physical hardware (`docs/OWNER_CHECKLIST.md`).
- **Feature Flags:** "Guide my finger" and "Teacher verify & share" are flagged OFF by default until physical device verification.
- **Security & Bug Audits Ongoing:** No claims of "bug free" or "secure" software. Round 2 items CORE-09 (pointer capture) and NEEDS-KIRO-02 (tone sequencing) were resolved by Kiro in Round 3.
- **Spec Ghost (`frontend/src/core/verify.ts`):** Client-side geometric consistency check between printed facts and drawing, wired into Explore and Ask announcements by lane k1; parse rate is ~35% on sample and research scenes (21 of 60, measured on the sample set).
- **Privacy Architecture:** All diagram processing is stateless in RAM; images are never written to server disk. See [docs/PRIVACY.md](docs/PRIVACY.md) for full verified data flow.
- **Language Review:** Hindi and Gujarati translations are machine-translated and pending educator review.

---

#### 8. Step 6: Rollback Procedures

If an issue occurs in production, use the following zero-downtime rollback procedures:

##### Frontend Rollback (Vercel)
1. Go to the project overview in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click the **Deployments** tab.
3. Locate the previous known-good deployment.
4. Click the three dots menu (**...**) on that deployment and choose **Promote to Production**.
5. Traffic shifts immediately (zero downtime).

##### Backend Rollback (Render)
1. Go to `ghost-touch-backend` in the [Render Dashboard](https://dashboard.render.com/).
2. Click the **Deploys** tab.
3. Locate the previous successful deploy.
4. Click the deploy entry and click **Rollback to this deploy**.

---

#### 9. Step 7: Before You Submit Checklist

Before submitting to hackathons, competitions (e.g. Kiroween / STEMergent), or production launch:

- [ ] **Public Repository**: Ensure the GitHub repository visibility is set to **Public**.
- [ ] **MIT License Visible**: Verify `LICENSE` is present in the repository root and rendered on GitHub.
- [ ] **`.kiro` Directory Committed**: Verify `.kiro/` is committed to git (required for Kiroween evaluation).
- [ ] **Zero Secrets Committed**:
  - Run `git status` to ensure `.env` and `.env.local` files are untracked and ignored by `.gitignore`.
  - Ensure only `.env.example` templates with safe placeholders are committed.
  - No secret keys (e.g. `AIza...`, `sk-...`, `nvapi-...`) exist in repository files.
- [ ] **CI Passing**: Verify all GitHub Actions workflow checks pass cleanly.
- [ ] **PWA & HTTPS**: Verify the frontend is accessed over HTTPS (required for Android Vibration API and camera access).
