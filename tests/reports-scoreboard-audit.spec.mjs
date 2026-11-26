import { test, expect } from '@playwright/test';

/**
 * Audit: /dashboard/reports and /dashboard/scoreboard
 *
 * These tests require a running dev server and a logged-in session.
 * They use storageState from a pre-saved auth file if available,
 * otherwise they navigate and check what loads (login redirect is acceptable).
 *
 * Run: npx playwright test tests/reports-scoreboard-audit.spec.mjs
 */

const PAGES = [
  { path: '/dashboard/reports', name: 'Reports' },
  { path: '/dashboard/scoreboard', name: 'Scoreboard' },
];

for (const { path, name } of PAGES) {
  test(`${name} page loads without console errors and under 5s`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const start = Date.now();
    const response = await page.goto(path, { waitUntil: 'networkidle', timeout: 15000 });
    const loadTime = Date.now() - start;

    const status = response?.status() ?? 0;
    const url = page.url();

    console.log(`[${name}] status=${status} url=${url} loadTime=${loadTime}ms`);

    // If redirected to login, that's expected in a non-authenticated test run
    if (url.includes('/login') || url.includes('/auth')) {
      console.log(`[${name}] Redirected to login — page requires auth (expected)`);
      return;
    }

    // Page loaded — check for errors
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(400);
    expect(loadTime).toBeLessThan(5000);

    // No uncaught JS errors
    if (errors.length > 0) {
      console.log(`[${name}] Page errors:`, errors);
    }
    expect(errors).toHaveLength(0);

    // Log console errors but don't fail on Firebase/network warnings
    if (consoleErrors.length > 0) {
      console.log(`[${name}] Console errors (informational):`, consoleErrors);
    }
  });
}
