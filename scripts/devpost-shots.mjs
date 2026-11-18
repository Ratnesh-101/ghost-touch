// Devpost gallery generator for Ghost Touch.
//
// Captures real phone screenshots of the production build (Pixel 7 emulation) and composes them
// into 2400x1600 gallery images. Tooling only: no app source is changed or imported.
//
// Usage (from the repo root):
//   cd frontend && npm run build && npx vite preview --port 4180 --strictPort     # terminal 1
//   (optional, for the Raw Mode shot) cd backend && set provider keys empty, then
//     .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001                  # terminal 2
//   node scripts/devpost-shots.mjs [--only=03,05]
//
// Environment: GT_BASE (default http://localhost:4180), GT_LIVE_API (default the Render backend),
// GT_RAW_API (default http://localhost:8001, a local backend with no AI keys so every upload takes
// the real OpenCV Raw Mode path). Real calls to the live backend are counted and capped at 3.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'frontend', 'package.json'));
const { chromium, devices } = require('@playwright/test');

const OUT = path.join(ROOT, 'docs', 'media', 'devpost');
const PHONE_DIR = path.join(os.tmpdir(), 'ghost-touch-phone-shots');
const BASE = process.env.GT_BASE || 'http://localhost:4180';
const LIVE_API = process.env.GT_LIVE_API || 'https://ghost-touch-api.onrender.com';
const RAW_API = process.env.GT_RAW_API || 'http://localhost:8001';
const MAX_LIVE_CALLS = 3;
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (n) => only.length === 0 || only.includes(n);

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PHONE_DIR, { recursive: true });

const FONT_DIR = path.join(ROOT, 'frontend', 'src', 'assets', 'fonts');
const font64 = (f) => fs.readFileSync(path.join(FONT_DIR, f)).toString('base64');
const FONTS_CSS = `
@font-face{font-family:'Atkinson';font-weight:400;src:url(data:font/woff2;base64,${font64('atkinson-hyperlegible-latin-400-normal.woff2')}) format('woff2');}
@font-face{font-family:'Atkinson';font-weight:700;src:url(data:font/woff2;base64,${font64('atkinson-hyperlegible-latin-700-normal.woff2')}) format('woff2');}`;

/** Gallery plan. `note` is the Devpost caption. */
const PLAN = {
  '01': { slug: 'start', kicker: 'GHOST TOUCH', headline: "Feel diagrams you can't see", support: 'One tap to begin. Built for blind and low-vision students on an ordinary Android phone.', caption: 'Start screen: a single full-screen button. Feel diagrams you can\'t see, on an ordinary Android phone.' },
  '02': { slug: 'capture', kicker: 'CAPTURE', headline: 'Photo, screenshot or PDF', support: 'Take a photo or choose an image or PDF page. Three sample diagrams work offline.', caption: 'Capture screen: take a photo, choose an image or a PDF page, or open one of three built-in samples that work without a network.' },
  '03': { slug: 'explore-triangle', kicker: 'EXPLORE BY TOUCH', headline: 'Lines buzz. Corners speak.', support: 'Drag a finger over the diagram: vibration along lines, a double pulse and a spoken label at corners.', caption: 'Explore a right triangle by touch. The white dot is the app\'s own finger indicator. On Android the phone vibrates along lines and gives a double pulse at corners while speaking the corner label.' },
  '04': { slug: 'explore-graph', kicker: 'THEREMIN MODE', headline: 'Hear the shape of a graph', support: 'Pitch rises and falls with the height of the curve under your finger.', caption: 'A function graph (y = sin x). The pitch of a continuous tone follows the height of the curve under the finger.' },
  '05': { slug: 'ask', kicker: 'ASK', headline: 'Ask about the diagram', support: 'Answers come from the diagram itself and are spoken back in short sentences.', caption: 'Ask a question about the diagram ("Where is the right angle?"). Typed here; voice input is also supported. The answer comes from the diagram\'s own geometry and facts.' },
  '06': { slug: 'raw-mode', kicker: 'RAW MODE', headline: "Still works when the AI doesn't", support: 'If the AI cannot read a photo, OpenCV edge detection turns the outlines into lines you can feel.', caption: 'Raw Mode: when the AI cannot understand a photo, classical OpenCV edge detection still turns the outlines into lines the student can explore.' },
  '07': { slug: 'languages', kicker: 'MULTILINGUAL', headline: 'English, हिन्दी, ગુજરાતી', support: 'Interface and speech in three languages. Hindi and Gujarati are machine-translated; native review is pending.', caption: 'The Explore screen in Hindi. The interface and speech are available in English, Hindi and Gujarati (Hindi and Gujarati are machine-translated and awaiting native-speaker review).' },
  '08': { slug: 'settings', kicker: 'SETTINGS', headline: 'Your voice, your speed', support: 'Choose the language and speech speed, with help for your phone\'s vibration settings.', caption: 'Settings: language, speech speed, and guidance for turning on touch feedback on Samsung, Pixel, OnePlus and Xiaomi phones.' },
  '09': { slug: 'saved', kicker: 'SAVED DIAGRAMS', headline: 'Save diagrams for later', support: 'Reopen a saved diagram any time, without a network.', caption: 'Saved diagrams are stored on the phone and can be reopened offline.' },
  '10': { slug: 'teacher-editor', kicker: 'IN TESTING', headline: 'A teacher can fix the picture', support: 'A sighted teacher can add and correct points and edges. This feature is in testing.', caption: 'In testing: the teacher editor, where a sighted teacher can add and correct points and edges (off by default; switched on in Settings).' },
  '11': { slug: 'guide-finger', kicker: 'IN TESTING', headline: 'Let the phone guide your finger', support: 'Optional audio and haptic cues lead a finger to a point or a peak. This feature is in testing.', caption: 'In testing: Guide my finger, an optional mode that leads a finger toward a point, a peak or an answer (off by default; switched on in Settings).' },
};

