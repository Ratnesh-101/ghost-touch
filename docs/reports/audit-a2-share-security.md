# Audit Report: a2-share-security

**Lane**: `a2-share-security`  
**Auditor**: Antigravity (Gemini 3.8 Flash)  
**Date**: 2026-11-06  
**Status**: Complete  
**Scope**: Security and robustness of Teacher verify & share. Target files: `frontend/src/share/**`, `frontend/src/drivers/hashRoute.ts`, `frontend/src/drivers/clipboard.ts`, routing in `frontend/src/App.tsx`, `frontend/src/components/VerifiedBanner.tsx`, `frontend/src/screens/ShareError.tsx`, `frontend/src/components/teach/SharePanel.tsx`, `frontend/vercel.json`, `frontend/vite.config.ts`, CSP/headers.

---

## Executive Summary

The Teacher Verify & Share implementation exhibits strong fundamental design choices:
- Student opening is 100% offline with zero server calls.
- Decoded strings are never passed to `dangerouslySetInnerHTML` and render as safe React text children or Canvas 2D text.
- `JSON.parse` reviver strips `__proto__`, `constructor`, and `prototype` keys.
- Decompressed character size is capped before JSON parsing (zip bomb guard).

However, our rigorous audit identified **15 findings** across input validation, Unicode handling, honesty disclosures, and browser lifecycle:
- **4 High Severity Findings**: Premature URL-length rejection blocking valid 12k payloads; missing Unicode bidi/RTL/C1 sanitization enabling authority spoofing; complete omission of honesty copy on student-facing surfaces; and extensive validator drift between client `validateShareScene` and server `backend/app/validate.py`.
- **6 Medium Severity Findings**: Redundant `loc.hash = ''` reintroducing hash symbols and breaking history; silent swallowing of clipboard and Web Share API failures; inverted bar coordinate vulnerability blinding touch exploration; unvalidated origin protocol spoofing; unscannable 2,000-character QR codes on mobile; and unbounded `facts` array size.
- **5 Low Severity Findings**: Missing HTTP security headers in `vercel.json`; element ID `"title"` colliding with scene title renaming; Requirement 3.6 colour/shape word drift; unverified `verifiedAt` timestamps; and hash lingering in browser address bar.

---

## Confirmed Findings (Ranked by Severity)

### High Severity Findings

#### SEC-01 · high · frontend/src/share/codec.ts:131
- **What is wrong**:
  `decodeShare()` checks `hash.length > LIMITS.maxHashChars || raw.length > LIMITS.maxHashChars` *after* stripping the `#s=` prefix or extracting `raw` from a full URL. Because `hash` is the raw input string (which includes `https://domain.com/#s=`), any payload near the 12,000 character cap (`LIMITS.maxHashChars`) is prematurely rejected as `'too-large'` because `hash.length` exceeds 12,000 characters, even though the actual compressed payload `raw` is well within limits.
- **Concrete failure scenario**:
  1. Teacher creates a complex diagram. `encodeShare(payload)` generates a compressed payload of 11,990 characters (valid: `<= 12000`).
  2. Teacher generates a link: `https://ghost-touch.org/#s=` + 11,990 chars (total length = 12,016 chars).
  3. Student opens the link in browser. `window.location.hash` is `#s=` + 11,990 chars (length = 11,993 chars). If opened directly via a link or passed as a full URL to `loadSceneFromShareInput(url)`:
     `hash.length` is 12,016 > 12,000.
  4. `decodeShare` throws `ShareError('too-large')`, and the student sees `"This shared link is too large to open."` instead of the diagram.
- **Proposed minimal fix**:
  In `frontend/src/share/codec.ts`, extract `raw` first, and check *only* `raw.length > LIMITS.maxHashChars`. Do not test `hash.length`.
  ```ts
  // Check length of extracted payload BEFORE any decompression call
  if (raw.length > LIMITS.maxHashChars) {
    throw new ShareError(
      'too-large',
      `Share payload exceeds maximum length of ${LIMITS.maxHashChars} characters`,
    );
  }
  ```
