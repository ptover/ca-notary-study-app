import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('home page has a CalNotaryClass-inspired training hero with original branding', () => {
  assert.match(indexSource, /California Notary Exam Prep Online/);
  assert.match(indexSource, /class="brand-mark"/);
  assert.match(indexSource, /class="hero-illustration"/);
  assert.match(indexSource, /Start studying now/);
});

test('home page highlights trust and access benefits above the study tools', () => {
  assert.match(indexSource, /California focused/);
  assert.match(indexSource, /24\/7 study access/);
  assert.match(indexSource, /Mobile friendly/);
  assert.match(indexSource, /State-style exam prep/);
});

test('home page has a cache-busted app script for the 2026 question-bank release', () => {
  assert.match(indexSource, /src="\.\/src\/app\.mjs\?v=question-bank-2026"/);
  assert.match(indexSource, /href="\.\/styles\.css\?v=training-redesign"/);
  const serviceWorkerSource = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorkerSource, /\.\/src\/app\.mjs\?v=question-bank-2026/);
  assert.match(serviceWorkerSource, /\.\/styles\.css\?v=training-redesign/);
});

test('visual theme uses a friendly teal training-site palette', () => {
  assert.match(stylesSource, /--teal:/);
  assert.match(stylesSource, /--navy:/);
  assert.match(stylesSource, /hero-illustration/);
  assert.match(stylesSource, /trust-card/);
});
