---
name: live-dashboard
description: >-
  Create and maintain a local live web dashboard for a task so the user can
  follow progress, elapsed time, active work, gates, and results in the browser
  without watching the chat session. Use when the user asks for a live
  dashboard, monitor, or status page. Also start one proactively for multi-step
  or long-running work such as parallel builds, experiment or eval loops,
  multi-agent reviewer panels, or jobs lasting more than a few minutes.
---

# Live Dashboard

Give the user a live localhost web page that shows what is happening now, how long the task has run, overall progress, active workstreams, results, quality gates, and a timestamped activity feed.

## When to start a dashboard

- Start one whenever the user asks for a live dashboard, monitor, or progress page.
- Start one proactively at the beginning of multi-step or long-running work:
  - Parallel builds with multiple workstreams, builders, reviewers, or mergers.
  - Experiment, training, or evaluation loops.
  - Multi-agent panels, audits, or batch migrations.
  - Any task expected to run for more than a few minutes.
- Skip it for quick one-turn edits or simple questions.

## Quick start (3 steps)

Store each dashboard outside the git repository so it never pollutes working trees. Use your environment's scratch directory or a temporary directory:

```bash
DASH_DIR="$(mktemp -d "${TMPDIR:-/tmp}/live-dashboard-XXXXXX")"
```

Resolve `<skill-dir>` to the folder containing this `SKILL.md` file.

### 1. Scaffold the dashboard

Run [init.mjs](./scripts/init.mjs):

```bash
node "<skill-dir>/scripts/init.mjs" \
  --dir "$DASH_DIR" \
  --title "Task Title" \
  --subtitle "Short goal summary"
```

Optional flags:
- `--theme light` (default) or `--theme dark`
- `--primary "#174E35"` and `--accent "#C84B16"` to match a project palette.

### 2. Start the SSE server and open the browser

Launch `server.mjs` as a background daemon process:

```bash
node "$DASH_DIR/server.mjs" --port 0
```

If your client does not have a background daemon runner, detach it in the shell:

```bash
nohup node "$DASH_DIR/server.mjs" --port 0 >"$DASH_DIR/server.log" 2>&1 &
```

Passing `--port 0` lets the OS pick a free localhost port on `127.0.0.1` so multiple dashboards never collide. The server writes the exact URL to `$DASH_DIR/url.txt` and prints `LIVE_DASHBOARD_URL=http://127.0.0.1:<port>/`.

Open the dashboard in the user's browser and share the URL in chat:

- macOS: `open "$(cat "$DASH_DIR/url.txt")"`
- Linux: `xdg-open "$(cat "$DASH_DIR/url.txt")"`
- Windows: `start "" "$(cat "$DASH_DIR/url.txt")"`

### 3. Update state as work progresses

Call `update.mjs` at every meaningful state change. Each call performs an atomic write to `state.json` and pushes an instant update over SSE to the browser.

```bash
node "$DASH_DIR/update.mjs" \
  --phase "Building workstreams" \
  --now "Dispatching 3 parallel builders" \
  --percent 25 \
  --stage "plan:Plan:done" \
  --stage "build:Build:active" \
  --stage "verify:Verify:pending" \
  --item "api" --name "Auth API" --item-status running --owner "feat/auth-api" \
    --badges "Builder=running,Reviewer=pending,Merger=pending" \
    --detail "Implementing magic-link endpoints" \
  --gate "tests:Unit Tests:pending:Waiting for builders" \
  --event "Dispatched Builder A for Auth API" --actor "coordinator"
```

## Update CLI reference

All flags can be combined in a single `update.mjs` invocation:

| Flag | Format | Purpose |
| --- | --- | --- |
| `--status` | `running \| paused \| complete \| failed` | Overall task status. `complete` or `failed` freezes the elapsed timer. |
| `--phase` | `"Text"` | Current phase label. |
| `--now` | `"Text"` | One-line description of what is happening right now. |
| `--percent` | `0..100` | Overall progress bar percentage. |
| `--stage` | `id:Label:status` | Upsert a stage pill (`pending`, `active`, `done`, `failed`). |
| `--item` | `id` | Select or create a workstream, lane, or task card. Follow with `--name`, `--item-status`, `--owner`, `--progress`, `--detail`, `--badges` (`k=v,k2=v2`), or `--log-path`. |
| `--gate` | `id:Label:status:Detail` | Upsert a quality gate (`pending`, `running`, `passed`, `failed`, `skipped`). |
| `--metric` | `id:Label:Value[:Delta[:Tone]]` | Upsert a summary metric card. Tone: `neutral`, `good`, `warn`, `bad`. |
| `--decision` | `id:Label:Value` | Upsert a locked decision or constraint card. |
| `--log-file` | `id:Label:Path[:TailLines]` | Attach a live tailed log file to the dashboard. |
| `--event` | `"Message"` | Append a timestamped entry to the live activity feed. Optional `--level` (`info`, `ok`, `warn`, `error`) and `--actor`. |
| `--json` | `'{"key":"val"}'` | Shallow-merge custom JSON fields (such as `resultsColumns` and `results`) into `state.json`. |
| `--complete` | (no value) | Mark the task complete, set progress to 100%, and freeze the elapsed timer. |

## Lifecycle rules

1. **Update promptly**: Update the dashboard right before starting a long step and right after it finishes. Never let the page go stale while subagents or scripts run.
2. **Keep it running at the end**: When the task finishes, run `update.mjs --complete --now "All checks passed." --event "Task complete" --level ok`. Leave the daemon running so the user can inspect the final results and total elapsed time.
3. **Localhost only**: Always bind to `127.0.0.1`. Never expose the dashboard on `0.0.0.0` or commit dashboard scratch files to git.
4. **Zero dependencies**: Use Node.js built-ins only (`node:http`, `node:fs`, `node:path`). Do not install npm packages for a dashboard.

## Customizing for specialized tasks

The default template covers most tasks out of the box (time, progress, stages, metrics, decisions, workstreams, gates, results table, live log tails, and activity feed).

When a task benefits from a specialized layout, such as a reviewer panel with vote cards, an experiment engine with an inline SVG trajectory chart, or a custom color palette, edit `$DASH_DIR/index.html` directly. See [references/patterns.md](./references/patterns.md) for concrete schemas and recipes.