- **Proposed test**:
  ```ts
  it('SEC-01: decodes payload near cap when wrapped in full origin URL', () => {
    const rawPayload = 'A'.repeat(11990);
    const fullUrl = `https://ghost-touch.org/#s=${rawPayload}`;
    // Should fail with bad-format (not too-large) because 11990 <= maxHashChars
    expect(() => decodeShare(fullUrl)).toThrowError(
      expect.objectContaining({ code: 'bad-format' }),
    );
  });
  ```

---

#### SEC-02 · high · frontend/src/share/validate.ts:32-43 · frontend/src/components/VerifiedBanner.tsx:43-64
- **What is wrong**:
  `sanitizeString` strips only ASCII C0 control characters (`\x00-\x1F\x7F`). It preserves all Unicode bidirectional control characters (`\u200E`, `\u200F`, `\u202A`–`\u202E`, `\u2066`–`\u2069`), zero-width characters (`\u200B`, `\uFEFF`), and C1 controls (`\u0080`–`\u009F`). Furthermore, `VerifiedBanner.tsx` renders `verifiedText` without `<bdi>` or `dir="auto"` text isolation. An attacker can use RTL override (`\u202E`) in `verifiedBy` or newlines in `note` to spoof credentials or flip display text (e.g. flipping "Verified by John" into "Verified by Ministry of Education").
- **Concrete failure scenario**:
  1. Attacker crafts a diagram payload with `verifiedBy: "Dr. Rao\u202E ]Ministry of Education["`.
  2. Student opens the diagram.
  3. Because the text is rendered in `<span className="gt-verified-banner__by">{verifiedText}</span>` without direction isolation, the browser flips the visual display order to mimic official ministry verification.
  4. Alternatively, attacker inputs `note: "\n\n✓ Officially Authenticated by Board of Education"`. Sighted students see multi-line badge imitation, and blind students clicking "Read note" hear the synthesized voice state official board authentication.
- **Proposed minimal fix**:
  1. In `frontend/src/share/validate.ts`, expand `sanitizeString` to strip Unicode bidi overrides, directional isolates, and formatting marks:
     ```ts
     const BIDI_PATTERN = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
     ```
  2. In `frontend/src/components/VerifiedBanner.tsx`, wrap `{verifiedText}` in `<bdi>` or set `dir="auto"`.
- **Proposed test**:
  ```ts
  it('SEC-02: strips bidi override characters from teacher name and notes', () => {
    const maliciousName = 'Alice\u202EBob\u2066Dept';
    const sanitized = sanitizeString(maliciousName, 60);
    expect(sanitized).toBe('AliceBobDept');
    expect(sanitized).not.toMatch(/[\u202E\u2066]/);
  });
  ```

---

#### SEC-03 · high · frontend/src/components/VerifiedBanner.tsx:42-65 · frontend/src/components/teach/SharePanel.tsx:53-115 · frontend/src/App.tsx:100-103
- **What is wrong**:
  Honesty copy ("Verified means a person reviewed this diagram. It is not cryptographic proof") is completely absent from all recipient/student-facing surfaces. While present on the teacher creation form (`VerifyForm.tsx`), it is missing on `VerifiedBanner.tsx` (Explore screen), `SharePanel.tsx` (the link share panel), and the spoken announcement. A student is greeted by an authoritative cyan checkmark badge (`✓`) and the spoken line "Verified by [Name]", with no indication that this is an unauthenticated client-side claim.
- **Concrete failure scenario**:
  1. A student receives a link claiming to be verified by `"State Examination Board"`.
  2. The student opens the link. The app shows a glowing badge with `"✓ Verified by State Examination Board"` and speaks `"Verified by State Examination Board"`.
  3. The student trusts the diagram as an official, authentic examination document, having never seen or heard the disclaimer that verification is not cryptographic proof.
- **Proposed minimal fix**:
  1. In `VerifiedBanner.tsx`, render `t('share.honesty')` as a persistent, accessible notice below the verified line.
  2. In `SharePanel.tsx`, display `t('share.honesty')` below the URL presentation box.
- **Proposed test**:
  ```tsx
  it('SEC-03: VerifiedBanner renders honesty disclosure note', () => {
    const html = renderToStaticMarkup(createElement(VerifiedBanner, { by: 'Teacher' }));
    expect(html).toContain('not cryptographic proof');
  });
  ```

---

#### SEC-04 · high · frontend/src/share/validate.ts:126-133, 203-207, 262-264, 286-288
- **What is wrong**:
  Severe validator drift versus `backend/app/validate.py`. The contract states that `validateShareScene` applies the *same* rules as `validate.py`. In `backend/app/validate.py`, out-of-tolerance coordinates are *silently repaired* by dropping the invalid element (point, polyline coordinate, or bar) and keeping the valid remainder. In `validateShareScene`, any coordinate outside `[0, 1] +/- 0.02` immediately pushes an error to `errors` and rejects the entire diagram with `ShareError('bad-scene')`.
- **Concrete failure scenario**:
  1. An LLM or teacher editor produces a diagram with 10 valid points and 1 noisy point at `x = 1.05`.
  2. In `backend/app/validate.py`: the noisy point is dropped, the 10 valid points are kept, and the diagram is successfully delivered to the user.
  3. If this diagram is encoded and opened via a share link: `validateShareScene` fails because `!xClamped.ok`, rejecting the entire scene with `ShareError('bad-scene')`. The student cannot view the diagram at all.
- **Proposed minimal fix**:
  In `frontend/src/share/validate.ts`, align coordinate handling with `validate.py`: drop elements with out-of-bounds coordinates instead of pushing fatal errors, provided at least one drawable element survives.
- **Proposed test**:
  ```ts
  it('SEC-04: repairs scene with out-of-tolerance point by dropping it rather than rejecting', () => {
    const sceneWithBadPoint = {
      version: 1,
      kind: 'geometry',
      points: [
        { id: 'p1', x: 0.5, y: 0.5 },
        { id: 'p2', x: 1.5, y: 0.5 }, // out of tolerance
      ],
      segments: [],
    };
    const res = validateShareScene(sceneWithBadPoint);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.points.length).toBe(1);
      expect(res.scene.points[0]?.id).toBe('p1');
    }
  });
  ```

---

### Medium Severity Findings

#### SEC-05 · med · frontend/src/drivers/hashRoute.ts:65
- **What is wrong**:
  In `clearHash()`, after removing the hash cleanly via `history.replaceState(null, '', path || '/')`, line 65 immediately executes `loc.hash = ''`. In modern browsers (Chromium, WebKit, Gecko), direct assignment to `location.hash` appends `#` to the address bar, pushes an unwanted session history entry, and fires a native `hashchange` event. Line 73 then manually dispatches a second artificial `hashchange` event.
