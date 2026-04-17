# Daily Study + Timed Exam Enhancement Plan

Goal: Upgrade the California Notary study app with a daily study mode, timed exam mode, and a live shareable hosted link.

Architecture: Keep the app static and mobile-first. Add deterministic study-engine helpers for daily set generation and timed-exam summaries, then layer the UI changes into the existing single-page app. Host the finished static app behind a temporary public tunnel.

Tech Stack: HTML, CSS, vanilla JavaScript ES modules, Node test runner, Python local server, public tunnel.

Tasks:
1. Add failing tests for deterministic daily study set generation and timed exam summary logic.
2. Implement the new study-engine helpers with minimal code until tests pass.
3. Update the app UI with a Today card, timed exam controls, countdown display, and score review details.
4. Rebuild the standalone HTML version and zip package.
5. Serve locally, publish a public link, and verify in the browser.
