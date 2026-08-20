# Automated Maintenance Guide

Savewave uses GitHub automation to detect routine dependency and media-engine updates. It opens reviewed pull requests; it does not silently publish production releases.

## The simple explanation

You do not need to understand CI/CD to use this.

- **Workflow** means a task GitHub runs on its own computer.
- **CI** means GitHub checks that Savewave still builds and its tests pass.
- **Pull request (PR)** means a proposed update waiting for your approval.
- A **green check** means the automated tests passed.
- A **red cross** means something failed; do not merge that PR.

The normal process is:

```text
GitHub finds an update → tests it → opens a PR → you check for green ticks → you merge it
```

Merging an automated maintenance PR updates the source code only. It does not immediately release a new `.exe` or `.apk`. Production releases still use the separate [Release Checklist](RELEASE_CHECKLIST.md).

## What you need to do

Most weeks, nothing. GitHub runs the checks automatically every Monday.

When GitHub opens a maintenance PR:

1. Open the Savewave repository on GitHub.
2. Select the **Pull requests** tab.
3. Open the PR carrying the `automated-maintenance` or `dependencies` label.
4. Scroll to the checks near the bottom.
5. If every required check is green, read the short update description.
6. Select **Merge pull request**, then **Confirm merge**.
7. If any check is red, do not merge. Open the failed check to see its log, or leave the PR open for investigation.

For a yt-dlp PR, the automation has already performed a real public-video download. Even with green checks, test one link yourself when convenient before making the next public release.

## What runs automatically

### Dependabot

`.github/dependabot.yml` checks:

- npm packages every Monday at 04:00 IST;
- Rust crates every Monday at 04:15 IST;
- GitHub Actions monthly at 04:30 IST.

Minor and patch upgrades are grouped to reduce noise. Major upgrades remain separate because they can require migrations. Every Dependabot PR runs the normal CI workflow.

### yt-dlp maintenance

`.github/workflows/automated-maintenance.yml` runs every Monday at 06:00 IST and can also be started manually. It:

1. Reads the latest stable release from the official `yt-dlp/yt-dlp` repository.
2. Synchronizes the desktop pin and Android minimum-engine version.
3. Runs typechecking, unit tests, the production build, and release-version validation.
4. Downloads and verifies the pinned desktop sidecar.
5. Performs a real transfer of yt-dlp's public test video.
6. Runs the Rust tests.
7. Opens or refreshes `automation/update-ytdlp` only when every check passes.

If validation fails, the workflow creates or updates an `Automated maintenance needs attention` issue and links the failed run. A failed update is never released automatically.

## Initial GitHub setup

After this configuration reaches `main`:

1. Open the Savewave repository on GitHub.
2. Select **Settings** in the repository navigation—not your personal GitHub settings.
3. In the left menu, select **Actions → General**.
4. Scroll to **Workflow permissions**.
5. Select **Read and write permissions**.
6. Enable **Allow GitHub Actions to create and approve pull requests**.
7. Select **Save**.
8. Open **Issues → Labels → New label** and create `automated-maintenance` if it is missing.
9. Create `dependencies` the same way if it is missing.
10. Open **Actions → Automated Maintenance**.
11. Select **Run workflow**, keep the `main` branch selected, then select the green **Run workflow** button.
12. Wait a few minutes and open the run. Green ticks mean the setup works.

This setup is needed only once. If you cannot see repository **Settings**, the GitHub account you are using does not have administrator access to the repository.

The workflow uses only the repository-provided `GITHUB_TOKEN`. It does not require a personal access token or release-signing secret.

## Normal weekly use

Use this quick decision:

| What you see | What to do |
| --- | --- |
| No maintenance PR | Do nothing. Everything may already be current. |
| PR with all green checks | Read its summary and merge a small patch/minor update. |
| PR with a red check | Do not merge. Open the failed check or ask for help. |
| Major version update | Leave it for manual review, even when green. |
| `Automated maintenance needs attention` issue | Open its workflow link and share the failed log when asking for help. |
| yt-dlp PR | Merge only when green; test common downloads before the next release. |

Version numbers normally use `major.minor.patch`, such as `2.4.1`:

- `2.4.1 → 2.4.2` is a patch and is usually low risk.
- `2.4.1 → 2.5.0` is a minor update and deserves a quick review.
- `2.4.1 → 3.0.0` is a major update and should be reviewed manually.

Do not merge a yt-dlp PR solely because the version is newer. The real-transfer test covers one stable public video, not every provider, region, account restriction, or future upstream behavior.

## Running maintenance manually

From GitHub, use **Actions → Automated Maintenance → Run workflow**.

You normally do not need the commands below. They are included for development or troubleshooting.

Locally, the equivalent checks are:

```powershell
npm.cmd ci
node scripts/update-ytdlp-version.js YYYY.MM.DD
npm.cmd run check
npm.cmd run prepare:sidecars
node scripts/smoke-test-ytdlp.js
Push-Location src-tauri
cargo test --locked
Pop-Location
```

To test a different public video without changing the script:

```powershell
$env:SAVEWAVE_SMOKE_TEST_URL = "https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID"
node scripts/smoke-test-ytdlp.js
Remove-Item Env:SAVEWAVE_SMOKE_TEST_URL
```

## When automation reports a failure

The simplest response is: do not merge the failed PR. Open the failure issue, copy its GitHub Actions run link, and provide that link when asking for help. The existing released app is not changed by a failed maintenance run.

- `npm ci`: inspect Dependabot/package-lock conflicts or a registry outage.
- Project checks: fix the failing typecheck, unit test, build, or version location.
- Sidecar preparation: verify that the discovered yt-dlp release exists and is downloadable.
- Real transfer: open the verbose yt-dlp output; HTTP 403 or signature errors usually require an upstream extractor fix or client-option adjustment.
- Rust tests: review crate updates and Tauri API compatibility.
- Pull-request permission error: repeat the initial GitHub permission setup above.

Rerun the failed workflow after fixing the cause. The fixed branch name prevents duplicate yt-dlp PRs.

## Auto-merge policy

Automatic merging is intentionally disabled initially. After several reliable weekly runs, repository rules may auto-merge Dependabot patch PRs only when all required CI checks pass. Keep these manual:

- major npm, Rust, Tauri, Android SDK, and GitHub Actions upgrades;
- yt-dlp engine updates;
- changes involving Android signing or release permissions;
- production version tags and GitHub releases.

See [Release Checklist](RELEASE_CHECKLIST.md) before publishing any automated update.
