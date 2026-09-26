# Savewave Reliability and Maintainability Plan

## Goal

Make Savewave a small, strong, organized product that one JavaScript/TypeScript-focused developer can understand, verify, update, and repair without maintaining the same behavior in Rust, Kotlin, and TypeScript.

The primary product has two equally supported clients: **Windows desktop and Android APK**. Product behavior, interface logic, provider policy, Spotify matching, errors, and tests use one application language: **TypeScript**. Platform-native code is permitted only as a tiny operating-system bridge where Android cannot perform the work from TypeScript.

Current product scope (2026-09-26): Instagram, Facebook, and X/Twitter are disabled on both clients and removed from the supported-source interface after repeated installed-client failures. Their URLs remain recognizable solely for a clear unsupported-source response. Older sprint notes below document historical implementation work, not a current support promise. Reconsider a provider only after representative public post, photo, Reel/video, and save flows pass on both packaged Windows and installed Android without accounts, proxies, or manual intervention.

Release update (2026-09-26): v1.0.13 adds checksum-verified, GitHub-asset-pinned automatic Windows installer staging and native Android update checking. The Windows release workflow now packages Electron, not the rollback Tauri client. Deterministic checks and local production builds pass; the local Android release APK is unsigned without the private release keystore. Publishing, an installed v1.0.12-to-v1.0.13 upgrade, real-device output checks, and removal of the rollback tree remain explicit evidence gates. See `docs/QUALITY_BASELINE.md` and `docs/RELEASE_CHECKLIST.md`.

“Flawless” and “fully accurate” are product goals, not honest absolute guarantees. Savewave depends on third-party sites that can change or reject requests at any time. The engineering promise is therefore:

- deterministic behavior for inputs under Savewave's control;
- no known incorrect Spotify match in the maintained regression set;
- safe rejection when identity is uncertain;
- measured success rates for live providers;
- fast detection when an upstream provider changes;
- actionable errors instead of silent or misleading failure; and
- release claims backed by packaged-product evidence.

## Current position

Savewave currently has four relevant layers:

1. A React interface in `public/app.jsx`.
2. Shared TypeScript and JavaScript for source detection, media contracts, Spotify matching, history, and provider resolution.
3. A Rust/Tauri desktop backend that launches bundled yt-dlp and FFmpeg processes.
4. A Kotlin Android plugin that independently manages yt-dlp, FFmpeg, networking, Spotify metadata transport, Instagram galleries, downloads, updates, storage, and jobs.

The main maintainability problem is not simply the use of Rust or Kotlin. It is that behavior is duplicated across the desktop and Android implementations, while the normal CI pipeline does not prove that the Android application can resolve and download real media.

## Sprint status — foundation slice

Started on 2026-09-21. This is migration infrastructure, not release parity yet.

- **Verified:** ESLint now checks JavaScript, JSX, React hooks, TypeScript, Node scripts, and tests; the combined quality gate passes.
- **Verified:** the unused Kotlin Spotify scoring/matching implementation was removed; the transitional Kotlin module and Rust compatibility tests still compile/pass.
- **Verified:** an Electron main/preload foundation uses context isolation, a typed allowlisted IPC boundary, shared URL validation/resolution, job cancellation, yt-dlp/FFmpeg execution, safe output paths, and successful development and packaged-engine smoke checks. An NSIS installer is produced successfully.
- **Verified:** a Capacitor Android project preserves package/version identity and assembles a debug APK.
- **In progress:** pull-request CI now builds the legacy Android client and the Capacitor shell, but Android lint/unit tests and emulator/device scenarios still need to be added and proven in remote CI.
- **Not release-ready:** the Capacitor `SavewaveMedia` bridge builds but installed-device behavior is unverified; Electron install/update and interactive download behavior are also unverified, and provider parity is still pending.
- **Security note:** the production dependency audit is clean. A development-only advisory remains in Capacitor CLI's `xcode`/`uuid` chain; its offered automated fix is a forced CLI downgrade, so it is tracked instead of being applied blindly.

### Sprint 2 status — functional Android bridge

Implemented on 2026-09-21. This makes the Capacitor APK an operational migration client, but real-device/provider parity remains a release gate.

- **Verified in source/build:** the Capacitor `SavewaveMedia` plugin is registered and implements engine status, capabilities, resolve, download jobs, progress, cancellation, temporary-file cleanup, private-network rejection, stable error codes, and MediaStore publication.
- **Verified:** shared TypeScript now owns the format and retry policy consumed by Electron and Capacitor; Android validates the received plan but does not select provider formats itself.
- **Verified:** focused Android unit tests, Android lint, Capacitor sync, and debug APK assembly pass.
- **Verified:** shared UI-safe error categories now distinguish forbidden/not-found/rate-limited/network/timeout/extractor/FFmpeg/storage/cancelled failures. Electron no longer forwards raw yt-dlp output or private paths into ordinary UI errors; Android returns the same public categories.
- **Measured and improved:** the first universal functional APK was about 213 MB because it contained three native engine architectures. ABI-specific packaging is enabled so users receive only their device architecture; final signed release sizes remain to be measured.
- **Verified:** CI is configured to run Capacitor unit tests, lint, and APK assembly in addition to the transitional Tauri Android build.
- **Still pending:** no Android device was attached and no configured Android Virtual Device was available, so engine initialization, real provider resolution/downloads, progress, cancellation, lifecycle recreation, MediaStore visibility, and install-over-upgrade behavior are not yet verified.
- **Deliberate rollback:** the Tauri/Rust Android implementation remains until installed Capacitor evidence passes the replacement gate.

### Sprint 3 status — Spotify identity hardening

Started on 2026-09-21. This improves safe automatic matching; it does not claim perfect Spotify accuracy.

