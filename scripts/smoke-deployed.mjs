#!/usr/bin/env node
/**
 * scripts/smoke-deployed.mjs
 *
 * One-command production smoke check for Ghost Touch (Task 25 / Lane hx8).
 * Usage:
 *   node scripts/smoke-deployed.mjs <frontend-url> <api-url>
 *
 * Runs 9 checks against the deployed frontend and backend:
 *   1. GET frontend / is 200 and has CSP, HSTS, nosniff, Referrer-Policy, and Permissions-Policy headers.
 *   2. CSP connect-src contains the origin of <api-url>.
 *   3. GET <api>/api/v1/health is {"ok":true} within 70s (cold start) and has x-content-type-options: nosniff.
 *   4. OPTIONS <api>/api/v1/ask with Origin: <frontend-url> returns that origin in access-control-allow-origin.
 *   5. OPTIONS <api>/api/v1/ask with Origin: https://example.invalid does not return that origin.
 *   6. GET <api>/docs is 404.
 *   7. POST <api>/api/v1/scene with a 10-byte text file as "image" is 415.
 *   8. GET frontend /samples/triangle.json parses as JSON with kind "geometry".
 *   9. GET /sw.js is 200 with no-cache.
 *
 * Exit code: 0 if all checks pass, 1 if any check fails.
 * Node 22, no external dependencies, uses global fetch.
 */

const frontendArg = process.argv[2];
const apiArg = process.argv[3];

if (!frontendArg || !apiArg) {
  console.error('Usage: node scripts/smoke-deployed.mjs <frontend-url> <api-url>');
  process.exit(1);
}

const frontendUrl = frontendArg.trim().replace(/\/+$/, '');
const apiUrl = apiArg.trim().replace(/\/+$/, '');

let frontendOrigin;
let apiOrigin;
try {
  frontendOrigin = new URL(frontendUrl).origin;
} catch {
  console.error(`Error: invalid frontend URL: "${frontendArg}"`);
  process.exit(1);
}

try {
  apiOrigin = new URL(apiUrl).origin;
} catch {
  console.error(`Error: invalid API URL: "${apiArg}"`);
  process.exit(1);
}

console.log(`Smoke testing Ghost Touch production deployment:`);
console.log(`  Frontend: ${frontendUrl} (origin: ${frontendOrigin})`);
console.log(`  API:      ${apiUrl} (origin: ${apiOrigin})\n`);

let passedCount = 0;
let failedCount = 0;

function report(name, passed, detail = '') {
  if (passed) {
    passedCount++;
    console.log(`PASS: ${name}`);
  } else {
    failedCount++;
    const extra = detail ? ` (${detail})` : '';
    console.log(`FAIL: ${name}${extra}`);
  }
}

let frontendCsp = '';

// Check 1: GET frontend / is 200 and has the CSP, HSTS, nosniff, Referrer-Policy and Permissions-Policy headers
try {
  const res = await fetch(`${frontendUrl}/`);
  if (res.status !== 200) {
    report('GET frontend / is 200 and has security headers', false, `HTTP ${res.status}`);
  } else {
    frontendCsp = res.headers.get('content-security-policy') || '';
    const hsts = res.headers.get('strict-transport-security');
    const nosniff = res.headers.get('x-content-type-options');
    const referrer = res.headers.get('referrer-policy');
    const permissions = res.headers.get('permissions-policy');

    const missing = [];
    if (!frontendCsp) missing.push('Content-Security-Policy');
    if (!hsts) missing.push('Strict-Transport-Security');
    if (!nosniff || !nosniff.toLowerCase().includes('nosniff')) {
      missing.push('X-Content-Type-Options: nosniff');
    }
    if (!referrer) missing.push('Referrer-Policy');
    if (!permissions) missing.push('Permissions-Policy');

    if (missing.length === 0) {
      report('GET frontend / is 200 and has CSP, HSTS, nosniff, Referrer-Policy, and Permissions-Policy headers', true);
    } else {
      report('GET frontend / is 200 and has CSP, HSTS, nosniff, Referrer-Policy, and Permissions-Policy headers', false, `missing or invalid headers: ${missing.join(', ')}`);
    }
  }
} catch (err) {
  report('GET frontend / is 200 and has CSP, HSTS, nosniff, Referrer-Policy, and Permissions-Policy headers', false, err.message);
}

