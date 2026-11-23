#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
function getFlag(name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const targetDir = getFlag("--dir");
if (!targetDir) {
  console.error("Usage: node init.mjs --dir <target-dir> --title <title> [--subtitle <text>] [--theme light|dark] [--primary <#hex>] [--accent <#hex>]");
  process.exit(1);
}

const resolvedDir = path.resolve(targetDir);
const title = getFlag("--title", "Live Task Dashboard");
const subtitle = getFlag("--subtitle", "");
const theme = getFlag("--theme", "light") === "dark" ? "dark" : "light";
const primary = getFlag("--primary", "");
const accent = getFlag("--accent", "");

fs.mkdirSync(resolvedDir, { recursive: true });

const copies = [
  [path.join(__dirname, "server.mjs"), path.join(resolvedDir, "server.mjs")],
  [path.join(__dirname, "update.mjs"), path.join(resolvedDir, "update.mjs")],
  [path.join(SKILL_ROOT, "resources", "index.html"), path.join(resolvedDir, "index.html")],
];

for (const [src, dst] of copies) {
  fs.copyFileSync(src, dst);
}

const now = new Date().toISOString();
const initialState = {
  title,
  subtitle,
  theme,
  brand: {
    ...(primary ? { primary } : {}),
    ...(accent ? { accent } : {}),
  },
  status: "running",
  phase: "Initializing",
  now: "Setting up task...",
  overallPercent: 0,
  startedAt: now,
  updatedAt: now,
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

const statePath = path.join(resolvedDir, "state.json");
const eventsPath = path.join(resolvedDir, "events.jsonl");

if (!fs.existsSync(statePath)) {
  fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2) + "\n", "utf8");
}
if (!fs.existsSync(eventsPath)) {
  const firstEvent = { ts: now, level: "info", actor: "system", msg: `Initialized dashboard: ${title}` };
  fs.writeFileSync(eventsPath, JSON.stringify(firstEvent) + "\n", "utf8");
}

console.log(`DASHBOARD_READY dir=${resolvedDir}`);
console.log(`START_CMD: node "${path.join(resolvedDir, "server.mjs")}" --port 0`);
console.log(`UPDATE_CMD: node "${path.join(resolvedDir, "update.mjs")}" --phase "..." --now "..." --percent 10`);
