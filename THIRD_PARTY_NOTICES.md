# Third-Party Notices

Loop Pedal currently contains no third-party runtime libraries.
Its audio recorder, mixer, and PCM WAV encoder use browser-native APIs
and first-party JavaScript only.

System fonts and browser APIs are provided by the user's device.
The repository build and CI infrastructure retains the HTML-app template's
pinning/checking procedures for any future dependencies.

If dependencies are introduced, add exact versions to `dependencies.json`,
update `dependencies.lock.json` with the template scripts and record
licensing/attribution here.
