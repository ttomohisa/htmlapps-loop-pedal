# Changelog

## Unreleased

- Pending physical-device timing, interruption and audio-route verification, real-device download checks, and final stable v1.0.0 approval.

## 1.0.0-rc.1 - Release verification candidate - 2026-10-14

- Captured desktop Japanese, desktop English, and 390px smartphone screenshots from the actual built Loop Pedal UI in Windows Edge, using genuine AudioWorklet recordings from an automated synthetic microphone.
- Added a Chromium DevTools Protocol browser capture script without runtime or npm dependencies. It also checks WAV preview/re-download from the browser's actual recording flow and reports local-file compatibility observations.
- Added release audit tests for Japanese/English UI strings, CSP/no-runtime-network constraints, exact supplied icon bytes, screenshot PNG dimensions and version/document alignment.
- Retained all v0.5.0 recording, offset, headphone/phone capture, Undo, WAV export, preview and cancellation features.
- **Release blockers:** Real iOS/Android microphone and audio route tests, actual wired-headphone latency measurement, audible seam/noise tests, native-file WAV playback/download, and direct file:// support confirmation before stable release.

## 0.5.0 - WAV export and file workflow development preview - 2026-10-14

- Added per-export cancel control and actual WAV conversion progress, without blocking all smartphone input while rendering.
- Added a built-in local preview of exported audio, with a persistent explicit download link for browsers that suppress downloads after asynchronous work.
- Kept preview WAV URLs in memory only and revoked them when recordings, mute/gain/offset, duration or session state invalidate the result.
- Temporarily paused the shared loop during snapshot/export, then restored playback only when it was previously active and had not been interrupted.
- Tightened audio snapshot validation and canceled/failed export cleanup; preserved finished tracks on cancel or errors.
- Hardened file naming against invalid characters, Windows reserved device names, bidi controls and repeated WAV suffixes.
- Extended Node tests to verify RIFF/WAVE PCM headers, sample counts, mute/gain/offset/loop-seam parity, 30/60-second fade-out, limiting and cancellation.
- Remaining release gates: external-player opening of WAV on desktop/iPhone/Android, device latency measurement, acoustic seam listening tests, file:// microphone support and screenshots.

## 0.4.0 - Interaction and recovery development preview - 2026-10-14

- Replaced the canonical `assets/favicon.svg` with the user's supplied 1,321-byte SVG, embedded unchanged in both favicon and header icon through the template build.
- Displayed distinct first-party SVG symbols for empty, queued, recording, playing, muted and paused pads. Added readable aria labels and pressed state for completed tracks.
- Kept Help, track-settings and destructive confirmation dialogs background-scroll-locked with focus-safe close behavior; blocked session reset during active recording.
- Guarded resumed audio requests against stale state, multiple taps, interrupted microphone streams and tab hiding during permission prompts.
- Added explicit microphone-muted guidance; stopped microphone capture on unrecoverable AudioWorklet failure and prompted before a data-losing reload.
- Expanded deterministic audio/UX regression tests and pinned the approved SVG's exact Git blob SHA.
- **Hardware gate still open:** measured input/output latency, actual iPhone/Android audio routes, headphone capture and acoustic seam quality.

## 0.3.0 - Mobile capture quality and UI development preview - 2026-10-14

- Locked background scroll while Help is open and restored the scroll position on close, including iOS-style body locking.
- Updated the Japanese badge to 「完全ローカル処理」, used an application-purpose subtitle, changed the language switch to 「JA」, and hid the footer on smartphones.
- Added non-destructive ~4 ms loop-edge smoothing, preserving the source's first sample and applying the same correction to real-time playback and WAV export.
- Added 5 ms timing adjustment buttons and browser-provided audio diagnostics with an explicit input-latency limitation.
- Ignored events from replaced microphone streams, and suspended safely when an active microphone is muted/ended.
- Extended deterministic engine tests for seam handling, timing/export consistency, interruptions, and 1,000-loop stability.
- **Gate pending:** real iPhone/Android recording, latency measurements, audio quality listening tests, `file://` compatibility, screenshots.

## 0.2.0 - Audio engine and four-pad development preview - 2026-10-14

- Initialized Loop Pedal from the current Browser Kitty single-HTML template.
- Added local AudioWorklet-powered sample-frame loop recording and four synchronized mono pads.
- Added four-beat count-in, loop-boundary recording queue, headphone/speaker recording modes, mute, re-record, one-step Undo, gain and manual timing shift.
- Added one-loop / 30-second / 60-second PCM WAV export with editable filename.
- Added Japanese/English UI, microphone permission/recovery guidance, privacy information and deterministic clock tests.
- Retained standalone HTML, embedded canonical favicon, dependency lock, restrictive CSP and template CI pipeline.

**Status:** Development preview only. Hardware latency and mobile browser behavior are not yet verified.