- **Concrete failure scenario**:
  1. Student opens a shared diagram link `https://ghost-touch.org/#s=payload`.
  2. Student finishes exploring and taps Back (`handleBack`).
  3. `clearHash()` runs `history.replaceState` then `loc.hash = ''`.
  4. The URL becomes `https://ghost-touch.org/#` with an extra `#` entry in browser history.
  5. The student presses Android hardware Back to exit the app, but instead navigates to the previous history state, failing to leave.
- **Proposed minimal fix**:
  Remove line 65 from `frontend/src/drivers/hashRoute.ts`:
  ```ts
  // Delete: if (loc && typeof loc.hash === 'string') { loc.hash = ''; }
  ```
- **Proposed test**:
  ```ts
  it('SEC-05: clearHash removes hash without assigning loc.hash', () => {
    const { mockWindow, replaceStateSpy } = createMockWindow('#s=test');
    clearHash();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/');
    expect(mockWindow.location.hash).toBe('');
  });
  ```

---

#### SEC-06 · med · frontend/src/components/teach/SharePanel.tsx:34-50 · frontend/src/drivers/clipboard.ts:18-56, 78-91
- **What is wrong**:
  Clipboard copy and Web Share failures are silently swallowed. If `copyToClipboard(url)` returns `false` (e.g. document unfocused, permission denied, or unsupported browser), `handleCopy` does nothing: no status message is updated, and `onSpeak` is not called. If `shareViaWebShare` rejects with a system error (not an `AbortError`), the failure is completely ignored.
- **Concrete failure scenario**:
  1. A visually impaired teacher clicks "Copy link" in a browser where clipboard write permission is blocked.
  2. `copyToClipboard` fails and returns `false`.
  3. `handleCopy` does not call `onSpeak`. The teacher hears complete silence and assumes the link was copied. They switch to an email or messaging app and paste previous/stale content.
