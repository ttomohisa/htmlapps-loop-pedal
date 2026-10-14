# Loop Pedal — v1.0.0-rc.1 Release Review

Status: **Release candidate / not approved for stable v1.0.0**

The source of truth is [APP_SPEC.md](APP_SPEC.md) and [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md). This review separates automated evidence from device testing still required.

## Automated evidence

| Scope | Evidence | Status |
| --- | --- | --- |
| 4-track shared audio engine, count-in, loop boundary, Undo | `tests/loop-pedal.test.cjs` on GitHub Actions | AUTO PASS when current PR CI is green |
| WAV RIFF/PCM header, mono rate/length, loop/30s/60s fade, mute/gain/offset | Deterministic Node tests | AUTO PASS when current PR CI is green |
| HTML metadata, bilingual keys, CSP, user SVG integrity | `tests/release-audit.test.cjs` | AUTO PASS when current PR CI is green |
| Standalone normal + self-extract HTML | Template `scripts/check-repository.ps1` and verification | AUTO PASS when current PR CI is green |
| Desktop Edge headless synthetic mic | Real AudioWorklet recording of two tracks and subsequent WAV creation/preview | BROWSER AUTOMATED; **not physical audio latency** |
| Japanese/English/mobile screenshots | `scripts/capture-screenshots.mjs`, 1360×900 JA/EN, 390×844 mobile | BROWSER AUTOMATED; **not actual phone** |
| Network privacy boundary | `connect-src 'none'`, static scan of runtime resources | STATIC AUTO; DevTools network audit still needed |

Review the latest workflow results and details on [Draft PR #1](https://github.com/ttomohisa/htmlapps-loop-pedal/pull/1). Do not describe unfinished CI as passing.

## Required hands-on checks

Record PASS / FAIL / BLOCKED, device model, OS/browser version, audio input/output route, date, and evidence for each set.

- [ ] **Windows Chrome and Edge over HTTPS:** record first take, then three further takes, mute/unmute, pause/resume, re-record/Undo, and WAV export for one loop/30 s/60 s. Open WAV in a separate audio player.
- [ ] **Windows `file://`:** open both `dist/index.html` and `dist/index.self-extract.html` directly. Verify mic permissions, AudioWorklet, basic loops, and WAV output with network disabled; document unsupported combinations rather than claiming universal offline support.
- [ ] **Android Chrome on a real device:** test microphone permission, 320/360/390px widths, menus, no horizontal scrolling, Help background lock, wired headphones if available, phone-only recording, downloaded WAV and external-player playback.
- [ ] **iPhone Safari on a real device:** repeat Android checks, including the bottom safe area, native file saving and opening. Try wired headphones or a compatible adapter if available.
- [ ] **Real hardware timing:** using a signal fixture rather than hand claps, measure known reference and recorded attack positions with wired headphones. Record the residual error before/after per-track offset; reference target is ±25ms.
- [ ] **Acoustic quality:** record sharp clap/drum attacks and sustained voice/guitar near the loop seam. Listen and inspect for clicks, unnatural fades, feedback, clipping, and distortion in monitoring and WAV output.
- [ ] **Interruption recovery:** test screen lock, tab switching, microphone mute/disconnect, audio route change, and an incoming call where feasible. Incomplete takes must be discarded; committed audio and Undo must remain consistent.
- [ ] **Privacy/network:** after initial HTML load, inspect DevTools with real recording data and confirm no runtime CDN, remote telemetry, API calls, or audio uploads.
- [ ] **Accessible UI and internationalization:** Japanese/English, keyboard/focus, Escape and backdrop, screen-reader labels, 320px no overflow, help dialog reaching its final content, no invisible fixed controls.
- [ ] **Official assets & docs:** verify `assets/favicon.svg` matches the user-approved SVG, all three screenshots are the latest app UI, README/CHANGELOG versions agree, screenshot links work, and no preview environment is indexed accidentally.

## How to report an issue

Include device, OS, browser build, selected recording mode, BPM/bars, exact sequence, expected/actual behavior, screenshot or local audio sample **only if willing to share it**, and whether a retry or reload changed the outcome.

## Release decision

**BLOCKED for stable v1.0.0** until critical device checks above are completed and any significant failures are addressed. A green CI and successful synthetic microphone recording support the release candidate, not the physical-device claims.
