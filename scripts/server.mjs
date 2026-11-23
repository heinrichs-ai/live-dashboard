#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function getFlag(name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const DASH_DIR = path.resolve(getFlag("--dir", __dirname));
const REQUESTED_PORT = Number(getFlag("--port", process.env.PORT || "0"));
const MAX_LOG_BYTES = 24000;

const FILES = {
  html: path.join(DASH_DIR, "index.html"),
  state: path.join(DASH_DIR, "state.json"),
  events: path.join(DASH_DIR, "events.jsonl"),
  url: path.join(DASH_DIR, "url.txt"),
  port: path.join(DASH_DIR, "port.txt"),
};

let lastGoodState = {};

function readStateSafe() {
  try {
    const raw = fs.readFileSync(FILES.state, "utf8");
    const parsed = JSON.parse(raw);
    lastGoodState = parsed;
    return parsed;
  } catch {
    return lastGoodState;
  }
}

function readEventsSafe() {
  try {
    const raw = fs.readFileSync(FILES.events, "utf8").trim();
    if (!raw) return [];
    const lines = raw.split("\n");
    const out = [];
    for (const line of lines.slice(-200)) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // Ignore partial line during append
      }
    }
    return out;
  } catch {
    return [];
  }
}

function tailFileSafe(filePath, tailLines = 60) {
  if (!filePath || typeof filePath !== "string") return { text: "", mtimeIso: null };
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { text: "", mtimeIso: null };
    const start = Math.max(0, stat.size - MAX_LOG_BYTES);
    const len = stat.size - start;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, buf, 0, len, start);
    } finally {
      fs.closeSync(fd);
    }
    let text = buf.toString("utf8");
    if (start > 0) {
      const nl = text.indexOf("\n");
      if (nl !== -1) text = text.slice(nl + 1);
    }
    const lines = text.split(/\r?\n/);
    return {
      text: lines.slice(-Math.max(1, Number(tailLines) || 60)).join("\n"),
      mtimeIso: stat.mtime.toISOString(),
    };
  } catch {
    return { text: "", mtimeIso: null };
  }
}

function getPayload() {
  const state = readStateSafe();
  const events = readEventsSafe();
  const logTails = {};

  if (Array.isArray(state.logFiles)) {
    for (const lf of state.logFiles) {
      if (lf && lf.id && lf.path) {
        logTails[lf.id] = {
          id: lf.id,
          label: lf.label || lf.id,
          path: lf.path,
          ...tailFileSafe(lf.path, lf.tailLines || 60),
        };
      }
    }
  }

  if (Array.isArray(state.items)) {
    for (const item of state.items) {
      if (item && item.id && item.logPath) {
        logTails[`item:${item.id}`] = {
          id: `item:${item.id}`,
          label: item.name || item.id,
          path: item.logPath,
          ...tailFileSafe(item.logPath, item.tailLines || 40),
        };
      }
    }
  }

  return {
    state,
    events,
    logTails,
    serverTime: new Date().toISOString(),
  };
}

const clients = new Set();
let lastHash = "";

function broadcast(force = false) {
  if (clients.size === 0 && !force) return;
  const payload = getPayload();
  const serialized = JSON.stringify(payload);
  const hash = JSON.stringify({ state: payload.state, events: payload.events, logTails: payload.logTails });
  if (!force && hash === lastHash) return;
  lastHash = hash;
  const frame = `data: ${serialized}\n\n`;
  for (const res of clients) {
    try {
      res.write(frame);
    } catch {
      clients.delete(res);
    }
  }
}

let debounceTimer = null;
function scheduleBroadcast() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => broadcast(false), 50);
}

try {
  fs.watch(DASH_DIR, (_eventType, filename) => {
    if (filename === "state.json" || filename === "events.jsonl") {
      scheduleBroadcast();
    }
  });
} catch {
  // Fallback interval handles updates
}

setInterval(() => broadcast(false), 1000);

setInterval(() => {
  for (const res of clients) {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clients.delete(res);
    }
  }
}, 25000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(getPayload())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname === "/api/snapshot") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(getPayload()));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    try {
      res.end(fs.readFileSync(FILES.html, "utf8"));
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing index.html");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

function startListening(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && port !== 0) {
      startListening(0);
      return;
    }
    console.error(err);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    const actualPort = typeof addr === "object" && addr ? addr.port : port;
    const urlStr = `http://127.0.0.1:${actualPort}/`;
    try {
      fs.writeFileSync(FILES.port, String(actualPort) + "\n", "utf8");
      fs.writeFileSync(FILES.url, urlStr + "\n", "utf8");
    } catch {
      // Ignore write error if dir is read-only
    }
    console.log(`LIVE_DASHBOARD_PORT=${actualPort}`);
    console.log(`LIVE_DASHBOARD_URL=${urlStr}`);
  });
}

startListening(Number.isFinite(REQUESTED_PORT) && REQUESTED_PORT >= 0 ? REQUESTED_PORT : 0);
