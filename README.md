CA Notary Study App

A mobile-first California notary study guide built from the official California Secretary of State 2025 Notary Public Handbook.

What is included
- Topic summaries based on the official handbook
- Flashcards for memorization
- Practice quiz questions with explanations
- Local progress tracking in the browser
- PWA manifest and service worker for install/offline behavior when hosted

Official source used
- Handbook page: https://www.sos.ca.gov/notary/handbook
- Direct PDF: https://notary.cdn.sos.ca.gov/forms/notary-handbook-current.pdf

Local project files
- App entry: /opt/hermes/cal-notary-study-app/index.html
- Standalone single-file version: /opt/hermes/cal-notary-study-app/ca-notary-study-app-standalone.html
- Handbook PDF: /opt/hermes/cal-notary-study-app/source/ca-notary-handbook-2025.pdf
- Extracted text: /opt/hermes/cal-notary-study-app/source/ca-notary-handbook-2025.txt

Run locally
1. cd /opt/hermes/cal-notary-study-app
2. python3 -m http.server 4173
3. Open http://127.0.0.1:4173

Test
- node --test tests/studyEngine.test.mjs

Notes
- The California Secretary of State handbook page listed the 2025 handbook as current during this build.
- No 2026 handbook PDF was listed on the official page when this app was created.
- Always confirm final legal details against the official PDF before exam day.