- **Verified:** Spotify public metadata is size-bounded and runtime-validated before scoring. Required identity fields, artist lists, duration ranges, dates, ISRC shape, artwork/preview URLs, and provenance are normalized explicitly.
- **Verified:** missing explicitness remains unknown instead of being misrepresented as a clean track; malformed oEmbed JSON no longer discards a valid embed response.
- **Verified:** search remains song-first and now adds a bounded album/release-year stage when catalog evidence exists. Malformed, duplicate, oversized, and excessive candidate sets are rejected or bounded before scoring.
- **Verified in source/build:** the Capacitor client now routes Spotify through the same TypeScript metadata, YouTube Music search, scoring, confidence, and fallback authority as desktop. Android exposes only a bounded generic yt-dlp search transport; it contains no Spotify scoring algorithm.
- **Verified:** the benchmark distinguishes automatic matches from safe rejections/failures and explicitly reports wrong-match correctness as unknown without labelled ground truth.
- **Verified in deterministic tests/builds:** a near tie now produces a bounded two-option decision instead of an automatic match. The shared UI labels both recordings with creator and duration and requires an explicit click before enabling download; Electron and Capacitor carry the same decision contract.
- **Live probe on 2026-09-21:** three fixture tracks produced three automatic matches with equivalent shared-core decisions in roughly 3.1 seconds average. This proves current transport availability for that tiny sample, not that every selected recording was correct.
- **Verified in source/build:** an explicit Spotify choice is stored locally by track ID only, capped at 50 entries, and reused only when that exact source remains one of the current safe options; full Spotify URLs and query parameters are not retained.
- **Verified:** the obsolete server-only Spotify scorer, normalizer, trust gate, and their self-referential tests were removed. All clients now use one shared matcher; its behavior suite retains wrong-artist/version/duration/ISRC, Unicode, catalogue-title, authority, ambiguity, and credited-owner regression cases.
- **Verified:** shared runtime contracts now validate download commands plus resolved media, jobs, progress, capabilities, engine status, and release information returned across Electron IPC and Capacitor. Invalid URLs, modes, states, IDs, numeric bounds, platforms, fallback lists, and choice payloads fail closed before entering UI state.
- **Verified in deterministic tests/builds:** the Capacitor regression that forced every Instagram URL through `--no-playlist` and published only one file is removed. Shared policy permits up to 20 items only for Instagram; Android downloads and publishes every bounded output in playlist order, Electron uses the same policy, and completion reports the saved item count.
- **Verified:** download polling, fallback attempts, cancellation ownership, stale resolver rejection, and terminal cleanup moved from the React component into a shared bounded controller with deterministic success, retry, non-retry, cancellation, timeout, and late-result tests.
- **Still pending:** installed-device proof that Capacitor's native HTTP transport and chooser work with Spotify/YouTube Music, a labelled multilingual ground-truth corpus, wrong-match measurement, richer shortlist enrichment, and a larger scheduled live run.

### Final deterministic sprint status

Implemented on 2026-09-21. Manual installed-client verification is intentionally assigned to the maintainer and remains a release gate.

- **Verified:** the Android Instagram single-item bug was removed at its source: Instagram alone receives bounded playlist expansion, every completed output is published, numbered filenames preserve order, and other providers stay single-item.
- **Verified:** the shared download controller owns polling, fallback, cancellation, timeouts, stale-result rejection, and cleanup instead of duplicating this orchestration in the React component.
- **Verified:** `npm run check` now enforces risk-focused coverage, generated-asset freshness, typechecking, lint, deterministic tests, production builds, and release metadata.
- **Verified:** authoritative/current architecture documentation replaces the obsolete Tauri-as-target description, and generated versus source ownership is explicit.
- **Prepared for manual verification:** `docs/MANUAL_TEST_MATRIX.md` gives the required Android Instagram regression, provider parity, lifecycle, upgrade, accessibility, and release checks.
- **Still gated by manual/external evidence:** installed Android and packaged Windows transfers, real-provider behavior, signing/upgrades, remote CI, and removal of rollback Tauri/Rust/Kotlin code.

## Chosen simple architecture

The decided final architecture supports **Windows and Android from one shared TypeScript product core**:

```text
Shared React interface + TypeScript core
                  |
          Typed MediaEngine contract
             /                 \
Windows: Electron/Node     Android: Capacitor
yt-dlp + FFmpeg binaries   tiny Java engine bridge
```

The repository should have four obvious areas, not many overlapping layers:

```text
src/ui        shared React screens and components
src/core      shared detection, policies, Spotify matching, state, errors
src/desktop   Electron/Node process, jobs, filesystem, updater, IPC
src/android   TypeScript Capacitor adapter only
android       minimal Java bridge required by the Android operating system
tests         unit, contract, integration, packaged/device smoke, fixtures
```

### Why this is the simplest fit

- React and TypeScript match the languages used most often across the owner's projects.
- Node can launch yt-dlp and FFmpeg directly, so the Rust command layer is unnecessary after migration.
- One error model, one download policy, one Spotify matcher, and one job contract serve both primary clients.
- Electron has mature packaging, process, filesystem, update, and diagnostic tooling.
- Capacitor reuses the existing web React interface instead of requiring a React Native UI rewrite.
- Android keeps Kotlin only for operations that genuinely require the Android runtime: initializing yt-dlp/FFmpeg, executing/cancelling jobs, and publishing files through MediaStore.
- A larger Windows installer and higher idle memory use are accepted in exchange for a much smaller maintenance surface. Electron is not the lightest binary; it is the simplest realistic Windows architecture for this maintainer.

### Deliberate platform scope

- **Primary supported products:** Windows desktop and Android APK, with explicit feature parity unless a platform limitation is documented.
- **Website:** lightweight product/install/documentation page only.
- **Android APK:** migrate from the Tauri mobile shell to Capacitor while reusing the shared React/TypeScript UI and core. Preserve the existing package identity, signing key, safe upgrade path, local data where feasible, and MediaStore behavior.
- **iPhone:** not part of the full downloader target. React Native does not make the Android yt-dlp engine portable, and App Store/provider restrictions remain regardless of UI technology.
- **Future iOS:** reconsider only as a separately scoped, authorized-media product after legal and technical feasibility is proven.

