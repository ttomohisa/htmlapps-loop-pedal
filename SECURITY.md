# Loop Pedal Security Policy

## Supported versions

Security fixes target the latest development or released version in the repository.

## Reporting security issues

Do not expose sensitive vulnerability details in public issues. Use private
security reporting when available, including reproduction steps, affected
commit/version and expected/actual behavior.

## Trust model

Loop Pedal is a static single-HTML application and has no audio backend.
Audio comes from a microphone that is requested only after user action.
Capture and mixing take place in the browser's Web Audio/AudioWorklet environment.
Completed tracks are held in memory, with no automatic persistence or remote upload.
The user explicitly starts any WAV download.

The runtime Content Security Policy retains `connect-src 'none'`, and there
are no runtime CDN assets, remote fonts, analytics or telemetry. The local
AudioWorklet source is embedded in the generated HTML and loaded using a Blob URL;
its ability to load in direct `file://` contexts must be tested per browser.

The template's pinned dependency mechanism, lockfile and build verification are
retained. No third-party runtime packages are currently required.

## Key safety behaviors

- Handle microphone denial and device disconnect without erasing finished takes.
- On interruption, cancel the uncommitted take; never resume recording silently. The microphone remains blocked while its track is muted/ended, or while the page is hidden during permission handling.
- If the AudioWorklet processor fails unrecoverably, stop microphone capture, disable recording/export actions that require the failed processor, and confirm before reloading a session containing unsaved audio.
- Recording buffers are allocated to the fixed loop length, controlled by BPM/bars.
- Undo and the previous take are retained until a new successful commit or deletion.
- Require explicit confirmation before permanently deleting one or all tracks.
- Generate WAV only after a user gesture. Protect output filenames against path
  separators, Windows-reserved device stems, unsafe controls and Unicode
  bidirectional override characters.
- WAV output is held in a local Blob URL for preview/re-download. Revoke it
  when the source is changed, a new export supersedes it, or the page unloads.
  Audio preview never sends recorded data to external services.
- Export cancellation must discard only its temporary output, not completed
  recording PCM or the previous take used by Undo. The app cannot detect
  whether the operating system has actually finished saving a download.
- Revoke Blob URLs and stop audio tracks when leaving the page.
- Avoid claiming that microphone permissions or audio-routing behavior are
  universal across browsers and devices.

A downloaded HTML file executes code. Obtain it from a trusted source and
review or verify it before use in sensitive environments.