// ---------------------------------------------------------------- composition
function composeHtml({ kicker, headline, support, phoneB64 }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS_CSS}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:800px;overflow:hidden;background:#07110b;font-family:'Atkinson','Nirmala UI','Segoe UI',sans-serif}
.canvas{position:relative;width:1200px;height:800px;overflow:hidden;
  background:
   radial-gradient(900px 600px at 78% 50%, rgba(57,255,136,.14), transparent 70%),
   linear-gradient(rgba(57,255,136,.055) 1px, transparent 1px) 0 0/40px 40px,
   linear-gradient(90deg, rgba(57,255,136,.055) 1px, transparent 1px) 0 0/40px 40px,
   #07110b;}
.frame{position:absolute;inset:26px;border:2px dashed rgba(57,255,136,.28);border-radius:26px}
.rivet{position:absolute;width:12px;height:12px;border-radius:50%;background:#c98a45;box-shadow:0 0 6px rgba(201,138,69,.6)}
.copy{position:absolute;left:84px;top:0;bottom:0;width:590px;display:flex;flex-direction:column;justify-content:center}
.kicker{color:#39ff88;font-weight:700;font-size:24px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:22px}
.headline{color:#fff;font-weight:700;font-size:68px;line-height:1.06;margin-bottom:26px}
.support{color:#a9c9b6;font-size:29px;line-height:1.36}
.phone{position:absolute;right:92px;top:35px;height:730px;padding:10px;border-radius:50px;background:#0c1410;
  border:2px solid rgba(57,255,136,.45);box-shadow:0 0 70px rgba(57,255,136,.28),0 0 0 6px #050a07, 0 30px 60px rgba(0,0,0,.6)}
.phone img{display:block;height:708px;width:auto;border-radius:40px}
.brand{position:absolute;left:84px;bottom:52px;color:rgba(169,201,182,.8);font-size:20px;letter-spacing:.08em}
</style></head><body><div class="canvas">
<div class="frame"></div>
<div class="rivet" style="left:20px;top:20px"></div><div class="rivet" style="right:20px;top:20px"></div>
<div class="rivet" style="left:20px;bottom:20px"></div><div class="rivet" style="right:20px;bottom:20px"></div>
<div class="copy"><div class="kicker">${esc(kicker)}</div><div class="headline">${esc(headline)}</div><div class="support">${esc(support)}</div></div>
<div class="brand">GHOST TOUCH</div>
<div class="phone"><img src="data:image/png;base64,${phoneB64}"></div>
</div></body></html>`;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- capture helpers
let liveCalls = 0;
const skipped = [];
const made = [];

async function reachable(url) {
  try { const r = await fetch(url, { method: 'GET' }); return r.ok || r.status < 500; } catch { return false; }
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function phoneShot(page, key) {
  await settle(page);
  const file = path.join(PHONE_DIR, `${key}.png`);
  const buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(file, buf);
  return buf;
}

async function composeOne(browser, key, buf) {
  const meta = PLAN[key];
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(composeHtml({ ...meta, phoneB64: buf.toString('base64') }), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const file = path.join(OUT, `${key}-${meta.slug}.png`);
  await p.screenshot({ path: file, type: 'png' });
  await ctx.close();
  made.push({ key, file });
  console.log('made', path.basename(file));
}

async function holdAt(page, cdp, x, y, drag) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(250);
  if (drag) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + drag.dx, y: y + drag.dy }] });
    await page.waitForTimeout(250);
  }
}
const lift = (cdp) => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

async function openSample(page, name) {
  await page.getByRole('button', { name: new RegExp(`Sample: ${name}`, 'i') }).click();
  await page.locator('canvas.gt-explore__canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
}
async function backToCapture(page) {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /Take photo/ }).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------- main
const baseUp = await reachable(BASE);
if (!baseUp) {
  console.error(`The app is not reachable at ${BASE}. Start "npx vite preview --port 4180 --strictPort" in frontend/ (after npm run build), or set GT_BASE.`);
  process.exit(1);
}
const rawUp = await reachable(`${RAW_API}/api/v1/health`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', locale: 'en-US' });
await ctx.route('**/api/v1/health', (r) => r.fulfill({ json: { ok: true } }));
// Where uploads go: 'raw' = local backend without AI keys (genuine OpenCV Raw Mode), 'live' = Render.
let sceneTarget = 'raw';
await ctx.route('**/api/v1/scene', async (r) => {
  if (sceneTarget === 'live') {
    if (liveCalls >= MAX_LIVE_CALLS) return r.abort();
    liveCalls += 1;
    const resp = await r.fetch({ url: `${LIVE_API}/api/v1/scene`, timeout: 120000 });
    return r.fulfill({ response: resp });
  }
  if (!rawUp) return r.abort();
  const resp = await r.fetch({ url: `${RAW_API}/api/v1/scene`, timeout: 60000 });
  return r.fulfill({ response: resp });
});
await ctx.route('**/api/v1/ask', async (r) => {
  if (liveCalls >= MAX_LIVE_CALLS) return r.abort();
  liveCalls += 1;
  const resp = await r.fetch({ url: `${LIVE_API}/api/v1/ask`, timeout: 120000 });
  return r.fulfill({ response: resp });
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
// Hide the dev-only "First hold: dx=..." line without changing app code: an init script sets
// visibility through the DOM (a CSP that blocks injected <style> tags does not block this).
await ctx.addInitScript(() => {
  const hide = () => {
    document.querySelectorAll('.gt-explore__debug').forEach((el) => {
      el.style.visibility = 'hidden';
    });
  };
  new MutationObserver(hide).observe(document, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', hide);
});

try {
  await page.goto(BASE + '/');
  await page.waitForTimeout(1200);

  // 01 start
  if (want('01')) await composeOne(browser, '01', await phoneShot(page, '01'));
  await page.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
  await page.getByRole('button', { name: /Take photo/ }).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(600);

  // 02 capture
  if (want('02')) await composeOne(browser, '02', await phoneShot(page, '02'));

  // 08 settings (opened from the capture screen)
  if (want('08')) {
    await page.getByRole('button', { name: /^Settings/ }).click();
    await page.waitForTimeout(700);
    await composeOne(browser, '08', await phoneShot(page, '08'));
    await page.getByRole('button', { name: /Close settings/ }).click();
    await page.waitForTimeout(500);
  }

  // 03 explore: right triangle, finger on a corner
  await openSample(page, 'triangle');
  if (want('03')) {
    // A finger on side AB, 42% of the way from A to B: the app's own white finger dot is then
    // clearly separate from the corner dots.
    const ca = await page.getByRole('button', { name: 'Corner A' }).boundingBox();
    const cb2 = await page.getByRole('button', { name: 'Corner B' }).boundingBox();
    const ax = ca.x + ca.width / 2, ay = ca.y + ca.height / 2;
    const bx = cb2.x + cb2.width / 2, by = cb2.y + cb2.height / 2;
    await holdAt(page, cdp, ax + 0.42 * (bx - ax), ay + 0.42 * (by - ay), { dx: 2, dy: 3 });
    await composeOne(browser, '03', await phoneShot(page, '03'));
    await lift(cdp);
    await page.waitForTimeout(300);
  }

  // 05 ask: typed question, real answer from the live backend (1 call)
  if (want('05')) {
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    // Headless Chrome has no microphone: the app listens for about 6 s, then offers a text box.
    const box = page.getByPlaceholder(/Type a question/i);
    const appeared = await box.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false);
    if (appeared) {
      await box.fill('Where is the right angle?');
      await page.getByRole('button', { name: /^Send$/ }).click();
      // wait for the live answer (a cold Render start can take about a minute)
      await page
        .waitForFunction(
          () => {
            const s = document.querySelector('.gt-explore__status')?.textContent ?? '';
            return s.length > 0 && !/didn't hear|Listening|Thinking|Sending|\.\.\.|type your question/i.test(s);
          },
          null,
          { timeout: 120000 },
        )
        .catch(() => {});
      await page.waitForTimeout(1000);
      const finalStatus = (await page.locator('.gt-explore__status').textContent().catch(() => '')) ?? '';
      const failed = /timed out|error|unavailable|couldn't|could not|failed|didn't hear|type your question/i.test(finalStatus);
      const staleFile = path.join(OUT, `05-${PLAN['05'].slug}.png`);
      if (failed || finalStatus.length === 0) {
        // Never ship a failure message in the gallery: drop any stale image from an earlier run.
        if (fs.existsSync(staleFile)) fs.unlinkSync(staleFile);
        skipped.push(`05: no real answer was captured (the status said: "${finalStatus.slice(0, 80)}"); likely a cold backend, re-run with --only=05`);
      } else {
        await composeOne(browser, '05', await phoneShot(page, '05'));
      }
    } else {
      skipped.push('05: the typed-question box did not appear after pressing Ask');
    }
    // leave the ask UI if it is a dialog
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }

  // 04 graph (theremin)
  await backToCapture(page);
  await openSample(page, 'sine');
  if (want('04')) {
    const sine = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'public', 'samples', 'sine.json'), 'utf8'));
    const pts = sine.polylines[0].points;
    const peak = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
    const cb = await page.locator('canvas.gt-explore__canvas').boundingBox();
    const scale = Math.min(cb.width, cb.height);
    const x = cb.x + (cb.width - scale) / 2 + peak[0] * scale;
    const y = cb.y + (cb.height - scale) / 2 + peak[1] * scale;
    await holdAt(page, cdp, x, y, { dx: 3, dy: 0 });
    await composeOne(browser, '04', await phoneShot(page, '04'));
    await lift(cdp);
    await page.waitForTimeout(300);
  }

  // 06 raw mode + 09 saved
  if (want('06') || want('09')) {
    await backToCapture(page);
    // 09 first: one real AI-read upload (a live call) so the saved card has a real title.
    if (want('09')) {
      sceneTarget = 'live';
      await page
        .locator('input[type=file]')
        .nth(1)
        .setInputFiles(path.join(ROOT, 'research', 'samples', 'synthetic', 'clean', '01_right_triangle.png'));
      await page.locator('canvas.gt-explore__canvas').waitFor({ state: 'visible', timeout: 120000 });
      await page.waitForTimeout(1500);
      sceneTarget = 'raw';
      await backToCapture(page);
      await page.getByRole('button', { name: /Saved diagrams/ }).click();
      await page.waitForTimeout(1200);
      await composeOne(browser, '09', await phoneShot(page, '09'));
      await page.getByRole('button', { name: /Back to Capture/i }).click();
      await page.getByRole('button', { name: /Take photo/ }).first().waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    }
    if (!rawUp) {
      skipped.push(`06: no local Raw Mode backend at ${RAW_API} (start the backend with empty provider keys)`);
    } else {
      const img = path.join(ROOT, 'research', 'samples', 'synthetic', 'photo', '01_right_triangle.jpg');
      await page.locator('input[type=file]').nth(1).setInputFiles(img);
      await page.locator('canvas.gt-explore__canvas').waitFor({ state: 'visible', timeout: 90000 });
      await page.waitForTimeout(1500);
      if (want('06')) {
        const c = await page.locator('canvas.gt-explore__canvas').boundingBox();
        await holdAt(page, cdp, c.x + c.width * 0.5, c.y + c.height * 0.5, { dx: 10, dy: 6 });
        await composeOne(browser, '06', await phoneShot(page, '06'));
        await lift(cdp);
        await page.waitForTimeout(300);
      }
      await backToCapture(page);
    }
  }

  // 07 hindi explore
  if (want('07')) {
    await page.getByRole('button', { name: /^Settings/ }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Hindi/ }).click();
    await page.waitForTimeout(600);
    await page.locator('.gt-lab-settings button').first().click(); // close
    await page.waitForTimeout(500);
    await openSample(page, '(triangle|त्रिभुज)').catch(async () => {
      // sample labels are localised: fall back to the first sample button
      await page.locator('button[aria-label*="triangle" i], button[aria-label*="त्रिभुज"]').first().click();
      await page.locator('canvas.gt-explore__canvas').waitFor({ state: 'visible' });
    });
    await page.waitForTimeout(800);
    const b = await page.locator('canvas.gt-explore__canvas').boundingBox();
    await holdAt(page, cdp, b.x + b.width * 0.62, b.y + b.height * 0.55, { dx: 6, dy: 4 });
    await composeOne(browser, '07', await phoneShot(page, '07'));
    await lift(cdp);
  }

  // 10 teacher editor and 11 guide my finger: both are behind build flags AND a Settings toggle.
  // Needs a second preview of a build made with VITE_FEATURE_GUIDE=1 VITE_FEATURE_SHARE=1
  // (see the README), served at GT_FLAGS_BASE (default http://localhost:4181).
  if (want('10') || want('11')) {
    const FLAGS_BASE = process.env.GT_FLAGS_BASE || 'http://localhost:4181';
    if (!(await reachable(FLAGS_BASE))) {
      skipped.push(`10/11: no flagged build reachable at ${FLAGS_BASE} (build with VITE_FEATURE_GUIDE=1 VITE_FEATURE_SHARE=1 and preview it)`);
    } else {
      const fctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block', locale: 'en-US' });
      await fctx.route('**/api/v1/health', (r) => r.fulfill({ json: { ok: true } }));
      await fctx.addInitScript(() => {
        const hide = () => document.querySelectorAll('.gt-explore__debug').forEach((el) => { el.style.visibility = 'hidden'; });
        new MutationObserver(hide).observe(document, { childList: true, subtree: true, characterData: true });
      });
      const fp = await fctx.newPage();
      const fcdp = await fctx.newCDPSession(fp);
      await fp.goto(FLAGS_BASE + '/');
      await fp.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
      await fp.getByRole('button', { name: /Take photo/ }).first().waitFor({ state: 'visible' });
      await fp.getByRole('button', { name: /^Settings/ }).click();
      await fp.waitForTimeout(600);
      if (want('10')) await fp.getByRole('switch', { name: /Teacher tools/i }).click();
      if (want('11')) await fp.getByRole('switch', { name: /Finger guidance/i }).click();
      await fp.waitForTimeout(400);
      await fp.getByRole('button', { name: /Close settings/ }).click();
      await fp.waitForTimeout(500);
      if (want('10')) {
        await fp.evaluate(() => { location.hash = '#/teach'; });
        await fp.waitForTimeout(1800);
        const headings = await fp.evaluate(() => [...document.querySelectorAll('h1,h2')].map((h) => h.textContent.trim()).join(' | '));
        if (headings) await composeOne(browser, '10', await phoneShot(fp, '10'));
        else skipped.push('10: the teacher screen did not render after enabling Teacher tools');
        await fp.evaluate(() => { location.hash = ''; });
        await fp.waitForTimeout(800);
      }
      if (want('11')) {
        // Fresh load: the Settings toggles persist in the browser, the previous screen does not.
        await fp.goto(FLAGS_BASE + '/');
        await fp.getByRole('button', { name: /Ghost Touch.*begin/i }).click();
        await fp.getByRole('button', { name: /Take photo/ }).first().waitFor({ state: 'visible' });
        await fp.getByRole('button', { name: /Sample: triangle/ }).click();
        await fp.locator('canvas.gt-explore__canvas').waitFor({ state: 'visible' });
        await fp.waitForTimeout(900);
        const guideBtn = fp.getByRole('button', { name: /guide/i }).first();
        if (await guideBtn.count()) {
          await guideBtn.scrollIntoViewIfNeeded().catch(() => {});
          await composeOne(browser, '11', await phoneShot(fp, '11'));
        } else {
          skipped.push('11: no guide control found on the Explore screen after enabling Finger guidance');
        }
      }
      await fctx.close();
    }
  }
} catch (err) {
  console.error('capture error:', err?.message ?? err);
  skipped.push(`stopped early: ${err?.message ?? err}`);
}

// ---------------------------------------------------------------- contact sheet + README
// Built from every gallery image on disk, so a partial run (--only=05) keeps the full sheet and README.
const existing = fs.readdirSync(OUT).filter((f) => /^\d\d-.*\.png$/.test(f)).sort();
const pngs = existing.map((f) => path.join(OUT, f));
if (pngs.length > 0) {
  const tiles = pngs
    .map((f) => `<figure><img src="${pathToFileURL(f).href}"><figcaption>${esc(path.basename(f))}</figcaption></figure>`)
    .join('');
  const sheetHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS_CSS}
*{box-sizing:border-box;margin:0}body{background:#050a07;padding:24px;font-family:'Atkinson',sans-serif;width:1800px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
figure img{width:100%;display:block;border:1px solid rgba(57,255,136,.35);border-radius:10px}
figcaption{color:#a9c9b6;font-size:18px;margin-top:6px}</style></head><body><div class="grid">${tiles}</div></body></html>`;
  const sheetFile = path.join(os.tmpdir(), 'ghost-touch-contact-sheet.html');
  fs.writeFileSync(sheetFile, sheetHtml);
  const sctx = await browser.newContext({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
  const sp = await sctx.newPage();
  await sp.goto(pathToFileURL(sheetFile).href);
  await sp.waitForLoadState('load');
  await sp.waitForTimeout(800);
  await sp.screenshot({ path: path.join(OUT, 'contact-sheet.png'), fullPage: true, type: 'png' });
  await sctx.close();
  console.log('made contact-sheet.png');
}

const lines = Object.keys(PLAN)
  .sort()
  .filter((k) => existing.some((f) => f.startsWith(`${k}-`)))
  .map((k) => `- \`${k}-${PLAN[k].slug}.png\`: ${PLAN[k].caption}`);
// A partial run does not know about screens it did not capture: keep the earlier notes.
const readmePath = path.join(OUT, 'README.md');
let notesSection = skipped.length ? `\n## Skipped or notes\n${skipped.map((s) => `- ${s}`).join('\n')}\n` : '';
if (only.length > 0 && fs.existsSync(readmePath)) {
  const prev = fs.readFileSync(readmePath, 'utf8');
  const i = prev.indexOf('\n## Skipped or notes');
  notesSection = i >= 0 ? prev.slice(i) : '';
}
const readme = `# Devpost gallery images

Generated by \`scripts/devpost-shots.mjs\` (Playwright, Pixel 7 emulation, local production build). Each image is 2400x1600 (3:2) PNG.
Phone screenshots are real captures of the app; the touch dot is the app's own finger indicator. Nothing is painted over the app.
The dev-only debug text under the canvas ("First hold: dx=...") is hidden at capture time by setting the element's visibility from the capture script (no app code changed).
Upload order: 01, then 03 right after the thumbnail, then 02, 04, 05, 06, 07, 08, 09, 10.

## Re-run
1. \`cd frontend && VITE_API_URL=https://ghost-touch-api.onrender.com npm run build && npx vite preview --port 4180 --strictPort\`
2. Raw Mode (06): start a local backend with every AI provider key blank so uploads take the real OpenCV path: \`cd backend && OPENAI_API_KEY= GEMINI_API_KEY= NEBIUS_API_KEY= VISION_PROVIDERS= ALLOWED_ORIGINS=http://localhost:4180 .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001\`
3. Teacher editor (10): build a second copy with the flags on, outside the repo, and preview it: \`cd frontend && VITE_FEATURE_GUIDE=1 VITE_FEATURE_SHARE=1 VITE_API_URL=https://ghost-touch-api.onrender.com npx vite build --outDir <tmp>/gt-dist-flags --emptyOutDir && npx vite preview --outDir <tmp>/gt-dist-flags --port 4181 --strictPort\`
4. \`node scripts/devpost-shots.mjs\` (or \`--only=03,05\`). Warm the Render backend first (open its /api/v1/health), or 05 shows a timeout and is dropped.

## Captions to paste

${lines.join('\n')}

## How the shots were made
- Samples are the built-in offline diagrams. Only two things use the live backend: the Ask answer (05) and one real AI-read upload (09, so the saved card has a real title). A full run makes 2 live calls; the script caps live calls at ${MAX_LIVE_CALLS} per run.
- Raw Mode (06) comes from the real backend running locally with all AI provider keys blank, so the upload takes the genuine OpenCV Raw Mode path. The image uploaded is a synthetic photo from research/samples.
- The question in 05 is typed; headless Chrome has no microphone. The answer text is the live backend's.
- Font: Atkinson Hyperlegible (the app's own self-hosted font; Inter is not installed on this machine). Hindi and Gujarati glyphs come from system fonts.
${notesSection}`;
fs.writeFileSync(readmePath, readme);

await browser.close();
console.log(`done: ${made.length} images, ${liveCalls} live API call(s), ${skipped.length} skipped`);
for (const s of skipped) console.log('  skipped:', s);