- **Proposed minimal fix**:
  In `SharePanel.tsx`, handle `false` by speaking `t('teach.copyFailed')` and displaying an inline error message:
  ```ts
  const success = await copyToClipboard(url);
  if (success) {
    // ...
  } else {
    onSpeak?.(t('teach.copyFailed'));
  }
  ```
- **Proposed test**:
  ```ts
  it('SEC-06: speaks error message when copyToClipboard fails', async () => {
    const speakMock = vi.fn();
    // Test that when copy returns false, speakMock is called with copy error
  });
  ```

---

#### SEC-07 · med · frontend/src/share/validate.ts:257-274 · frontend/src/core/hitTest.ts:228-232
- **What is wrong**:
  Bar coordinate orientation is not normalized or validated for `x0 <= x1` or `y_top <= y_base`. If a shared diagram contains inverted bar coordinates (e.g. `x0: 0.8, x1: 0.2`), `validateShareScene` accepts it, but `hitTest.ts` line 229 evaluates `fn.x >= bar.x0 && fn.x <= bar.x1`, which can never be satisfied. The bar interior becomes completely unhittable by touch.
- **Concrete failure scenario**:
  1. A shared diagram contains bar data where `x0 = 0.7` and `x1 = 0.3`.
  2. Student opens the diagram.
  3. Student traces finger across the bar area. The bar interior haptic pitch and spoken value never trigger because `fn.x >= 0.7 && fn.x <= 0.3` is impossible.
- **Proposed minimal fix**:
  In `validateShareScene`, normalize bar rectangle coordinates:
  ```ts
  x0: Math.min(x0Res.val, x1Res.val),
  x1: Math.max(x0Res.val, x1Res.val),
  y_top: Math.min(yTopRes.val, yBaseRes.val),
  y_base: Math.max(yTopRes.val, yBaseRes.val),
  ```
- **Proposed test**:
  ```ts
  it('SEC-07: normalizes inverted bar coordinates', () => {
    const scene = {
      version: 1, kind: 'bar_chart',
      bars: [{ id: 'b1', label: 'Q1', value: 10, x0: 0.8, x1: 0.2, y_top: 0.8, y_base: 0.2 }],
    };
    const res = validateShareScene(scene);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.scene.bars[0]?.x0).toBe(0.2);
      expect(res.scene.bars[0]?.x1).toBe(0.8);
    }
  });
  ```

---

#### SEC-08 · med · frontend/src/drivers/clipboard.ts:98-114 · frontend/src/share/codec.ts:92-95
- **What is wrong**:
  `getShareOrigin()` has zero protocol validation. If the app is hosted inside a sandboxed iframe or loaded from a `file://` URL, `window.location.origin` evaluates to the string `"null"`. `shareUrl("null", encoded)` produces `"null/#s=..."`. Furthermore, if `VITE_SITE_URL` contains an invalid protocol (or `//evil.com`), it generates spoofed or invalid share links.
- **Concrete failure scenario**:
  1. The app is embedded in an LMS iframe with `sandbox` attribute.
  2. `window.location.origin` returns `"null"`.
  3. Teacher generates a share link. The generated link and QR code encode `"null/#s=..."`, generating broken links and QR codes.
- **Proposed minimal fix**:
  In `getShareOrigin()`, validate that the resolved URL starts with `http://` or `https://`. If not, fall back to `'http://localhost'` or `'https://ghosttouch.app'`.
- **Proposed test**:
  ```ts
  it('SEC-08: getShareOrigin falls back safely when window.location.origin is "null"', () => {
    // Mock origin as "null"
    expect(getShareOrigin()).toMatch(/^https?:\/\//);
  });
  ```

---

#### SEC-09 · med · frontend/src/share/limits.ts:15 · frontend/src/components/teach/SharePanel.tsx:98-114
- **What is wrong**:
  `LIMITS.qrMaxUrlChars` is set to 2,000 characters. While `QRCode.toDataURL` can encode 2,000 alphanumeric characters, LZ-string contains lowercase characters requiring QR Byte mode. At 2,000 bytes, QR code requires Version 38 (169×169 modules). When rendered inside a 200×200 px container (`.gt-teach__qr-img`), each module is ~1.15 pixels wide, making it completely impossible for smartphone cameras to focus or scan.
