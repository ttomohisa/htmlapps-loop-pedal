# Changelog

## Unreleased

- Pending physical-device timing and microphone interruption verification, Japanese/English screenshots, and release gating.

## 0.2.0 - Audio engine and four-pad development preview - 2026-10-14

- Initialized Loop Pedal from the current Browser Kitty single-HTML template.
- Added local AudioWorklet-powered sample-frame loop recording and four synchronized mono pads.
- Added four-beat count-in, loop-boundary recording queue, headphone/speaker recording modes, mute, re-record, one-step Undo, gain and manual timing shift.
- Added one-loop / 30-second / 60-second PCM WAV export with editable filename.
- Added Japanese/English UI, microphone permission/recovery guidance, privacy information and deterministic clock tests.
- Retained standalone HTML, embedded canonical favicon, dependency lock, restrictive CSP and template CI pipeline.

**Status:** Development preview only. Hardware latency and mobile browser behavior are not yet verified.