// Check 2: the CSP connect-src contains the origin of <api-url>
try {
  if (!frontendCsp) {
    const res = await fetch(`${frontendUrl}/`);
    frontendCsp = res.headers.get('content-security-policy') || '';
  }

  const directives = frontendCsp.split(';').map((d) => d.trim());
  const connectDirective = directives.find((d) => d.startsWith('connect-src'));

  if (!connectDirective) {
    report(`CSP connect-src contains the origin of <api-url> (${apiOrigin})`, false, 'no connect-src directive found in CSP');
  } else {
    const tokens = connectDirective.split(/\s+/).slice(1);
    if (tokens.includes(apiOrigin) || connectDirective.includes(apiOrigin)) {
      report(`CSP connect-src contains the origin of <api-url> (${apiOrigin})`, true);
    } else {
      report(`CSP connect-src contains the origin of <api-url> (${apiOrigin})`, false, `connect-src is "${connectDirective}"`);
    }
  }
} catch (err) {
  report(`CSP connect-src contains the origin of <api-url> (${apiOrigin})`, false, err.message);
}

// Check 3: GET <api>/api/v1/health is {"ok":true} within 70 s (cold start) and has x-content-type-options: nosniff
const healthUrl = `${apiUrl}/api/v1/health`;
const deadline = Date.now() + 70_000;
let healthPassed = false;
let healthDetail = '';

while (Date.now() < deadline) {
  const remainingMs = Math.max(1000, deadline - Date.now());
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), remainingMs);

  try {
    const res = await fetch(healthUrl, { signal: controller.signal });
    if (res.status === 200) {
      const data = await res.json().catch(() => null);
      const nosniff = res.headers.get('x-content-type-options');
      const hasNosniff = Boolean(nosniff && nosniff.toLowerCase().includes('nosniff'));

      if (data && data.ok === true && hasNosniff) {
        healthPassed = true;
        break;
      } else {
        const issues = [];
        if (!data || data.ok !== true) issues.push(`data=${JSON.stringify(data)}`);
        if (!hasNosniff) issues.push(`x-content-type-options="${nosniff}"`);
        healthDetail = issues.join(', ');
      }
    } else {
      healthDetail = `HTTP ${res.status}`;
    }
  } catch (err) {
    healthDetail = err?.message || String(err);
  } finally {
    clearTimeout(timeoutId);
  }

  if (Date.now() + 2000 < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } else {
    break;
  }
}

report(
  'GET <api>/api/v1/health is {"ok":true} within 70 s (cold start) and has x-content-type-options: nosniff',
  healthPassed,
  healthDetail
);