- **Concrete failure scenario**:
  1. Teacher creates a diagram with 15 vertices and segments (URL length = ~1,600 chars).
  2. `qrDataUrl` succeeds and generates a Version 34 QR code.
  3. The QR code displays on screen. Sighted teacher asks students to scan it from their phones.
  4. No camera can resolve the dense, microscopic modules, leading to classroom failure.
- **Proposed minimal fix**:
  Lower `LIMITS.qrMaxUrlChars` to a realistic mobile threshold of 600 characters, so the UI falls back to "Link too long for a QR code; use Copy link" whenever the QR code would be unscannable.
- **Proposed test**:
  ```ts
  it('SEC-09: qrDataUrl rejects URLs over 600 characters', async () => {
    const longUrl = `https://ghost-touch.org/#s=${'A'.repeat(601)}`;
    expect(await qrDataUrl(longUrl)).toBeNull();
  });
  ```

---

#### SEC-10 · med · frontend/src/share/validate.ts:311-317
- **What is wrong**:
  Unbounded `facts` array size in `validateShareScene`. Points (300), segments (300), polylines (2000 pts), and bars (60) all have explicit array caps. `raw.facts` has NO array length cap; it only truncates individual string lengths to 280 chars. An attacker can supply thousands of facts, causing client memory overhead and inflating `POST /api/v1/ask` request sizes.
- **Concrete failure scenario**:
  1. Attacker crafts a diagram containing `facts: Array(5000).fill("A = 1")`.
  2. `validateShareScene` accepts all 5,000 facts.
  3. Student asks a question on Explore. The client serializes all 5,000 facts and sends a massive body to `/api/v1/ask`.
- **Proposed minimal fix**:
  Enforce a cap of 50 facts in `validateShareScene`:
  ```ts
  facts = raw.facts
    .filter((f): f is string => typeof f === 'string')
    .slice(0, 50)
    .map((f) => sanitizeString(f, 280));
  ```
- **Proposed test**:
  ```ts
  it('SEC-10: caps facts array to at most 50 items', () => {
    const raw = { version: 1, kind: 'geometry', points: [{ id: 'p1', x: 0.1, y: 0.1 }], facts: Array(100).fill('fact') };
    const res = validateShareScene(raw);
    expect(res.ok && res.scene.facts?.length).toBeLessThanOrEqual(50);
  });
  ```

---

### Low Severity Findings

#### SEC-11 · low · frontend/vercel.json:6-43 · frontend/index.html:1-33
- **What is wrong**:
  Missing security headers. Neither `vercel.json` nor `index.html` configure `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, or `Referrer-Policy`. Ghost Touch can be framed in arbitrary third-party websites without frame-ancestors restrictions.
- **Proposed minimal fix**:
  Add standard security headers in `frontend/vercel.json`.

---

#### SEC-12 · low · frontend/src/share/validate.ts:121, 159, 187, 250
- **What is wrong**:
  Element IDs matching `'title'` or `'scene:title'` collide with `renameLabel` in `frontend/src/core/correct.ts:66`. If a shared diagram contains a point with `id: 'title'`, attempting to rename that point in Teacher Editor renames the diagram title instead.
- **Proposed minimal fix**:
  In `validateShareScene`, disallow or automatically prefix IDs equal to `'title'` or `'scene:title'`.

---

#### SEC-13 · low · frontend/src/share/validate.ts:134, 165, 223
- **What is wrong**:
  `validateShareScene` lacks Requirement 3.6 colour/shape word validation (`_check_labels` in `backend/app/validate.py`). A shared diagram with label `"blue polygon"` is accepted by client-side validation, whereas the backend validator rejects it.
- **Proposed minimal fix**:
  Add `COLOUR_SHAPE_WORDS` validation to `validateShareScene` if full parity is desired.

---

#### SEC-14 · low · frontend/src/share/codec.ts:199-202
- **What is wrong**:
  `verifiedAt` timestamp is not validated to be an ISO 8601 date. Any string up to 100 characters is accepted without format verification.
- **Proposed minimal fix**:
  Verify `!isNaN(Date.parse(payloadObj.verifiedAt))` before accepting; fall back to `new Date().toISOString()`.

