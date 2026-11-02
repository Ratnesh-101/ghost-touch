# Ghost Touch — Deployment Guide

This guide describes how to deploy the Ghost Touch backend on **Render** and the frontend on **Vercel** in a few clicks, without committing any secrets to the repository.

---

## 1. Architecture Overview

```
                         +-----------------------+
                         |   Vercel (Frontend)   |
                         |  React 18 + Vite PWA  |
                         +-----------+-----------+
                                     |
               HTTPS /api/v1/scene   |   VITE_API_URL
               (CORS: ALLOWED_ORIGINS)
                                     v
                         +-----------------------+
                         |    Render (Backend)   |
                         |  FastAPI + Python 3.11|
                         +-----------+-----------+
                                     |
                         +-----------+-----------+
                         | Vision Providers      |
                         | - Gemini 3.8 Flash    |
                         | - OpenAI (fallback 1) |
                         | - Nebius (fallback 2) |
                         | - OpenCV (Raw Mode)   |
                         +-----------------------+
```

- **Frontend**: Hosted on Vercel. Fast CDN delivery of Vite PWA assets, client-side offline samples (`triangle.json`, `sine.json`, `barchart.json`), and Service Worker.
- **Backend**: Hosted on Render Free Web Service. Python 3.11 with FastAPI, OpenCV headless for Raw Mode edge detection, and provider chain.
- **Cost**: $0 / free tier on both platforms.

---

## 2. Prerequisites

