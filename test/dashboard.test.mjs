import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const INIT_SCRIPT = path.join(REPO_ROOT, "scripts", "init.mjs");

function waitForUrl(dashDir, timeoutMs = 5000) {
  const urlPath = path.join(dashDir, "url.txt");
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (fs.existsSync(urlPath)) {
        const url = fs.readFileSync(urlPath, "utf8").trim();
        if (url) {
          resolve(url);
          return;
        }
      }
      if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for server url.txt"));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

test("init, update, and SSE server end-to-end", async (t) => {
  const dashDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-dashboard-test-"));
  const logFile = path.join(dashDir, "worker.log");
  fs.writeFileSync(logFile, "line 1\nline 2\nworker ready\n", "utf8");

  t.after(() => {
    fs.rmSync(dashDir, { recursive: true, force: true });
  });

  // 1. Scaffold dashboard
  const initOut = execFileSync(
    process.execPath,
    [
      INIT_SCRIPT,
      "--dir",
      dashDir,
      "--title",
      "Release Pipeline",
      "--subtitle",
      "Parallel build and verification",
      "--theme",
      "dark",
      "--primary",
      "#1E293B",
      "--accent",
      "#3B82F6",
    ],
    { encoding: "utf8" }
  );
  assert.match(initOut, /DASHBOARD_READY/);

  for (const name of ["server.mjs", "update.mjs", "index.html", "state.json", "events.jsonl"]) {
    assert.ok(fs.existsSync(path.join(dashDir, name)), `Missing scaffolded file: ${name}`);
  }

  const initialState = JSON.parse(fs.readFileSync(path.join(dashDir, "state.json"), "utf8"));
  assert.equal(initialState.title, "Release Pipeline");
  assert.equal(initialState.theme, "dark");
  assert.equal(initialState.brand.primary, "#1E293B");
  assert.equal(initialState.brand.accent, "#3B82F6");

  // 2. Update state and events
  const updateScript = path.join(dashDir, "update.mjs");
  execFileSync(
    process.execPath,
    [
      updateScript,
      "--phase",
      "Building",
      "--now",
      "Running API and UI workstreams",
      "--percent",
      "45",
      "--stage",
      "plan:Plan:done",
      "--stage",
      "build:Build:active",
      "--metric",
      "tests:Passing Tests:42:+12:good",
      "--decision",
      "A1:License:MIT",
      "--item",
      "api",
      "--name",
      "Auth API",
      "--item-status",
      "running",
      "--owner",
      "feat/auth",
      "--progress",
      "60",
      "--badges",
      "Builder=running,Reviewer=pending",
      "--detail",
      "Implementing endpoints",
      "--log-path",
      logFile,
      "--gate",
      "lint:Lint:passed:0 warnings",
      "--log-file",
      `main:Worker Log:${logFile}:2`,
      "--event",
      "Started API builder",
      "--actor",
      "coordinator",
      "--level",
      "ok",
      "--json",
      JSON.stringify({ resultsColumns: ["Run", "Score"], results: [{ Run: "r1", Score: "99.1" }] }),
    ],
    { encoding: "utf8" }
  );

  // 3. Start server on ephemeral localhost port
  const serverProc = spawn(process.execPath, [path.join(dashDir, "server.mjs"), "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    serverProc.kill("SIGTERM");
  });

  const baseUrl = await waitForUrl(dashDir);
  assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/$/);

  // Verify HTML
  const htmlRes = await fetch(baseUrl);
  assert.equal(htmlRes.status, 200);
  assert.equal(htmlRes.headers.get("cache-control"), "no-store");
  const html = await htmlRes.text();
  assert.match(html, /Live Task Dashboard/);

  // Verify /api/snapshot
  const snapRes = await fetch(`${baseUrl}api/snapshot`);
  assert.equal(snapRes.status, 200);
  const snap = await snapRes.json();
  assert.equal(snap.state.phase, "Building");
  assert.equal(snap.state.overallPercent, 45);
  assert.equal(snap.state.stages.length, 2);
  assert.equal(snap.state.metrics[0].value, "42");
  assert.equal(snap.state.decisions[0].value, "MIT");
  assert.equal(snap.state.items[0].badges.Builder, "running");
  assert.equal(snap.state.gates[0].status, "passed");
  assert.equal(snap.state.results[0].Score, "99.1");
  assert.match(snap.logTails.main.text, /worker ready/);
  assert.match(snap.logTails["item:api"].text, /worker ready/);
  assert.equal(snap.events.at(-1).actor, "coordinator");
  assert.equal(snap.events.at(-1).level, "ok");

  // Verify /api/stream initial frame
  const controller = new AbortController();
  const sseRes = await fetch(`${baseUrl}api/stream`, { signal: controller.signal });
  assert.equal(sseRes.status, 200);
  assert.match(sseRes.headers.get("content-type") || "", /text\/event-stream/);
  const reader = sseRes.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  assert.match(chunk, /^data: \{/);
  controller.abort();

  // Verify --complete freezes completedAt and sets 100%
  execFileSync(process.execPath, [updateScript, "--complete", "--now", "Done"], { encoding: "utf8" });
  const finalSnap = await (await fetch(`${baseUrl}api/snapshot`)).json();
  assert.equal(finalSnap.state.status, "complete");
  assert.equal(finalSnap.state.overallPercent, 100);
  assert.ok(finalSnap.state.completedAt, "completedAt should be set on --complete");
});