---

#### SEC-15 · low · frontend/src/App.tsx:163, 231-260
- **What is wrong**:
  The 12,000-character `#s=...` hash remains in the browser address bar throughout student exploration instead of being replaced with a clean path upon successful load, leaving the payload in browser history and screen recordings.
- **Proposed minimal fix**:
  Call `history.replaceState(null, '', '/')` once `resolveShareRoute` successfully resolves the scene into state.

---

## Detailed Validator Drift Analysis (`validateShareScene` vs `backend/app/validate.py`)

| Rule / Feature | `backend/app/validate.py` (Server) | `frontend/src/share/validate.ts` (Client) | Drift Classification |
|---|---|---|---|
| **Out-of-tolerance Coordinates** | Silently repairs by **dropping** invalid points, polyline coords, bars, axes | **Rejects** scene with fatal `errors.push` | **Major Drift** (Breaks valid repair contract) |
| **Colour & Generic Shape Labels** | Strictly rejected (Req 3.6 `_is_colour_shape_only`) | Allowed (check not implemented) | **Minor Drift** (Client more permissive) |
| **Element Caps** | No element count caps (bounded only by LLM prompt) | Enforces 300 pts, 300 segs, 60 bars, 2000 polyline pts | **Intentional** (Offline DoS protection) |
| **Polyline Minimum Points** | Accepts 0 or 1 point if valid schema | Requires `rawPts.length >= 2` | **Minor Drift** (Client stricter) |
| **Facts Array Cap** | Unbounded | Unbounded array length, capped to 280 chars/fact | **Matching** (Both missing array cap) |
| **Extra Keys** | Stripped via Pydantic model validation | Stripped by constructing fresh object literal | **Matching** |
| **Duplicate ID Deduplication** | Appends `_2`, `_3` across elements | Appends `_2`, `_3` across elements | **Matching** |
| **Dangling Segments** | Dropped if endpoints missing | Dropped if endpoints missing | **Matching** |

---

## Sound Areas Confirmed

1. **Zero HTML/Script Injection (XSS)**: All decoded strings (`title`, `verifiedBy`, `note`, `labels`, `facts`) render strictly as React text children or Canvas 2D text via `ctx.fillText()`. No `dangerouslySetInnerHTML` or HTML injection vectors exist.
2. **Offline Zero-Network Privacy**: Opening a shared diagram link (`/#s=...`) executes zero `fetch` calls, skips `warmBackend()`, and does not communicate with any server.
3. **Decompression Bomb Protection**: Decompressed character length is strictly capped (`<= 200,000`) *before* `JSON.parse` is executed.
4. **Prototype Pollution Protection**: `JSON.parse` reviver strips `__proto__`, `constructor`, and `prototype` keys during deserialization.
5. **No `javascript:` or `data:` URL Execution**: The only data URL in the system is an `image/png` generated by `QRCode.toDataURL` for `<img src=...>`, with no decoded strings entering URL execution sinks.
6. **PWA Service Worker Navigation Route**: Workbox precaches only `index.html`; navigation requests to `/#s=...` serve the single cached shell without caching separate hash URLs.

---

## Top 5 to Fix First

1. **SEC-01 (Premature Length Rejection)**: Remove `hash.length > LIMITS.maxHashChars` check in `frontend/src/share/codec.ts:131` so valid 12,000-char payloads wrapped in origin URLs open reliably.
2. **SEC-02 (Unicode Bidi & RTL Override Sanitization)**: Strip `[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]` in `sanitizeString()` and isolate text in `VerifiedBanner.tsx` with `<bdi>`.
3. **SEC-03 (Student Honesty Disclosure)**: Add `t('share.honesty')` ("Verified means a person reviewed this diagram. It is not cryptographic proof") to `VerifiedBanner.tsx` and `SharePanel.tsx`.
4. **SEC-04 (Validator Drift Alignment)**: Align `validateShareScene` coordinate clamping to drop invalid elements rather than rejecting the entire scene.
5. **SEC-05 (Fix `clearHash` History & Hash Bug)**: Remove `loc.hash = ''` from `frontend/src/drivers/hashRoute.ts:65` to prevent trailing `#` history entries.