// Check 4: OPTIONS <api>/api/v1/ask with Origin: <frontend-url> and Access-Control-Request-Method: POST
// returns that origin in access-control-allow-origin
try {
  const res = await fetch(`${apiUrl}/api/v1/ask`, {
    method: 'OPTIONS',
    headers: {
      'Origin': frontendOrigin,
      'Access-Control-Request-Method': 'POST',
    },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  if (allowOrigin === frontendOrigin) {
    report(
      'OPTIONS <api>/api/v1/ask with Origin: <frontend-url> returns that origin in access-control-allow-origin',
      true
    );
  } else {
    report(
      'OPTIONS <api>/api/v1/ask with Origin: <frontend-url> returns that origin in access-control-allow-origin',
      false,
      `expected "${frontendOrigin}", got "${allowOrigin}" (HTTP ${res.status})`
    );
  }
} catch (err) {
  report(
    'OPTIONS <api>/api/v1/ask with Origin: <frontend-url> returns that origin in access-control-allow-origin',
    false,
    err.message
  );
}

// Check 5: the same with Origin: https://example.invalid does not
try {
  const res = await fetch(`${apiUrl}/api/v1/ask`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.invalid',
      'Access-Control-Request-Method': 'POST',
    },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  if (allowOrigin !== 'https://example.invalid') {
    report(
      'OPTIONS <api>/api/v1/ask with Origin: https://example.invalid does not return that origin in access-control-allow-origin',
      true
    );
  } else {
    report(
      'OPTIONS <api>/api/v1/ask with Origin: https://example.invalid does not return that origin in access-control-allow-origin',
      false,
      `unauthorized origin was reflected: "${allowOrigin}"`
    );
  }
} catch (err) {
  report(
    'OPTIONS <api>/api/v1/ask with Origin: https://example.invalid does not return that origin in access-control-allow-origin',
    false,
    err.message
  );
}

// Check 6: GET <api>/docs is 404
try {
  const res = await fetch(`${apiUrl}/docs`);
  if (res.status === 404) {
    report('GET <api>/docs is 404', true);
  } else {
    report('GET <api>/docs is 404', false, `expected HTTP 404, got ${res.status}`);
  }
} catch (err) {
  report('GET <api>/docs is 404', false, err.message);
}

// Check 7: POST <api>/api/v1/scene with a 10-byte text file as "image" is 415
try {
  const form = new FormData();
  // Exactly 10 bytes: '0123456789'
  const textBytes = new TextEncoder().encode('0123456789');
  const file = new Blob([textBytes], { type: 'text/plain' });
  form.append('image', file, 'test.txt');

  const res = await fetch(`${apiUrl}/api/v1/scene`, {
    method: 'POST',
    body: form,
  });
  if (res.status === 415) {
    report('POST <api>/api/v1/scene with a 10-byte text file as "image" is 415', true);
  } else {
    report(
      'POST <api>/api/v1/scene with a 10-byte text file as "image" is 415',
      false,
      `expected HTTP 415, got ${res.status}`
    );
  }
} catch (err) {
  report('POST <api>/api/v1/scene with a 10-byte text file as "image" is 415', false, err.message);
}

// Check 8: GET frontend /samples/triangle.json parses as JSON with kind "geometry"
try {
  const res = await fetch(`${frontendUrl}/samples/triangle.json`);
  if (res.status !== 200) {
    report('GET frontend /samples/triangle.json parses as JSON with kind "geometry"', false, `HTTP ${res.status}`);
  } else {
    const data = await res.json().catch(() => null);
    if (data && data.kind === 'geometry') {
      report('GET frontend /samples/triangle.json parses as JSON with kind "geometry"', true);
    } else {
      report(
        'GET frontend /samples/triangle.json parses as JSON with kind "geometry"',
        false,
        `kind was "${data?.kind}" (expected "geometry")`
      );
    }
  }
} catch (err) {
  report('GET frontend /samples/triangle.json parses as JSON with kind "geometry"', false, err.message);
}

// Check 9: GET /sw.js is 200 with no-cache
try {
  const res = await fetch(`${frontendUrl}/sw.js`);
  if (res.status !== 200) {
    report('GET /sw.js is 200 with no-cache', false, `HTTP ${res.status}`);
  } else {
    const cc = res.headers.get('cache-control') || '';
    if (cc.toLowerCase().includes('no-cache')) {
      report('GET /sw.js is 200 with no-cache', true);
    } else {
      report('GET /sw.js is 200 with no-cache', false, `cache-control "${cc}" missing "no-cache"`);
    }
  }
} catch (err) {
  report('GET /sw.js is 200 with no-cache', false, err.message);
}

console.log(`\nSummary: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
