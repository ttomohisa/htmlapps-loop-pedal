Loop Pedal / ループペダル
========================

This is a Browser Kitty four-track loop recorder, not the generic HTML starter.

1. Read README.ja.md (or README.md for English).
2. Read AGENTS.md, then APP_SPEC.md and ACCEPTANCE_MATRIX.md before development.
3. Edit src/index.template.html, not generated HTML files.
4. Run node --test tests/loop-pedal.test.cjs to verify the audio clock.
5. On Windows, run build-standalone.bat to build and validate both single-HTML variants.
6. Review dist/build-size-report.json and verify dist/index.html and
   dist/index.self-extract.html (plus loop-pedal.html) on supported browsers.
7. Complete the mobile / microphone / latency / offline verification
   described in ACCEPTANCE_MATRIX.md and VERIFY_OFFLINE.md before release.

Data captured from the microphone remains in memory until a user-initiated
WAV download. It is not automatically recovered after a refresh.

GitHub PR merging is performed by the repository owner.
