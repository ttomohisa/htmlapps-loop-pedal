# Changelog

## Unreleased

- Pending physical-device timing and microphone interruption verification, Japanese/English screenshots, and release gating.

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
