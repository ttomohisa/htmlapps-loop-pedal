# Loop Pedal

Record sounds on four pads, loop each take to the same musical length, layer the tracks, and export a WAV file. Use everyday percussion, voice, guitar, or any sound picked up by your microphone.

> **Development preview v0.3.0** — Improved loop-seam playback, microphone interruption handling, timing controls, and mobile UI. Physical-device latency measurement, Android/iPhone audio-route tests, and release screenshots are still pending. This is not a production release.

[日本語 README](README.ja.md) · [Product specification](APP_SPEC.md) · [Acceptance matrix](ACCEPTANCE_MATRIX.md)

## Features

- Four independent mono tracks, one committed take per pad.
- 40–200 BPM, 4/4, and 1/2/4 bars. Four-beat count-in for the first recording and loop-boundary quantization for later recordings.
- Sample-frame-based recording and a shared audio-clock loop for all tracks.
- Per-pad mute, gain, non-destructive timing adjustment (−200 to +200 ms, 5 ms steps), re-record, and last-recording Undo.
- Short loop-seam smoothing preserving the source's first sample, applied to playback and WAV export.
- Collapsible browser audio diagnostics. These values do **not** constitute an input-latency calibration.
- Export 16-bit mono WAV: one loop, 30 seconds, or 60 seconds. Editable output filename.
- Japanese and English UI. Audio is kept only in browser memory.

## How to use

1. Open the site over HTTPS or load the HTML in a supported browser; choose the tempo, length, and recording mode.
2. Select **Enable microphone** and grant permission. No permission prompt appears on page load.
3. Tap an empty pad. After four count-in beats, it automatically records the selected number of bars and begins looping.
4. Tap another empty pad to queue a recording on the next loop boundary. Tap a recorded pad to mute or unmute it.
5. Use a pad's settings to re-record, adjust gain/timing with ±5 ms buttons or reset, or delete it; the last committed recording can be undone.
6. Choose the export length and filename, then select **Download WAV**.

## Recording modes

**Phone only (default):** Previously recorded tracks and click sounds are silent during capture. This reduces speaker bleed but means you cannot listen to other tracks while recording.

**Layer with headphones:** Other tracks play while recording. Wired headphones are recommended. The microphone input is never monitored directly. Device- and Bluetooth-related latency is not guaranteed to be corrected automatically.

## Privacy and local data

Audio capture, PCM tracks and WAV export run in the browser. No audio is uploaded, automatically synced, or sent to analytics/telemetry. No runtime CDN is used. The generated HTML uses a `connect-src 'none'` Content Security Policy. Takes are kept in memory only and disappear after refresh or closing the page.

## Browser support and limitations

The app requires AudioWorklet, Web Audio API, Blob URL support and microphone permission. Browser/OS policies may require HTTPS or a secure local-file context. Direct `file://` operation, smartphone browsers, headphones, Bluetooth routing, background interruption and recovery still require physical-device verification.

This is not a DAW: no unlimited overdubbing, effects, project persistence or file import. Acoustic latency, loop-boundary noise and speaker bleed remain device-dependent and are release gates.

## Build and development

The repository follows [htmlapps-template](https://github.com/ttomohisa/htmlapps-template). Edit `src/index.template.html`, not generated HTML. On Windows run `build-standalone.bat` or `./scripts/check-repository.ps1`. Regular builds generate:

- `dist/index.html` — readable one-file app
- `dist/index.self-extract.html` — self-extracting one-file variant
- `loop-pedal.html` — root copy of the readable build
- `dist/build-size-report.json` — size report

Run `node --test tests/loop-pedal.test.cjs` for deterministic clock/recording tests. CI also runs the template's standard build checks.

## License

[MIT](LICENSE). No third-party runtime packages are currently used. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