1. GitHub repository containing the Ghost Touch codebase.
2. A [Render](https://render.com) account connected to GitHub.
3. A [Vercel](https://vercel.com) account connected to GitHub.
4. Google Gemini API key from [Google AI Studio](https://aistudio.google.com/).
5. (Optional) OpenAI API key from the [OpenAI platform](https://platform.openai.com/) for the first fallback after Gemini.
6. (Optional) Nebius API key from [Nebius Token Factory](https://tokenfactory.nebius.com) for the last fallback (`NEBIUS_API_KEY`). Optional `NEBIUS_MODEL` and `NEBIUS_BASE_URL` default to `openbmb/MiniCPM-V-4_5` and `https://api.tokenfactory.nebius.com/v1`. NVIDIA is no longer in the default chain.

---

## 3. Step 1: Deploy Backend on Render (Blueprint)

The repository root includes a `render.yaml` Blueprint file specifying the service, build/start commands, Python version, and environment configuration.

1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Render detects `render.yaml` and displays the `ghost-touch-backend` service.
5. In the environment variables section, fill in the values marked `sync: false`:
   - `GEMINI_API_KEY`: Paste your Google Gemini API key.
   - `OPENAI_API_KEY`: (Optional) Paste your OpenAI API key. It is used only when Gemini fails.
   - `NEBIUS_API_KEY`: (Optional) Paste your Nebius API key from https://tokenfactory.nebius.com for the last fallback.
   - `NVIDIA_API_KEY`: (Optional) Leave blank; NVIDIA is no longer in the default chain. Providers without a key are skipped; with none working the app falls back to OpenCV Raw Mode.
6. Leave other environment variables at their Blueprint defaults:
   - `PYTHON_VERSION`: `3.11.10`
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `GEMINI_THINKING`: `minimal`
   - `OPENAI_MODEL`: `gpt-4.1-mini`
   - `NEBIUS_MODEL`: `openbmb/MiniCPM-V-4_5` (optional `NEBIUS_BASE_URL` defaults to `https://api.tokenfactory.nebius.com/v1`)
   - `VISION_PROVIDERS`: `gemini,openai,nebius` (the order of fallback: Gemini, then OpenAI, then Nebius as last fallback; NVIDIA is no longer in the default chain)
   - `PROVIDER_TIMEOUT_SECONDS`: `8.0`
   - `SCENE_TIMEOUT_SECONDS`: `15.0`
   - `SCENE_CACHE_SIZE`: `64` (default 64, 0 disables)
   - `SCENE_CACHE_TTL_SECONDS`: `21600` (default 21600)
   - `RATE_LIMIT_ASK_PER_MIN`: `40` (default 40)
   - `RATE_LIMIT_SCENE_PER_MIN`: `20` (default 20)
   - `ALLOWED_ORIGINS`: temporary placeholder (you will update this in Step 3).
7. Click **Apply**.
8. Wait for Render to complete the build (`pip install .`) and start Uvicorn (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
9. Copy your backend service URL:
   `https://ghost-touch-backend-xxxx.onrender.com`

---

## 4. Step 2: Deploy Frontend on Vercel

The frontend includes `frontend/vercel.json` configuring Vite, SPA fallback routing, and stale-cache prevention for the PWA Service Worker.

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. In the project setup screen:
   - **Root Directory**: Click edit and select `frontend`.
   - **Framework Preset**: Vite (detected automatically).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your Render backend URL from Step 1 (e.g., `https://ghost-touch-backend-xxxx.onrender.com`, **no trailing slash**).
6. Click **Deploy**.
7. Once deployed, copy your production frontend URL:
   `https://ghost-touch.vercel.app` (or your assigned Vercel URL).

---

## 5. Step 3: Configure CORS (`ALLOWED_ORIGINS`)

To allow the frontend to call the backend:

1. Return to the [Render Dashboard](https://dashboard.render.com/) and open the `ghost-touch-backend` service.
2. Go to **Environment**.
3. Find `ALLOWED_ORIGINS` and edit it to match your Vercel URL:
   ```
   https://ghost-touch.vercel.app
   ```
   *(Multiple origins can be comma-separated if you also test locally: `https://ghost-touch.vercel.app,http://localhost:5173`)*
4. Click **Save Changes**. Render will automatically redeploy the service.

---

## 6. Smoke Tests

Run these three verification tests after deployment:

### Test 1: Backend Health Check
Open the backend liveness probe in your browser:
```
https://<your-render-url>/api/v1/health
```
**Expected response:**
```json
{"ok": true}
```

### Test 2: Offline Sample Diagram Exploration
1. Open the Vercel frontend URL on an Android phone using Chrome over HTTPS (or on desktop).
2. Tap **Start**.
3. Select any built-in sample diagram (e.g. *Right Triangle*, *Sine Wave*, or *Bar Chart*).
4. Verify the diagram loads without making any network request to the backend.
5. Drag your finger across the lines:
   - Line hits produce vibration buzz.
   - Corners/vertices produce the double-tap pattern and speak the corner label (e.g. "Corner B").
   - Function graphs play pitch tones corresponding to y-height.

### Test 3: Real Photo End-to-End Pipeline
1. On the Capture screen, tap **Take Photo** or upload a photo of a textbook triangle or graph.
2. Observe status announcement ("Analyzing diagram...").
3. Verify the backend processes the image within 15 seconds:
   - Returns AI-extracted diagram scene (`mode: "ai"`), or
   - Falls back gracefully to OpenCV Raw Mode outlines (`mode: "raw"`) if handwriting/clutter is detected.
4. Verify the extracted diagram can be explored tactilely.

---

## 7. Render Free-Tier Cold Starts & Demo Preparation

Render's free tier spins down web services after 15 minutes of inactivity. When spun down, the first incoming request takes **50–70 seconds** to boot the container.

> [!IMPORTANT]
> **Pre-Demo Protocol:**
> 5 minutes before demoing, recording a video, or presenting to judges, send a warm-up request to the health endpoint:
> ```bash
> curl https://<your-render-url>/api/v1/health
> ```
> Once it responds `{"ok": true}`, the container is active and subsequent photo processing requests will respond with low latency (~3–8 seconds).

---

## 8. Rollback Procedures

### Frontend Rollback (Vercel)
1. Go to the project in the Vercel dashboard.
2. Navigate to the **Deployments** tab.
3. Find the last known working deployment.
4. Click the three dots menu (**...**) -> **Promote to Production**.
5. Traffic shifts instantly (0 downtime).

### Backend Rollback (Render)
1. Go to `ghost-touch-backend` in the Render dashboard.
2. Navigate to the **Deploys** tab.
3. Locate the previous successful deploy.
4. Click **Rollback to this deploy**.

---

## 9. Before You Submit Checklist

Before submitting to STEMergent or Kiroween:

- [ ] **Public Repository**: Ensure the GitHub repository visibility is set to **Public**.
- [ ] **MIT License Visible**: Verify `LICENSE` is present in the repository root and visible on GitHub.
- [ ] **`.kiro` Directory Committed**: Verify `.kiro/` is tracked and committed in git (Kiroween disqualification risk if missing).
- [ ] **Zero Secrets in Repository**:
  - Run `git grep -i "AIza"` or check git history.
  - Ensure `.env` is ignored by `.gitignore`.
  - Only `.env.example` is committed with placeholder values.
- [ ] **CI Passing**: Verify `.github/workflows/ci.yml` is green on GitHub Actions for both frontend and backend jobs.
- [ ] **PWA & HTTPS**: Verify the frontend is accessed over HTTPS (required for the Vibration API and camera access on Android).

---

## 10. TalkBack & Accessibility Testing Guide

Ghost Touch is designed so blind and low-vision students can navigate without sighted assistance. Judges can evaluate accessibility in two ways:

### Testing with TalkBack OFF
1. The app features a built-in voice synthesizer via the browser SpeechSynthesis API.
2. Every button press, screen transition, and corner encounter is automatically spoken out loud.
3. This mode is ideal for seeing how the tactile exploration, audio theremin, and spoken corner alerts work seamlessly together.

### Testing with TalkBack ON (Android Screen Reader)
1. Enable TalkBack under Android Settings -> Accessibility -> TalkBack.
2. Use standard TalkBack gestures (swipe right to navigate elements, double-tap to activate).
3. All interactive controls have accessible labels (`aria-label`) and meet the **48x48 CSS px** minimum target size requirement.
4. When entering the **Explore screen**, the canvas uses `touch-action: none` and continuous pointer capture. To trace diagram lines with TalkBack active, drag a single finger across the canvas area; the app captures pointer movement and outputs vibration and theremin pitch tones directly.
