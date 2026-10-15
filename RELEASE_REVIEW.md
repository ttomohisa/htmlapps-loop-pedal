# Loop Pedal — v1.0.0-rc.1 Release Review

Status: **Release candidate / not approved for stable v1.0.0**

## 実機フィードバックと現在のリリース阻害事項（2026-10-15）

ユーザー報告: PCの基本録音、Android Chromeの録音、有線イヤホンでの重ね録り、編集/Undo、日英UIと指定アイコン、音声の外部送信がないことは**実施・確認済み**。録音遅延の数値測定も実施済みとの報告だが、**測定結果の値、環境、補正前後の残差は未共有**であり、LP-AUDIO-09をPASSと判定できない。

未実施/未確認: iPhone Safari、音質とループ継ぎ目、WAVの端末保存と外部プレイヤーでの再生、録音中断復旧、スマホUI全体、Windowsの単一HTMLの `file://` 起動。

### P0 — WAV音質の劣化（利用者から不具合報告あり）

- **状態: FAIL相当・要修正。正式v1.0.0リリース禁止。** 保存されたWAVが録音した音に比べて著しく悪いとの実機報告。
- コード上、WAVはRIFF/PCM16-bit/monoであり、MP3等の非可逆圧縮ではない。常時適用される `Math.tanh(sum * 0.7)` が元波形を変え、4トラック合成時の大振幅では相当な高調波歪みを生じ得る。
- 同じ `Math.tanh` がリアルタイムのミキサーにもあるため、**「保存WAVだけ悪い」場合にはそれだけでは説明できない**。マイク入力の自動補正/実際のトラック設定、ステレオ→モノラル化、ミキシング・ゲイン、WAVエンコード・外部プレイヤーを、同じ音源で段階別に比較する。
- 要対応: 生PCMと再生PCM、書き出しWAVのピーク/RMS/歪み/再生タイミングを比較。常時波形を変えるリミッターを見直し、必要なときだけピークを制御。実再生/WAVが同じ処理を使うこと、クリッピングしないことを回帰試験で確認。
- **判定条件:** 1トラックの声/楽器と4トラックの重ね録りの両方で、アプリ内ループ再生・作成したWAV試聴・外部プレイヤーのWAV再生を比較し、明らかな音質悪化や音割れがない。

### P0調査 — 録音開始が1拍ずれている可能性

- **状態: 未再現・要再測定。** 利用者から「開始が一拍ずれていないか」との報告。
- コードでは最初の録音開始は `4 * round(sampleRate * 60 / BPM)` フレーム後、以降の録音開始は共通ループ位相の次の先頭。現行コードに意図的な1拍オフセットは見当たらない。
- ただし録音開始時に**拍頭の音の合図が鳴らない**こと、マイク入力からWorkletまでの遅延は音声クロックだけで補正できないことがあり、ユーザーの体感や実際の録音オンセットのずれは未否定。
- 要対応: 4クリック→録音開始のサンプル位置を既知パルスで検査。新しいトラックを次ループ境界で記録したオンセットとWAVの先頭を比較。ブラウザ上の拍表示と録音開始のUXも見直す。
- **判定条件:** 内部サンプル時計に1拍分の位相ずれがないことを自動試験で検証し、実機の録音タイミング・ユーザーが聴くクリックとの相対遅延を別途実測する。補正後の有線基準目標は±25ms以内。

### 次に必要な確認・記録

1. ユーザーに**「アプリ内でループ再生した音も悪いのか、WAVだけ悪いのか」**を聞き、同じ録音の1トラック/4トラック、ループ1回/30秒をA/B比較する。
2. 1拍ずれが**最初のカウントイン後か、2トラック目以降の開始か、WAVの先頭か**を特定する。100BPMでは1拍600msであり、±数十msの端末遅延とは区別する。
3. 数値で確認済みと報告された遅延の**端末名・ブラウザ・音声経路・補正前後の測定値**を記録し、合否を判定する。
4. 音質・録音開始問題を修正後、iPhone Safari、WAV実保存/外部再生、画面ロック・着信/マイク切断、スマホUI、`file://`直接起動、残るCSPネットワーク監査を再確認する。

**重要:** ユーザーによる「確認済み」はチェックの実施報告であり、測定数値・証跡が不足する項目を自動的にPASSに変更しない。


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