This scope removes Rust completely and prevents Kotlin from becoming a second application backend. TypeScript owns all decisions; Kotlin is a narrow Android device adapter.

## Simplicity rules

- One repository, two primary clients, one shared application language.
- One source of truth for every business rule.
- No microservices, monorepo framework, plugin framework, dependency injection container, event bus, or internal package maze unless a measured problem requires it.
- Prefer plain functions and small modules over class hierarchies.
- Use a state machine only for the download lifecycle where temporal correctness justifies it.
- Add a dependency only when it removes more maintenance than it introduces.
- Keep provider-specific behavior behind small adapters; keep identity, retry, error, and filename policy shared.
- Kotlin must not contain provider matching, scoring, user-facing policy, retries, filenames, or duplicated error semantics. It accepts validated typed commands and returns typed results.
- Delete replaced code promptly after parity and rollback evidence exists.
- Do not preserve a platform merely to claim a larger platform list.

## Phase 0: Establish measurable baselines

- Record the current supported operating systems, providers, URL shapes, and intentional limitations.
- Create a reproducible provider matrix covering YouTube, Instagram, Facebook, Threads, X/Twitter, SoundCloud, Spotify, and direct media.
- For every provider, include resolve, download, cancellation, filename, error, and multi-item behavior where applicable.
- Record packaged Windows and installed Android results separately.
- Measure cold launch, resolve time, download completion rate, memory use, installer/APK size, and failure categories.
- Do not treat mocked unit tests or a successful build as proof that live provider downloads work.

### Exit criteria

- A checked-in, privacy-safe regression corpus exists.
- Desktop and Android failures can be compared using the same scenario identifiers.
- Every claimed supported capability has an explicit verification method.

## Phase 1: Stabilize both existing clients before migration

### 1.1 Contain Android product logic before replacing its shell

- Fix confirmed security, data-loss, startup, update, and download-breaking defects.
- Remove proven-dead Kotlin Spotify ranking code.
- Add Android build/test coverage so maintenance changes cannot silently break it.
- Move every portable decision into the shared TypeScript core before changing the mobile shell.
- Define the minimal native bridge contract: initialize the engine, report versions, execute structured jobs, stream progress, cancel, and publish through MediaStore.
- Do not add new Kotlin provider rules or a large native framework.

### 1.2 Stop policy drift during the transition

- Define the final TypeScript download policy for item limits, formats, retries, timeouts, filenames, and errors.
- Add parity tests for current clients only where necessary to prevent regressions during migration.
- Do not build an elaborate cross-language policy-generation system.
- Implement the final policy once in TypeScript and pass resolved job instructions to thin platform adapters.

### 1.3 Make engine updates safe

- Separate application startup from the network update attempt.
- Prefer the bundled engine when it meets a declared compatibility floor.
- Do not make a temporary update-server or certificate failure disable a usable bundled engine.
- Store the installed version, bundled version, last update result, and last successful live check separately.
- Present an actionable diagnostic message instead of a generic unavailable state.
- Keep updates signed or otherwise integrity-verified before activation.

### 1.4 Improve failures and diagnostics

- Use stable categories for invalid URL, unsupported source, private/login-gated media, 403, 404, 429, timeout, DNS/network failure, extractor incompatibility, FFmpeg failure, storage failure, cancellation, and unknown failure.
- Mark only safe transient categories as retryable.
- Keep raw provider output out of ordinary UI messages.
- Add a user-triggered diagnostic export containing app version, platform, engine versions, operation stages, normalized error codes, and redacted logs.
- Never include pasted private URLs, cookies, tokens, or personal filesystem paths in exported diagnostics.

### 1.5 Reduce UI state fragility

- Move resolve/download orchestration out of the large `public/app.jsx` component into small hooks or controllers.
- Use an explicit state machine for resolve, preview, download, processing, completion, cancellation, and failure.
- Make aborting an earlier resolve distinguishable from a real timeout.
- Stop polling immediately after terminal states and when components unmount.
- Preserve current history and privacy behavior.

### Exit criteria

- Existing checks remain green during migration.
- Android compiles and runs its focused tests while it is supported.
- The existing packaged Windows and installed Android builds have a recorded baseline before replacement work begins.
- Instagram single-image, Reel/video, carousel, and unavailable/private cases have platform-specific evidence.
- Engine-update failure no longer prevents use of a sufficiently recent bundled engine.

## Phase 2: Strengthen Spotify Smart Match

### 2.1 Improve metadata acquisition

- Use bounded fallback methods for public Spotify metadata.
- Preserve the title, primary and featured artists, album, duration, explicit state, release year, artwork, and ISRC whenever reliably available.
- Mark missing fields as missing; never treat missing evidence as a positive match.
- Validate and normalize each transport response before scoring.

### 2.2 Improve search and candidate enrichment

- Search the exact title with all credited artists first.
- Retry with the primary artist, album, or release year only when needed.
- Search structured YouTube Music songs before videos and generic YouTube results.
- Fetch richer metadata for a bounded shortlist instead of trusting flat search results alone.
- Deduplicate candidates by stable media identity.
- Retry only transient transport failures with bounded exponential backoff and jitter.

### 2.3 Improve selection safety

- Score title, primary artist, featured artists, album, duration, ISRC, explicit state, and recording/version markers independently.
- Require both a minimum confidence score and a meaningful margin over the runner-up.
- Reject unexpected live, remix, cover, slowed, sped-up, karaoke, instrumental, clean, acoustic, remastered, and lyric variants.
- Do not use views, popularity, or upload rank as identity evidence.
- Continue to fail closed when evidence is weak or contradictory.

