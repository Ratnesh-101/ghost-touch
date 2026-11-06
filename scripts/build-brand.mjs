#!/usr/bin/env node
/**
 * scripts/build-brand.mjs — Brand Asset Generator for Ghost Touch
 *
 * Renders SVG brand assets to production PNG, ICO, and contact sheet
 * using headless Chromium via `playwright-core`.
 *
 * Requirements (Lane Lab-Brand):
 * - Reproducible Node script (no new dependencies added to package.json).
 * - Lazy-imports `playwright-core`; clear error message if missing.
 * - Browser path from env `BRAND_BROWSER` or auto-detected Edge/Chrome on Windows,
 *   Chrome on macOS, chromium on Linux.
 * - Embeds Atkinson Hyperlegible woff2 fonts via base64 @font-face if present.
 * - Outputs:
 *   1. frontend/public/apple-touch-icon.png (180x180)
 *   2. frontend/public/icons/icon-192.png (192x192)
 *   3. frontend/public/icons/icon-512.png (512x512)
 *   4. frontend/public/icons/icon-maskable-512.png (512x512)
 *   5. frontend/public/brand/og-image.png (1200x630)
 *   6. frontend/public/favicon.ico (16/32/48 multi-size PNG-in-ICO container)
 *   7. docs/design/screenshots/logo-sizes.png (contact sheet: 16/32/64 favicon & masked icon)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Lazy import playwright-core
let chromium;
try {
  const pw = await import('playwright-core');
  chromium = pw.chromium;
} catch (err) {
  console.error('================================================================');
  console.error('ERROR: playwright-core is required to execute build-brand.mjs');
  console.error('Please ensure playwright-core is available in node_modules.');
  console.error(`Details: ${err.message}`);
  console.error('================================================================');
  process.exit(1);
}

/** Detect browser executable path across operating systems */
function findBrowserExecutable() {
  if (process.env.BRAND_BROWSER) {
    if (fs.existsSync(process.env.BRAND_BROWSER)) {
      return process.env.BRAND_BROWSER;
    }
    console.warn(`[build-brand] BRAND_BROWSER="${process.env.BRAND_BROWSER}" not found on disk. Checking defaults.`);
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const candidates = [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  } else {
    // Linux
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge',
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return 'chromium';
}

/** Construct base64 @font-face CSS for self-hosted Atkinson Hyperlegible fonts */
function getFontFacesCSS() {
  const fontsDir = path.join(repoRoot, 'frontend', 'src', 'assets', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    return '';
  }

  const entries = fs.readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'));
  let css = '';
  for (const file of entries) {
    const fullPath = path.join(fontsDir, file);
    const base64Data = fs.readFileSync(fullPath).toString('base64');
    const isBold = file.toLowerCase().includes('bold') || file.includes('700');
    const weight = isBold ? '700' : '400';

    css += `
      @font-face {
        font-family: 'Atkinson Hyperlegible';
        src: url(data:font/woff2;charset=utf-8;base64,${base64Data}) format('woff2');
        font-weight: ${weight};
        font-style: normal;
        font-display: block;
      }
    `;
  }
  return css;
}

/** Construct a handwritten multi-size PNG-in-ICO binary file */
function createIco(images) {
  const count = images.length;
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + count * entrySize;

  let totalSize = dirSize;
  for (const img of images) {
    totalSize += img.buffer.length;
  }

  const out = Buffer.alloc(totalSize);

  // ICO Header (6 bytes)
  out.writeUInt16LE(0, 0); // Reserved (must be 0)
  out.writeUInt16LE(1, 2); // Image type: 1 = ICO
  out.writeUInt16LE(count, 4); // Number of images

  let offset = dirSize;
  for (let i = 0; i < count; i++) {
    const img = images[i];
    const entryOffset = headerSize + i * entrySize;

    out.writeUInt8(img.width >= 256 ? 0 : img.width, entryOffset + 0);
    out.writeUInt8(img.height >= 256 ? 0 : img.height, entryOffset + 1);
    out.writeUInt8(0, entryOffset + 2); // Color palette count (0 = >8bpp)
    out.writeUInt8(0, entryOffset + 3); // Reserved
    out.writeUInt16LE(1, entryOffset + 4); // Color planes
    out.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    out.writeUInt32LE(img.buffer.length, entryOffset + 8); // PNG byte length
    out.writeUInt32LE(offset, entryOffset + 12); // Byte offset in ICO

    img.buffer.copy(out, offset);
    offset += img.buffer.length;
  }

  return out;
}

async function renderSvgToPng(page, svgContent, width, height, fontCss, bg = 'transparent') {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${bg};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: ${width}px;
      height: ${height}px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  // Ensure web fonts are rendered
  await page.evaluate(() => document.fonts?.ready);

  return await page.screenshot({
    type: 'png',
    omitBackground: bg === 'transparent',
  });
}

async function main() {
  console.log('[build-brand] Starting Ghost Touch brand assets build...');

  const executablePath = findBrowserExecutable();
  console.log(`[build-brand] Using browser executable: ${executablePath}`);

  const fontCss = getFontFacesCSS();
  if (fontCss) {
    console.log('[build-brand] Embedded self-hosted Atkinson Hyperlegible fonts.');
  } else {
    console.log('[build-brand] Note: woff2 font files not found, falling back to system fonts.');
  }

  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });

    // File paths
    const publicBrandDir = path.join(repoRoot, 'frontend', 'public', 'brand');
    const publicIconsDir = path.join(repoRoot, 'frontend', 'public', 'icons');
    const publicDir = path.join(repoRoot, 'frontend', 'public');
    const screenshotsDir = path.join(repoRoot, 'docs', 'design', 'screenshots');

    fs.mkdirSync(publicBrandDir, { recursive: true });
    fs.mkdirSync(publicIconsDir, { recursive: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Read source SVGs
    const logoMarkSvg = fs.readFileSync(path.join(publicBrandDir, 'logo-mark.svg'), 'utf8');
    const logoMaskableSvg = fs.readFileSync(path.join(publicBrandDir, 'logo-maskable.svg'), 'utf8');
    const ogImageSvg = fs.readFileSync(path.join(publicBrandDir, 'og-image.svg'), 'utf8');
    const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');

    // 1. apple-touch-icon.png (180x180) - maskable on dark #0b0e0c
    console.log('[build-brand] Generating apple-touch-icon.png (180x180)...');
    const appleTouchBuf = await renderSvgToPng(page, logoMaskableSvg, 180, 180, fontCss, '#0b0e0c');
    fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouchBuf);

    // 2. icon-192.png (192x192)
    console.log('[build-brand] Generating icon-192.png (192x192)...');
    const icon192Buf = await renderSvgToPng(page, logoMaskableSvg, 192, 192, fontCss, '#0b0e0c');
    fs.writeFileSync(path.join(publicIconsDir, 'icon-192.png'), icon192Buf);

    // 3. icon-512.png (512x512)
    console.log('[build-brand] Generating icon-512.png (512x512)...');
    const icon512Buf = await renderSvgToPng(page, logoMaskableSvg, 512, 512, fontCss, '#0b0e0c');
    fs.writeFileSync(path.join(publicIconsDir, 'icon-512.png'), icon512Buf);

    // 4. icon-maskable-512.png (512x512)
    console.log('[build-brand] Generating icon-maskable-512.png (512x512)...');
    const iconMaskableBuf = await renderSvgToPng(page, logoMaskableSvg, 512, 512, fontCss, '#0b0e0c');
    fs.writeFileSync(path.join(publicIconsDir, 'icon-maskable-512.png'), iconMaskableBuf);

    // 5. og-image.png (1200x630)
    console.log('[build-brand] Generating og-image.png (1200x630)...');
    const ogImageBuf = await renderSvgToPng(page, ogImageSvg, 1200, 630, fontCss, '#0b0e0c');
    fs.writeFileSync(path.join(publicBrandDir, 'og-image.png'), ogImageBuf);

    // 6. favicon.ico (16, 32, 48 PNG frames inside ICO)
    console.log('[build-brand] Generating favicon.ico (16, 32, 48)...');
    const fav16Buf = await renderSvgToPng(page, faviconSvg, 16, 16, fontCss, 'transparent');
    const fav32Buf = await renderSvgToPng(page, faviconSvg, 32, 32, fontCss, 'transparent');
    const fav48Buf = await renderSvgToPng(page, faviconSvg, 48, 48, fontCss, 'transparent');
    const fav64Buf = await renderSvgToPng(page, faviconSvg, 64, 64, fontCss, 'transparent');

    const icoData = createIco([
      { width: 16, height: 16, buffer: fav16Buf },
      { width: 32, height: 32, buffer: fav32Buf },
      { width: 48, height: 48, buffer: fav48Buf },
    ]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoData);

    // 7. Contact sheet: docs/design/screenshots/logo-sizes.png
    console.log('[build-brand] Generating contact sheet logo-sizes.png...');
    const fav16b64 = fav16Buf.toString('base64');
    const fav32b64 = fav32Buf.toString('base64');
    const fav64b64 = fav64Buf.toString('base64');
    const maskable512b64 = iconMaskableBuf.toString('base64');

    const contactHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1000px;
      padding: 40px;
      background: #0b0e0c;
      color: #f5fff8;
      font-family: 'Atkinson Hyperlegible', system-ui, sans-serif;
    }
    h1 {
      font-size: 28px;
      color: #39ff88;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      color: #a8c5b5;
      font-size: 15px;
      margin-bottom: 32px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .card {
      background: #14141e;
      border: 1px solid rgba(57, 255, 136, 0.25);
      border-radius: 12px;
      padding: 24px;
    }
    .card h2 {
      font-size: 18px;
      color: #00e5ff;
      margin-bottom: 16px;
    }
    .fav-row {
      display: flex;
      align-items: flex-end;
      gap: 24px;
      margin-top: 16px;
    }
    .fav-item {
      text-align: center;
      font-size: 13px;
      color: #a8c5b5;
    }
    .fav-box {
      background: #070908;
      border: 1px dashed #e8dfc8;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      padding: 12px;
    }
    .zoom-box {
      image-rendering: pixelated;
    }
    .mask-container {
      position: relative;
      width: 256px;
      height: 256px;
      margin: 0 auto;
    }
    .mask-icon {
      width: 256px;
      height: 256px;
      border-radius: 50%;
      box-shadow: 0 0 20px rgba(57, 255, 136, 0.25);
    }
    .mask-safe-zone {
      position: absolute;
      top: 10%;
      left: 10%;
      width: 80%;
      height: 80%;
      border: 1.5px dashed #00e5ff;
      border-radius: 50%;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <h1>Ghost Touch — Brand &amp; Icon Contact Sheet</h1>
  <p class="subtitle">Multi-scale favicon rendering and Android maskable safe-zone verification</p>

  <div class="grid">
    <div class="card">
      <h2>Favicon Scales (16 px, 32 px, 64 px)</h2>
      <div class="fav-row">
        <div class="fav-item">
          <div class="fav-box"><img src="data:image/png;base64,${fav16b64}" width="16" height="16" /></div>
          <span>16×16 (1×)</span>
        </div>
        <div class="fav-item">
          <div class="fav-box"><img class="zoom-box" src="data:image/png;base64,${fav16b64}" width="48" height="48" /></div>
          <span>16×16 (3× zoom)</span>
        </div>
        <div class="fav-item">
          <div class="fav-box"><img src="data:image/png;base64,${fav32b64}" width="32" height="32" /></div>
          <span>32×32 (1×)</span>
        </div>
        <div class="fav-item">
          <div class="fav-box"><img src="data:image/png;base64,${fav64b64}" width="64" height="64" /></div>
          <span>64×64 (1×)</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Android Maskable Safe Zone (80% Circular Crop)</h2>
      <div class="mask-container">
        <img class="mask-icon" src="data:image/png;base64,${maskable512b64}" />
        <div class="mask-safe-zone"></div>
      </div>
      <p style="text-align: center; margin-top: 12px; font-size: 13px; color: #a8c5b5;">
        Dashed cyan line = 80% safe zone boundary. Mark stays completely clear of cropping.
      </p>
    </div>
  </div>
</body>
</html>`;

    await page.setViewportSize({ width: 1000, height: 600 });
    await page.setContent(contactHtml, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts?.ready);
    const contactBuf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, 'logo-sizes.png'), contactBuf);

    console.log('[build-brand] Brand assets built successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[build-brand] Fatal error:', err);
  process.exit(1);
});
