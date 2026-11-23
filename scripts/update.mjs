#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

let dashDir = __dirname;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--dir" && i + 1 < args.length) {
    dashDir = path.resolve(args[i + 1]);
    break;
  }
}

const STATE_PATH = path.join(dashDir, "state.json");
const TMP_PATH = path.join(dashDir, `state.${process.pid}.tmp`);
const EVENTS_PATH = path.join(dashDir, "events.jsonl");

const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
  : {
      title: "Live Task Dashboard",
      subtitle: "",
      theme: "light",
      brand: {},
      status: "running",
      phase: "Working",
      now: "",
      overallPercent: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      stages: [],
      metrics: [],
      decisions: [],
      items: [],
      gates: [],
      resultsColumns: [],
      results: [],
      logFiles: [],
    };

function readVal(idx) {
  if (idx + 1 >= args.length) throw new Error(`Missing value after ${args[idx]}`);
  return args[idx + 1];
}

function upsertById(list, entry) {
  const existing = list.find((x) => x.id === entry.id);
  if (existing) {
    Object.assign(existing, entry);
    return existing;
  }
  list.push(entry);
  return entry;
}

let activeItem = null;
const pendingEvents = [];
let eventLevel = "info";
let eventActor = "";

for (let i = 0; i < args.length; i += 1) {
  const flag = args[i];
  if (flag === "--dir") {
    i += 1;
  } else if (flag === "--title") {
    state.title = readVal(i);
    i += 1;
  } else if (flag === "--subtitle") {
    state.subtitle = readVal(i);
    i += 1;
  } else if (flag === "--theme") {
    state.theme = readVal(i) === "dark" ? "dark" : "light";
    i += 1;
  } else if (flag === "--status") {
    state.status = readVal(i);
    i += 1;
  } else if (flag === "--phase") {
    state.phase = readVal(i);
    i += 1;
  } else if (flag === "--now") {
    state.now = readVal(i);
    i += 1;
  } else if (flag === "--percent") {
    const num = Number(readVal(i));
    if (Number.isFinite(num)) state.overallPercent = Math.max(0, Math.min(100, num));
    i += 1;
  } else if (flag === "--complete") {
    state.status = "complete";
    state.overallPercent = 100;
  } else if (flag === "--stage") {
    const raw = readVal(i);
    i += 1;
    const [id, label, st] = raw.split(":");
    state.stages = state.stages || [];
    upsertById(state.stages, { id, label: label || id, status: st || "pending" });
  } else if (flag === "--item") {
    const id = readVal(i);
    i += 1;
    state.items = state.items || [];
    activeItem = state.items.find((x) => x.id === id);
    if (!activeItem) {
      activeItem = { id, name: id, status: "queued", owner: "", detail: "", badges: {} };
      state.items.push(activeItem);
    }
  } else if (flag === "--name" && activeItem) {
    activeItem.name = readVal(i);
    i += 1;
  } else if (flag === "--owner" && activeItem) {
    activeItem.owner = readVal(i);
    i += 1;
  } else if (flag === "--detail" && activeItem) {
    activeItem.detail = readVal(i);
    i += 1;
  } else if (flag === "--progress" && activeItem) {
    const num = Number(readVal(i));
    if (Number.isFinite(num)) activeItem.progress = Math.max(0, Math.min(100, num));
    i += 1;
  } else if (flag === "--log-path" && activeItem) {
    activeItem.logPath = readVal(i);
    i += 1;
  } else if (flag === "--badges" && activeItem) {
    const raw = readVal(i);
    i += 1;
    activeItem.badges = activeItem.badges || {};
    for (const pair of raw.split(",")) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq !== -1) {
        activeItem.badges[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
      }
    }
  } else if (flag === "--item-status" && activeItem) {
    activeItem.status = readVal(i);
    i += 1;
  } else if (flag === "--gate") {
    const raw = readVal(i);
    i += 1;
    const [id, label, st, ...rest] = raw.split(":");
    state.gates = state.gates || [];
    upsertById(state.gates, {
      id,
      label: label || id,
      status: st || "pending",
      detail: rest.join(":"),
    });
  } else if (flag === "--metric") {
    const raw = readVal(i);
    i += 1;
    const [id, label, value, delta = "", tone = "neutral"] = raw.split(":");
    state.metrics = state.metrics || [];
    upsertById(state.metrics, { id, label: label || id, value: value ?? "", delta, tone });
  } else if (flag === "--decision") {
    const raw = readVal(i);
    i += 1;
    const [id, label, ...rest] = raw.split(":");
    state.decisions = state.decisions || [];
    upsertById(state.decisions, { id, label: label || id, value: rest.join(":") });
  } else if (flag === "--log-file") {
    const raw = readVal(i);
    i += 1;
    const parts = raw.split(":");
    const id = parts[0];
    const label = parts[1] || id;
    const maybeLines = Number(parts[parts.length - 1]);
    const hasLines = parts.length >= 4 && Number.isFinite(maybeLines);
    const filePath = hasLines ? parts.slice(2, -1).join(":") : parts.slice(2).join(":");
    state.logFiles = state.logFiles || [];
    upsertById(state.logFiles, {
      id,
      label,
      path: filePath,
      tailLines: hasLines ? maybeLines : 60,
    });
  } else if (flag === "--level") {
    eventLevel = readVal(i);
    if (pendingEvents.length > 0 && pendingEvents[pendingEvents.length - 1].level === "info") {
      pendingEvents[pendingEvents.length - 1].level = eventLevel;
    }
    i += 1;
  } else if (flag === "--actor") {
    eventActor = readVal(i);
    if (pendingEvents.length > 0 && !pendingEvents[pendingEvents.length - 1].actor) {
      pendingEvents[pendingEvents.length - 1].actor = eventActor;
    }
    i += 1;
  } else if (flag === "--event") {
    pendingEvents.push({ msg: readVal(i), level: eventLevel, actor: eventActor });
    i += 1;
  } else if (flag === "--json") {
    const patch = JSON.parse(readVal(i));
    i += 1;
    Object.assign(state, patch);
  }
}

const now = new Date().toISOString();
state.updatedAt = now;
if ((state.status === "complete" || state.status === "failed") && !state.completedAt) {
  state.completedAt = now;
} else if (state.status === "running") {
  state.completedAt = null;
}

fs.writeFileSync(TMP_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
fs.renameSync(TMP_PATH, STATE_PATH);

if (pendingEvents.length > 0) {
  const lines = pendingEvents
    .map((ev) => JSON.stringify({ ts: now, level: ev.level || "info", actor: ev.actor || "", msg: ev.msg }))
    .join("\n");
  fs.appendFileSync(EVENTS_PATH, lines + "\n", "utf8");
}

console.log(`DASHBOARD_UPDATED status=${state.status} percent=${state.overallPercent} phase="${state.phase}"`);