### 2.4 Add a controlled ambiguity flow

- When automatic matching cannot distinguish two strong candidates, show a small candidate chooser instead of downloading a likely-wrong recording.
- Clearly label version, creator, duration, and source.
- Store an explicit user choice locally so the same track can resolve consistently later.
- Never silently weaken the automatic confidence threshold.

### 2.5 Measure the matcher honestly

- Expand the benchmark across Hindi, Punjabi, English, transliterated titles, collaborations, soundtrack suffixes, remixes, regional restrictions, and unavailable tracks.
- Report correct automatic matches, safe rejections, wrong matches, metadata failures, and search failures separately.
- Treat a wrong automatic match as more serious than a safe rejection.
- Run deterministic fixtures in CI and scheduled live checks outside the blocking unit-test gate.

### Exit criteria

- Windows and Android use the same TypeScript matching authority; Android transport must not own a second decision algorithm.
- No known incorrect match exists in the regression corpus.
- Live results are reported as time-sensitive measurements rather than claims of perfection.
- Ambiguous cases have a useful user path without unsafe automatic selection.

## Phase 3: Build the simple TypeScript desktop application

Build the Electron application as a controlled replacement for Tauri/Rust, with rollback available until parity is proven.

- Reuse the existing React interface and shared TypeScript core.
- Implement a typed Electron IPC boundary with a strict command allowlist.
- Spawn only bundled yt-dlp and FFmpeg binaries using structured argument arrays.
- Reproduce URL validation, private-network protection, progress, cancellation, temporary job isolation, safe filenames, Downloads-folder output, and cleanup.
- Reproduce the update notification flow without silently executing installers.
- Package and test a Windows installer.
- Compare memory use, cold start, installer size, download reliability, security surface, and maintenance complexity against the Tauri build.

### Replacement gate

Replace Tauri/Rust only when Electron:

- passes the same security and provider matrix;
- keeps all application behavior in TypeScript and demonstrates that this maintenance benefit justifies its larger runtime and memory footprint;
- has reliable packaged-binary behavior, not merely development-mode success; and
- provides a documented migration and rollback path.

If the replacement does not pass this gate, fix the proof rather than maintaining two permanent desktop architectures. Tauri remains only as the rollback build until the decision is resolved.

## Phase 4: Replace the Android shell with Capacitor

Do this after the shared TypeScript contracts are stable, so Android receives a small adapter rather than another backend.

- Reuse the same React interface and TypeScript core as Windows.
- Add a narrow Capacitor plugin around the Android yt-dlp/FFmpeg library and MediaStore.
- Send structured job plans from TypeScript; do not let Kotlin decide provider policy or Spotify matches.
- Preserve Android package ID, signing certificate, version-code progression, permissions, scoped storage, and upgrade behavior.
- Migrate compatible local history/preferences or document any unavoidable reset before release.
- Test initialization, engine updates, resolve, download, progress, cancellation, background/activity lifecycle, MediaStore output, cleanup, and failure mapping on real APK builds.
- Keep Android-specific UI differences limited to operating-system needs such as system bars, sharing, storage, and lifecycle messages.

### Android replacement gate

Replace the Tauri APK only when the Capacitor APK:

- passes the shared provider and Spotify contract suite;
- passes installed-device scenarios for every advertised capability;
- installs over the existing signed APK or has an explicitly communicated migration path;
- matches or improves startup, stability, cancellation, and storage behavior;
- contains no duplicated provider or matching policy in Kotlin; and
- has a rollback release available until the replacement is proven.

### iOS scope gate

Before writing an iOS downloader:

- Define which sources explicitly authorize third-party downloading.
- Check App Store rules and each provider's terms.
- Prove a technically supportable extraction and media-processing approach without assuming the Android library is portable.
- Decide whether the product is App Store-distributed, privately distributed, or limited to direct/authorized media.
- Require access to macOS, Xcode, signing, and real iPhone testing.

If these conditions cannot be met, ship no full iOS downloader. A limited companion that handles only direct or authorized media is the safer possible scope.

## Phase 5: CI, releases, and maintenance

- Add Android compilation, lint, unit tests, and selected emulator integration tests to pull-request CI.
- Retain JavaScript/TypeScript typechecking, deterministic tests, production builds, Rust tests while Tauri exists, and release-version consistency.
- Run scheduled live provider probes separately so upstream outages do not make deterministic CI meaningless.
- Perform real packaged Windows transfer tests before every desktop release and separate installed-APK transfer tests before every Android release.
- Verify installer/APK signatures, checksums, version upgrades, and published assets.
- Keep dependency upgrades grouped when packages must remain compatible, such as React and React DOM.
- Do not merge a green dependency pull request without reviewing behavior and migration notes.

## Code-quality rules for implementation

- Prefer one source of truth for every policy or business decision.
- Keep native adapters thin; do not duplicate matching or provider semantics in Rust, Kotlin, and TypeScript.
- Use small modules with explicit inputs, outputs, error contracts, and ownership.
- Test observable behavior rather than private implementation details.
- Keep live upstream checks distinct from deterministic tests.
- Require reviewable changes with a focused purpose and rollback path.
- Document why a non-obvious constraint exists, not what an obvious line of code does.
- Delete dead compatibility code after migration evidence proves it is unused.
- Do not claim cross-platform support without installed, packaged evidence on that platform.
- Favor understandable code over clever abstraction, but remove harmful duplication even when each copy is individually simple.

## Suggested execution order

