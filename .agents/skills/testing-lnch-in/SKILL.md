---
name: testing-lnch-in
description: How to test lnch.in preview deploys end-to-end without disturbing the live recording. Use this when running adversarial tests against a Pages preview, when needing JS-side assertions for component state, or when Chrome isn't running on the VM.
---

# Testing lnch.in preview deploys

The canonical way to test lnch.in changes is to drive the **live Cloudflare Pages preview** (one is generated per PR, named `https://devin-<timestamp>-<slug>.lnch-in-git.pages.dev`). The preview always reflects the latest commit on the PR's branch and is byte-equivalent to what main will look like once merged.

## Step 1 — ensure Chrome is up on the VM

The on-VM `google-chrome` command is **not a launcher**. It is a thin shell wrapper that PUTs to `http://localhost:29229/json/new?<url>` — i.e. it requires Chrome to already be running with `--remote-debugging-port=29229`.

If no Chrome is running (e.g. you killed it, the session restarted, etc.), launch the real binary:

```bash
CHROME_BIN=/opt/.devin/chrome/chrome/linux-137.0.7118.2/chrome-linux64/chrome
# (the version subfolder may differ; pick the highest one available)
rm -f /home/ubuntu/.browser_data_dir/Singleton{Lock,Cookie,Socket}
nohup "$CHROME_BIN" \
  --user-data-dir=/home/ubuntu/.browser_data_dir \
  --remote-debugging-port=29229 \
  --no-first-run \
  --no-default-browser-check \
  '<your preview URL>' >/tmp/chrome.log 2>&1 &
disown
sleep 6
curl -s http://localhost:29229/json/version | head -3
```

Then maximize the window for recording:

```bash
sudo apt-get install -y wmctrl 2>/dev/null
wmctrl -r 'Google Chrome for Testing' -b add,maximized_vert,maximized_horz
```

Do NOT use `xdotool key super+Up` — KDE Plasma tiles instead of maximizing.

## Step 2 — attach Playwright to the existing CDP session (don't open a new browser)

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://localhost:29229")
    pg = b.contexts[0].pages[0]   # the existing visible tab
    pg.bring_to_front()
    out = pg.evaluate("() => ({ count: document.querySelectorAll('header a').length })")
```

Why this matters: when a recording is active, evaluating JS in the **same tab the user / recorder is watching** keeps the recording showing real visual state. Don't `browser.new_page()` — that opens a hidden tab the recording can't see.

If Playwright fails with `TargetClosedError`, Chrome is dead — check `pgrep -af chrome-linux64` and re-launch per Step 1.

## Step 3 — typical adversarial assertions for lnch.in components

These hold for the current PR-3 stack and are reusable across future PRs:

```js
// HeatmapPoster shell
const sec = document.getElementById('heatmap');
sec.querySelectorAll('.heatmap-cell').length; // 168 (7 days × 24 hours)
sec.querySelectorAll('.heatmap-day').length;  // 8 (1 header + 7 day labels)

// CursorGlow tracks pointer
getComputedStyle(document.documentElement).getPropertyValue('--cursor-x');
getComputedStyle(document.querySelector('.cursor-glow')).mixBlendMode; // 'plus-lighter'

// DotPulse animation
getComputedStyle(document.querySelector('.dot-pulse__bullet')).animationName; // 'dot-pulse'

// Theme retones
getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
// light: #f8f1d9 ; dark: #050505

// Mobile heatmap horizontal scroll
const inner = document.querySelector('#heatmap div.min-w-\\[600px\\]');
inner.scrollWidth;   // 600 even at 375px viewport
inner.parentElement.clientWidth; // < 600 — confirms overflow-x: auto containment
```

## Step 4 — record using `recording_start` → walk visually → `recording_stop`

Always add `annotate_recording` calls per test (`type=test_start` then `type=assertion`) so the playback overlays the assertions in the video. Keep assertions to one consolidated state-change per test (e.g. `"#status: URL updated, Status heading scrolled to top band"`) rather than micro-checks.

## Auth-gated /ops surface

`/ops/*` is gated by `LAUNCHOPS_ADMIN_SECRET`. If you don't have it in this session:
- Test public pages directly.
- For ops-only components (e.g. DotPulse on the dashboard), use a **synthetic probe** — inject a `<span class="dot-pulse__bullet">` into the public DOM and assert `getComputedStyle(...).animationName === 'dot-pulse'`. This proves the CSS pipeline ships, without needing auth.

## Local lint/typecheck/build before shipping

From `/home/ubuntu/repos/lnch.in`:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
```

All four are wired in `package.json` and pass on a clean tree.

## Common gotchas

- `pkill chrome` will kill the CDP server too. After killing, re-launch the real binary per Step 1.
- `Singleton*` lock files in `/home/ubuntu/.browser_data_dir/` block re-launch — always `rm -f` them first.
- `target.goto(..., wait_until="networkidle")` can hang on Pages preview deploys (long-poll requests). Use `wait_until="domcontentloaded"` and a small `time.sleep(0.5)` instead.
- Chrome's `Ctrl+Shift+J` shortcut to open DevTools sometimes fails in Chrome for Testing builds — prefer Playwright `evaluate` calls over the DevTools console for assertions.
