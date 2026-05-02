import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serviceWorkerSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('service worker uses a new cache after the 2026 question-bank release', () => {
  assert.match(serviceWorkerSource, /ca-notary-study-app-v6/);
});

test('service worker fetches navigations from the network before cached HTML', () => {
  assert.match(serviceWorkerSource, /event\.request\.mode === 'navigate'/);
  assert.match(serviceWorkerSource, /return fetch\(event\.request\)/);
  assert.match(serviceWorkerSource, /networkResponse\.ok/);
});