1. Establish the current provider/platform baseline and freeze new features.
2. Fix only critical current-client defects and add enough Android CI to prevent accidental breakage during transition.
3. Define the final TypeScript contracts for jobs, providers, errors, security, filenames, and Spotify matching.
4. Build the Electron main process and TypeScript media service in small vertical slices.
5. Move one provider at a time, beginning with direct media and YouTube, then social providers, then Spotify.
6. Verify the packaged Electron build against the same Windows scenarios as Tauri.
7. Strengthen and benchmark Spotify Smart Match inside the single TypeScript path.
8. Switch the Windows release only after the replacement gate passes, then remove Rust/Tauri and duplicated desktop code.
9. Build the Capacitor Android shell and minimal Java bridge against the stable shared contracts.
10. Switch the Android release only after the installed-APK replacement gate passes, then remove the Tauri mobile/Rust shell and obsolete Kotlin backend logic.
11. Reassess the remaining issue register, delete migration scaffolding, simplify documentation, and produce the final evidence report.

## Explicit non-goals

- Do not maintain permanent Rust and TypeScript desktop backends in parallel.
- Do not move shared product behavior into Kotlin; redesign only the small Android operating-system bridge.
- Do not promise full iOS compatibility from a React Native UI migration.
- Do not add a remote media proxy, user-account system, cookie bypass, DRM bypass, or cloud media storage.
- Do not weaken matching confidence merely to increase Spotify success percentages.
- Do not rely on unit tests alone to declare desktop or APK downloads fixed.
- Do not add architectural frameworks merely to make the project look enterprise-grade.
- Do not claim literal 100% live-provider availability or accuracy when upstream services are outside Savewave's control.

## Definition of done

This plan is complete when:

- the supported-provider matrix passes on both the packaged TypeScript Windows application and installed Android APK;
- product policy, jobs, errors, security rules, and matching decisions each have one TypeScript source of truth;
- Spotify matching has measured accuracy and safe-rejection evidence;
- Rust/Tauri has been removed from both primary clients after verified parity and rollback evidence;
- Android uses Capacitor plus a small documented Java engine/MediaStore bridge;
- Kotlin contains no provider policy, Spotify matching, filenames, retries, or user-facing business decisions;
- a new contributor can locate shared UI/core rules, desktop integration, Android integration, and tests without an architecture guide; and
- product documentation accurately states what works, what is unsupported, and what was actually verified.

## Current code-quality assessment

Savewave is not badly written, but it is becoming structurally difficult to maintain. It is best described as a promising, reasonably engineered application carrying growing architectural debt.

Indicative assessment at the time this plan was written:

- Individual code and safety: **7.5/10**
- Architecture and separation: **6/10**
- Automated verification: **6.5/10**
- Cross-platform maintainability: **4.5/10**
- Overall: **approximately 6.5/10**

These numbers are directional rather than scientific. They are included to make the current judgment explicit and to provide a baseline for later reassessment.

### Existing strengths

- URLs are validated before native execution.
- User input is passed as structured process arguments instead of interpolated shell command strings.
- Private-network and localhost destinations are rejected.
- Downloads use isolated jobs with cancellation and cleanup.
- Spotify matching intentionally rejects uncertain candidates.
- Shared TypeScript contracts exist between the interface and platform adapters.
- Release versions and artifacts have consistency checks.
- Documentation distinguishes deterministic tests from live provider verification.
- JavaScript/TypeScript and Rust test suites currently pass.
- CI, automated maintenance, signing, checksums, and release workflows already exist.

These are meaningful engineering safeguards. They matter more than whether every individual function is elegant.

### Current weaknesses

#### Architecture and implementation do not fully agree

The documented architecture says TypeScript owns shared decisions and the native layers mainly provide transport. In practice, the Android plugin still owns significant networking, provider parsing, engine-update behavior, storage, download policy, error handling, and legacy Spotify logic.

This creates two implementations that can gradually behave differently even when neither contains an obvious local bug.

#### The Android plugin has too many responsibilities

`SavewaveMediaPlugin.kt` contains most of the Android backend in one class. It changes for unrelated reasons: Instagram parsing, Spotify transport, engine initialization, download jobs, FFmpeg, networking, file storage, and application shutdown.

A large file is not automatically poor code, but this responsibility density raises cognitive load and makes safe changes harder to reason about.

#### Dead and misleading implementations remain

The Kotlin plugin contains Spotify scoring and trust functions that are no longer part of the active shared matching path.

Dead code is especially costly in a multi-language project because a maintainer must determine whether it is obsolete, a fallback, or a second authority before making a change.

#### Linting is incomplete

The current `lint` command performs TypeScript typechecking rather than a full lint pass.

It does not adequately detect problems such as:

- React hook mistakes;
- empty or swallowed catch blocks;
- dead imports and variables;
- unsafe JavaScript patterns;
- accidental mutation;
- unreachable branches;
- excessive complexity; or
- inconsistent JavaScript, JSX, and TypeScript conventions.

The strict TypeScript configuration also covers only the TypeScript core and TypeScript tests, not the larger JavaScript/JSX surface.

#### The primary React component owns too much temporal state

`public/app.jsx` manages navigation, resolving, timers, cancellation, progress, fallback attempts, release notifications, history, and presentation.

This increases the chance of race conditions when:

- an older resolve finishes after a newer request;
- the application moves between foreground and background;
- polling overlaps cancellation;
- a fallback source starts; or
- a component unmounts during asynchronous work.

#### Android verification is weaker than desktop verification

The ordinary CI path verifies JavaScript/TypeScript, the production build, and Rust, but it does not provide equivalent Android compilation and installed-APK behavioral evidence for every change.

A green repository therefore does not necessarily mean that the APK can resolve and download media successfully.

#### Fragile upstream integrations need stronger containment

Instagram embed parsing, Spotify embed metadata, unofficial YouTube Music requests, and yt-dlp provider extraction can break when upstream services change.

That instability is not itself evidence of poor engineering. The maintainability risk comes from mixing these integrations into large platform classes instead of isolating them behind adapters, fixtures, diagnostics, and scheduled live checks.

## Maintainability standard

The project should not judge code by whether a human or an AI originally typed it. The relevant standard is whether every accepted change improves or preserves the long-term health of the repository.

