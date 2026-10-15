# Loop Pedal — v1.0.0-rc.2 Release Review

Status: **Release candidate / not approved for stable v1.0.0**

## 実機フィードバックとループ切り替わりの再評価（2026-10-15）

- **訂正・取り下げ:** 前回報告された「WAVの全般的な音質劣化」と「録音開始が1拍ずれる」は、利用者から問題がなかったと訂正された。これらを確認済み不具合・リリース阻害要因としては扱わない。追加済み回帰テストは維持する。
- **新しい懸念（聴感未判定）:** ループが切り替わる瞬間にやや違和感がある。利用者が添付したWAVは30秒/48kHz/16-bitモノラルで、4.8秒周期の音声が正確に繰り返されていた。単一サンプルの段差は小さい一方、旧方式と整合する末尾約4msの人工的な振幅の傾きが見つかった。
- **v1.0.0-rc.2 の修正:** 末尾を先頭の値へ引き寄せる方式を廃止。端点差が大きい素材だけで、末尾約4msと先頭約1msの短いフェードを適用し、元のPCMとループ位相を維持する。WAVとアプリ内ループ再生へ同じ補正を適用。拍頭の最初の約1msが僅かに弱くなるトレードオフは実機で聴いて判定する。
- **添付音声の扱い:** 利用者が提供したWAVの解析はローカルで実施し、原音声・派生音声を公開リポジトリへ追加しない。
- **検証状況:** PCの基本録音、Android Chromeでの録音、有線イヤホン重ね録り、編集/Undo、日英UIと指定アイコン、外部送信なしは確認を実施済み。遅延数値測定も実施したとの報告はあるが、測定値/使用機器/補正前後の結果は未共有のため±25ms適合判定を保留。
- **未実施:** iPhone Safari、変更後のループ音質と継ぎ目の試聴、WAVの外部プレイヤー再生、中断復旧、スマホUI全体、Windows `file://` 単一HTML。

### 今回の再確認方法

1. 旧Previewで違和感があった音（手拍子・声など）と同じ素材、同じBPM・小節数で新Previewを録音し、ループ切り替わりを複数周聴く。
2. 1トラックと複数トラック、スピーカーと有線イヤホンで、末尾の違和感・クリック音・拍頭の音量低下がないか比較する。
3. 1ループWAVと30秒WAVを端末内で再生し、アプリ内のループ音との違いがないか確認する。
4. 問題があれば再現条件・端末・録音方式を記録。改善が確認できた後に未実施P0を進める。

**現時点の判定: 改善候補を実装したが、聴感での解消は未確認。stable v1.0.0は未承認。**

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
