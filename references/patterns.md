# Dashboard Customization Patterns

Use these recipes when a task needs specialized panels beyond the default template. Edit `$DASH_DIR/index.html` directly after running `init.mjs`. The server reloads `index.html` on every page refresh with `Cache-Control: no-store`.

## 1. Parallel Build Monitor

Best for multi-workstream builds with builder, reviewer, and merger loops.

- Use `--decision` for locked decisions (`A1`, `A2`, `A3`).
- Use `--item` for each workstream with `--owner "<branch>"` and `--badges "Builder=passed,Reviewer=running,Merger=pending"`.
- Use `--gate` for unit tests, build checks, HTML validation, Lighthouse, and security checks.
- Update `--percent` as workstreams move from build to review to merge.

## 2. Experiment or Eval Engine

Best for ML training, benchmark loops, or iterative optimization.

- Start with `--theme dark` for high-density tables and terminal logs.
- Use `--metric` for headline numbers (best score, delta vs baseline, disk free, active run).
- Use `--item` with `--log-path "/path/to/run.log"` and `--progress <0-100>` for parallel GPU or eval lanes.
- Use `--json` to update `resultsColumns` and `results` for the experiment scoreboard table.
- For a trajectory chart, add an inline `<svg viewBox="0 0 560 190">` container in `$DASH_DIR/index.html` and render polylines from `state.results`. Keep zero external chart libraries.

## 3. Multi-Agent Reviewer Panel

Best for structured design reviews, council debates, or objection tracking.

- Use `--stage` for review stages (`concept:Concept:done`, `plan:Plan:active`, `build:Build:pending`).
- Use `--item` for each reviewer persona with `--owner "<role>"`, `--item-status approved|running|blocked`, and `--detail "<short vote note>"`.
- Use `--gate` for objections or checklist items (`obj-1:Pricing clarity:passed:Addressed in v3`).
- Use `--event` with `--actor "<reviewer-name>"` so the live feed reads like a transcript.

## 4. Custom Color Palettes

Pass `--primary` and `--accent` to `init.mjs` so multiple open browser tabs are easy to tell apart:

| Style | Primary | Accent | Theme |
| --- | --- | --- | --- |
| Forest | `#174E35` | `#C84B16` | `light` |
| Ocean | `#0F4C5C` | `#E36414` | `light` |
| Slate | `#111827` | `#2563EB` | `light` or `dark` |
| Terminal / ML | `#1E293B` | `#3B82F6` | `dark` |