Code is maintainable when a developer can answer these questions quickly:

1. Where does this behavior live?
2. Is there only one authoritative implementation?
3. What could this change break?
4. How can the change be proven to work?
5. If production fails, can the cause be diagnosed?
6. Can the change be reversed safely?

Savewave currently answers these questions reasonably well for several desktop and security paths. It answers the first two poorly in some cross-platform areas and does not yet provide sufficient installed-Android evidence for the fourth.

Uncertainty has a practical and psychological cost. When developers cannot locate ownership or trust verification, they become reluctant to change existing code and are more likely to add another special case. That behavior increases duplication and further weakens confidence.

### Trusted engineering principles

The implementation of this plan should follow these external standards and practices:

- Google Engineering Practices: each change should improve the overall health of the codebase while still allowing reasonable engineering progress. Review design, functionality, complexity, tests, naming, comments, style, and documentation. See [The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html) and [What to Look For in a Code Review](https://google.github.io/eng-practices/review/reviewer/looking-for.html).
- NIST Secure Software Development Framework: use repeatable practices to prepare the organization, protect software, produce well-secured releases, and respond to discovered vulnerabilities. See [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final).
- DORA: measure real delivery and stability outcomes rather than relying on perceived speed. AI assistance and other productivity tools do not replace small changes, robust tests, user focus, or operational feedback. See the [DORA 2024 report](https://dora.dev/research/2024/dora-report/).
- SPACE developer productivity framework: do not reduce productivity to lines of code or output speed. Consider satisfaction and well-being, performance, activity, communication and collaboration, and efficiency and flow. See [The SPACE of Developer Productivity](https://queue.acm.org/detail.cfm?id=3454124).

## Policy for AI-assisted development

AI is an implementation tool, not the owner of the system. The developer who accepts a change remains responsible for its design, behavior, verification, and maintenance.

### Good uses of AI in Savewave

- Explain unfamiliar Rust and Kotlin code before it is changed.
- Generate repetitive adapters, types, fixtures, and focused tests.
- Compare desktop and Android behavior systematically.
- Identify duplicated policies and inconsistent error handling.
- Perform bounded refactors with before-and-after validation.
- Generate migration scaffolding after the target boundary is agreed.
- Maintain documentation after the implementation actually changes.
- Help construct regression cases from confirmed failures.

### Uses that require rejection or extra scrutiny

- Adding another fallback without mapping the existing fallback chain.
- Duplicating business rules in another language or platform adapter.
- Declaring an APK or packaged application fixed because unit tests passed.
- Introducing abstractions without a clear owner and use case.
- Rewriting a working architecture without measured benefits and a rollback path.
- Leaving an obsolete implementation behind after migration.
- Increasing match or download success by silently weakening safety checks.
- Producing documentation that describes an intended design as if it were already implemented.

### Required AI change workflow

For every non-trivial AI-assisted change:

1. State the intended behavior and affected platforms.
2. Locate the current authoritative implementation.
3. Identify duplicated or adjacent behavior before editing.
4. Make the smallest coherent change that improves the design.
5. Add or update deterministic tests.
6. Run the relevant language and build checks.
7. Exercise packaged or installed behavior when platform integration is affected.
8. Review the final diff for dead code, accidental scope growth, misleading comments, and generated-file noise.
9. Update documentation to describe only the verified result.
10. Record anything that was not verified.

AI assistance should be evaluated by resulting code health and real product behavior, not by how quickly code was generated. A controlled study of experienced open-source developers found that early-2025 AI tools made participants slower in that particular setting despite their expectation of being faster. This result is time- and context-specific, but it reinforces the need to measure outcomes rather than trust perceived speed. See the [METR study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/).

## Quality improvement targets

The project should be reassessed after Phases 1 and 2 using evidence rather than subjective impressions.

Target conditions:

- No duplicated Spotify ranking implementation outside the TypeScript core.
- No Rust product logic remains in either primary client.
- Kotlin is limited to the Android engine, process, lifecycle, and MediaStore bridge; all portable product logic remains TypeScript.
- Real linting covers TypeScript, JavaScript, and JSX.
- Type coverage expands across application orchestration code.
- The main React component delegates asynchronous workflows to tested controllers or hooks.
- Every supported provider has deterministic adapter coverage and scheduled live verification.
- Pull-request CI builds and tests Android-specific code.
- Packaged Windows and installed Android smoke evidence is required for relevant releases.
- Documentation and capability claims agree with current implementation and test evidence.
- Provider failures produce stable, actionable, privacy-safe diagnostics.

## Starting point for the later implementation session

When work resumes, begin with a focused Phase 0 and Phase 1 change rather than a framework migration:

1. Capture the current provider/platform behavior matrix.
2. Add Android compilation and unit testing to pull-request CI.
3. Add real ESLint rules for the JS, JSX, and TS surfaces without mixing in unrelated formatting churn.
4. Confirm which Kotlin Spotify functions are dead and remove them with parity tests.
5. Reproduce the reported Instagram APK failure on an installed build and classify whether it is a critical support-window fix or a documented limitation.
6. Define the minimal TypeScript Electron vertical slice: URL validation, resolve, one download job, cancellation, and safe output.
7. Prove that slice in a packaged Windows build before expanding the migration.

After those foundation steps, continue directly into the larger Spotify improvements and Electron/Capacitor replacement slices.

## Complete quality-remediation issue register

This is the tracked backlog for the later quality project. Every issue found in the current repository audit must be fixed, verified, or explicitly recorded as an accepted limitation before the work is called complete.

It records every issue visible in the current source, configuration, tests, documentation, and workflows. It cannot honestly guarantee that no additional runtime defect exists: installed-device work, packaging, live providers, and deeper implementation may expose more. Any newly discovered issue must be added to this register and completed under the same standard.

An issue can be closed in two valid ways: repair the maintained implementation, or verify that the affected implementation was replaced and removed. Do not build elaborate abstractions in Rust or in Kotlin code scheduled to be replaced; design only the final minimal Android bridge.

### Architecture and ownership

- [ ] **Q-01 — Duplicated native download policy — in progress:** Shared TypeScript now owns format selection and retry/timeout values used by Electron and Capacitor. The legacy Rust/Tauri paths retain transitional copies until packaged and installed parity allows their removal; provider-specific multi-item and filename policy still needs consolidation.
- [ ] **Q-02 — Oversized Android plugin — in progress:** A focused Capacitor Java bridge now contains only engine execution, jobs, defensive validation, lifecycle cleanup, and MediaStore publication. The old Tauri-era Kotlin backend remains solely for rollback until installed APK parity is proven.
- [x] **Q-03 — Dead Kotlin Spotify matcher — verified 2026-09-21:** Removed the unused scoring, normalization, trust, and corroboration implementation and imports. Shared matcher tests pass, and the transitional Kotlin module compiles.
- [ ] **Q-04 — Desktop/Android feature drift:** Make every intentional platform difference explicit. Test equivalent inputs against equivalent contracts instead of allowing accidental divergence.
- [ ] **Q-05 — Migration decisions lack measurements:** Do not choose Electron, Tauri, or React Native solely from language familiarity. Record package size, memory, startup, reliability, security surface, native code, build/signing work, maintenance cost, and rollback strategy.

### Provider and media-engine reliability

- [x] **Q-06 — Android social multi-item inconsistency — verified 2026-09-21:** Shared policy expands only Instagram posts/Reels to a maximum of 20 items. Android and Electron otherwise force single-item operation; Android publishes every bounded output, preserves playlist order in filenames, and returns all saved names. Installed public carousel testing remains in the manual release checklist.
- [ ] **Q-07 — Fragile Instagram gallery extraction — in progress:** The target Electron/Capacitor path delegates extraction to yt-dlp instead of maintaining another embed/CDN scraper, applies a 20-item bound, preserves ordered filenames, publishes every Android output, and covers policy/progress/cancellation deterministically. Complete the installed public single-image, Reel, carousel, mixed-item, private/deleted, cancellation, and lifecycle matrix before closing.
- [ ] **Q-08 — Android engine update coupled to readiness:** Allow a sufficiently recent bundled engine to start offline; separate optional updating, verify update integrity, handle stale preferences/missing files, and expose useful state without unnecessarily disabling the app.
- [ ] **Q-09 — Cross-platform error loss — in progress:** The Capacitor bridge maps invalid/private targets, 403, 404, 429, timeouts, storage failures, cancellation, and fallback failures to stable codes. Move the mapping authority into shared TypeScript and finish DNS, connection, extractor, and FFmpeg distinctions across both clients.
- [ ] **Q-10 — Runtime payloads are weakly validated — in progress:** Spotify metadata/candidate lists and the Electron/Capacitor boundary now have bounded runtime validation with malformed/oversized tests. Commands plus resolved media, jobs, progress, capabilities, engine status, and release data are checked before use. Add equivalent strict normalization for raw yt-dlp, YouTube Music, and remaining provider-specific responses.
- [ ] **Q-11 — Resource bounds are scattered:** Centralize and test limits for item counts, jobs, retries, payloads, images, filenames, logs, timeouts, and temporary storage.
- [ ] **Q-12 — Capability claims are broader than evidence:** Generate or validate capabilities from the provider test matrix and show precise URL/platform/private-media limitations in the UI.
- [ ] **Q-13 — Live upstream instability is not fully separated:** Keep deterministic fixtures in blocking CI and run rate-limited live probes separately, distinguishing product regressions from provider outages.

### Spotify Smart Match

- [x] **Q-14 — Brittle metadata acquisition — verified 2026-09-21:** Public oEmbed, embed, and page fallback responses are bounded and independently tolerant. Metadata includes provenance and validated title, artists, album, duration, explicit state, release year, artwork, preview, and ISRC when publicly available; missing evidence stays missing.
- [ ] **Q-15 — Search evidence is sometimes too shallow — in progress:** Search uses ISRC when present, all artists, primary artist, album/release-year catalog evidence, structured songs, videos, and bounded generic fallback. Richer metadata enrichment for the final shortlist remains.
- [x] **Q-16 — Matching confidence needs stronger guarantees — verified 2026-09-21:** The single shared matcher scores title, artist, duration, album, ISRC, source authority, and version compatibility; it requires a minimum confidence and runner-up margin, rejects contradictory evidence, never uses popularity as identity, and has focused behavioral regression coverage. An authoritative upload owned by any credited artist is accepted without weakening generic fan-upload rules.
- [ ] **Q-17 — Ambiguity has no controlled user path — in progress:** Near-tied strong candidates now produce a two-option chooser showing title, creator, and duration; no download is enabled before an explicit choice. The bounded local preference uses only the track ID and is reused only while the chosen source remains eligible. Verify keyboard, screen-reader, mobile, and installed-client behavior before closing.
- [ ] **Q-18 — Matcher failures are insufficiently diagnosable:** Produce redacted stage-by-stage diagnostics containing result counts, rejection reasons, score components, confidence margin, and disposition.
- [ ] **Q-19 — A single success percentage hides risk — in progress:** The live benchmark now separates automatic matches and safe rejections/failures and marks wrong-match correctness unknown without ground truth. Add labelled expected recordings and separate metadata, search, region, and wrong-match outcomes.

### Frontend and application state

- [ ] **Q-20 — Main React component owns too much — in progress:** Download polling, fallback, cancellation, timeout, and job ownership now live in a tested shared controller. Continue extracting resolution, navigation, history, updates, and presentation while preserving the interface.
- [ ] **Q-21 — Async race and cleanup risk — in progress:** Download operations now have abort ownership, bounded polling, terminal cleanup, and retry rules; resolver operations reject late results after abort. Add equivalent focused ownership tests for rapid input changes, modal choice state, history, and update checks.
- [ ] **Q-22 — Swallowed errors:** Remove unjustified empty catch blocks. Intentional best-effort failures must be explained and made visible in development/redacted diagnostics.
- [ ] **Q-23 — Lifecycle behavior appears as random glitches:** Define and test desktop shutdown plus Android backgrounding, activity recreation, process death, interruption, reopening, partial-file cleanup, and the boundary of unsupported permanent background work.
- [ ] **Q-24 — Accessibility can regress during refactoring:** Automated semantics remain in place, and the manual matrix now requires focus, keyboard chooser/modal operation, screen-reader labels, progress announcements, error recovery, reduced motion, and narrow layouts. Close only after installed-client evidence.

### Static quality and test depth

- [x] **Q-25 — `lint` is only typechecking — verified 2026-09-21:** Added maintained ESLint rules for JavaScript, JSX, React hooks, TypeScript, Node scripts, and tests. `lint` and `typecheck` are separate gates and both pass.
- [ ] **Q-26 — Strict typing covers too little:** Type high-risk UI orchestration, resolver contracts, provider results, matcher runtime, and IPC boundaries incrementally; avoid unjustified broad `any` usage and pair static types with runtime validation.
- [x] **Q-27 — No explicit risk-based coverage policy — verified 2026-09-21:** The complete gate uses V8 coverage over runtime contracts, workflow control, errors, filenames, policy, state, source detection, and Spotify matching/search, enforcing 75% statements/lines/functions and 65% branches. Current measured coverage is 88.07% lines, 88.88% functions, 78.6% statements, and 67.55% branches.
- [ ] **Q-28 — Missing failure and concurrency cases — in progress:** The shared download controller now covers successful progress, retryable fallback, non-retryable failure, active-job cancellation, stale async results, and bounded polling timeout. Add simultaneous native jobs, corrupt output, filename collisions, cleanup failures, and bounded job-retention tests.

### CI, releases, dependencies, and repository clarity

- [ ] **Q-29 — Pull-request CI does not prove Android — in progress:** CI now compiles the legacy Kotlin/Tauri APK and runs Capacitor unit tests, Android lint, and debug APK assembly. Add selected emulator integration checks and verify the workflow remotely so installed-runtime failures block changes before tagging.
- [ ] **Q-30 — Release evidence is asymmetric:** Require packaged Windows and installed Android evidence for versioning, signatures, checksums, upgrades, representative transfers, cancellation, storage, and engine versions; disclose skipped checks.
- [ ] **Q-31 — Weekly yt-dlp maintenance is desktop-heavy:** Validate the Android dependency/build and an Android-compatible engine smoke path before describing an automated update as cross-platform-ready.
- [ ] **Q-32 — Dependency PRs can be incompatible or misleading:** Group coupled dependencies such as React/React DOM, review major-version migration notes, test affected behavior, and close or replace stale red PRs rather than leaving noise indefinitely.
- [x] **Q-33 — Generated versus authoritative files are unclear — verified 2026-09-21:** Architecture documentation lists authoritative sources and generated/disposable outputs. The complete gate hashes committed browser assets, rebuilds them reproducibly, and fails if they were stale before the build.
- [x] **Q-34 — Documentation can describe the target as current — verified 2026-09-21:** `docs/ARCHITECTURE.md` now documents Electron/Capacitor as the target/current migration path and labels Tauri/Kotlin as rollback-only. Ownership and proof limitations link directly to source areas and the installed-client matrix.
- [ ] **Q-35 — Intermittent-client diagnostics are inadequate:** Add bounded structured local logging and a user-triggered redacted export covering versions, lifecycle, stages, sidecars, progress, cancellation, parsing, FFmpeg, and saving without leaking URLs, secrets, or personal paths.
- [x] **Q-36 — Quality commands are fragmented — verified 2026-09-21:** `check:fast`, `check`, Electron build, Capacitor sync, Android Gradle gates, transitional Rust gates, and optional live probes are documented separately with explicit proof boundaries. CI reuses the complete shared gate and builds both primary targets.
- [ ] **Q-37 — Broad cleanup could become an unreviewable rewrite:** Deliver dependency-ordered, single-purpose diffs; separate mechanical formatting; preserve rollback points; remove temporary artifacts; and attach focused validation to every change.
- [x] **Q-38 — Social providers advertised beyond reliable support — accepted limitation 2026-09-26:** Instagram, Facebook, and X/Twitter are no longer in the supported-source list or selectable download flow. Their URLs are recognized and rejected before native extraction on desktop and Android. User impact: those links cannot be downloaded in Savewave. Reason: repeated installed-client failures despite extractor and local parsing work; a tested library replacement did not solve anonymous Instagram access. Mitigation: clear unavailable state and honest documentation. Reconsider only after packaged Windows and installed Android success across representative public images, posts, Reels/videos, and repeated transfers without authentication or remote proxying.

## Issue-register operating rules

1. Give every issue one status: `not started`, `in progress`, `verified`, or `accepted limitation`.
2. Keep only one architectural migration phase active at a time.
3. Add newly discovered issues using the next `Q-` identifier; do not hide them inside unrelated tasks.
4. Do not mark packaging, device, network, provider, lifecycle, accessibility, or visual issues verified from source inspection or unit tests alone.
5. Record the exact automated commands and representative manual scenarios used as evidence.
6. An accepted limitation must state its user impact, reason, mitigation, and conditions for reconsideration.
7. Do not delete an issue because a rewrite appears to make it irrelevant; verify that the replacement satisfies the underlying requirement.
8. Do not claim “all quality issues fixed” until every register entry and every newly discovered entry has a final status with evidence.
9. Reassess the code-quality ratings after Phase 1, Phase 2, and the final desktop/mobile architecture decisions.
