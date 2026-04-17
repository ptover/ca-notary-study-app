# California Notary Study App Implementation Plan

> For Hermes: follow strict TDD for all non-trivial JavaScript logic.

Goal: Build a mobile-first California Notary study app, based on the official 2025 California Secretary of State handbook, that can be opened on a phone and used for flashcards, quizzes, and quick review.

Architecture: Create a lightweight installable PWA using plain HTML, CSS, and ES modules so the app is easy to run, easy to ship as files, and usable offline once installed. Store handbook-derived study content in a structured data module and keep quiz/progress logic in a tested study engine module.

Tech Stack: HTML, CSS, vanilla JavaScript (ES modules), Web App Manifest, Service Worker, Node built-in test runner.

---

### Task 1: Create the project skeleton
Objective: Set up a simple static PWA structure for a mobile study app.
Files:
- Create: `/opt/hermes/cal-notary-study-app/index.html`
- Create: `/opt/hermes/cal-notary-study-app/styles.css`
- Create: `/opt/hermes/cal-notary-study-app/manifest.webmanifest`
- Create: `/opt/hermes/cal-notary-study-app/sw.js`
- Create: `/opt/hermes/cal-notary-study-app/package.json`
- Create: `/opt/hermes/cal-notary-study-app/README.md`

### Task 2: Write failing tests for study logic
Objective: Define the quiz scoring and progress behavior before implementing it.
Files:
- Create: `/opt/hermes/cal-notary-study-app/tests/studyEngine.test.mjs`
- Create: `/opt/hermes/cal-notary-study-app/src/lib/studyEngine.mjs`

Steps:
1. Write tests for score calculation, category breakdown, and missed-question reporting.
2. Run `node --test /opt/hermes/cal-notary-study-app/tests/studyEngine.test.mjs` and verify failure.
3. Implement the minimum logic in `studyEngine.mjs`.
4. Run the same test again and verify pass.

### Task 3: Create handbook-based study content
Objective: Turn the official 2025 handbook into structured study material for the app.
Files:
- Create: `/opt/hermes/cal-notary-study-app/src/data/studyData.mjs`
- Source reference: `/opt/hermes/cal-notary-study-app/source/ca-notary-handbook-2025.pdf`
- Source reference: `/opt/hermes/cal-notary-study-app/source/ca-notary-handbook-2025.txt`

Steps:
1. Capture official source metadata and handbook link.
2. Build category summaries for qualifications, identification, journal rules, acknowledgments, jurats, subscribing witnesses, powers of attorney, tangible copy certification, prohibited conduct, and fees.
3. Add flashcards and multiple-choice practice questions tied to those categories.

### Task 4: Build the mobile-first UI
Objective: Implement a clean phone-friendly interface for studying.
Files:
- Modify: `/opt/hermes/cal-notary-study-app/index.html`
- Modify: `/opt/hermes/cal-notary-study-app/styles.css`
- Create: `/opt/hermes/cal-notary-study-app/src/app.mjs`

Steps:
1. Build a mobile-first dashboard with source card, topic chips, study-guide cards, flashcards, quiz mode, and score review.
2. Use localStorage to remember quiz results and flashcard progress.
3. Add handbook quick facts and exam tips.

### Task 5: Make it installable/offline-capable
Objective: Ensure the app behaves like a lightweight phone app.
Files:
- Modify: `/opt/hermes/cal-notary-study-app/manifest.webmanifest`
- Modify: `/opt/hermes/cal-notary-study-app/sw.js`
- Optional assets: app icons if needed

Steps:
1. Cache core files for offline use.
2. Define mobile-friendly manifest metadata.
3. Verify that the app loads cleanly in a browser and can be installed when hosted.

### Task 6: Verify and package
Objective: Confirm the app works and prepare it for handoff.
Files:
- Generate: `/opt/hermes/cal-notary-study-app/cal-notary-study-app.zip`

Steps:
1. Run `node --test /opt/hermes/cal-notary-study-app/tests/studyEngine.test.mjs`.
2. Serve locally and inspect in a browser.
3. Package the project into a zip for delivery.
4. Provide the official handbook URL and the app file paths in the final handoff.
