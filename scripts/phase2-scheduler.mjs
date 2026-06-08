import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const scheduleTime = process.env.PHASE2_SCHEDULE_TIME || "06:00";
const immediate = process.env.PHASE2_RUN_IMMEDIATE === "true" || process.argv.includes("--now");

function nextDelayMs(time) {
  const [hour = "6", minute = "0"] = time.split(":");
  const next = new Date();
  next.setHours(Number(hour), Number(minute), 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.getTime() - Date.now();
}

function nextHourlyDelayMs() {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.getTime() - Date.now();
}

function hasFinanceConfig() {
  return Boolean(process.env.FINANCE_BASE_URL && process.env.FINANCE_INTEGRATION_KEY);
}

async function runScript(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function runFinanceSync() {
  if (!hasFinanceConfig()) {
    console.log("Finance engagement sync skipped; FINANCE_BASE_URL and FINANCE_INTEGRATION_KEY are not configured.");
    return 0;
  }

  return runScript("scripts/syncFinanceStatus.js");
}

async function runOnce() {
  await runFinanceSync();
  return runScript("scripts/run-phase2-local.mjs", ["scheduled"]);
}

async function scheduleNext() {
  const delay = nextDelayMs(scheduleTime);
  const nextAt = new Date(Date.now() + delay);
  console.log(`Next Phase 2 ingestion run scheduled for ${nextAt.toLocaleString()}.`);
  setTimeout(async () => {
    await runOnce();
    void scheduleNext();
  }, delay);
}

async function scheduleHourlyFinanceSync() {
  const delay = nextHourlyDelayMs();
  const nextAt = new Date(Date.now() + delay);
  console.log(`Next Finance engagement sync scheduled for ${nextAt.toLocaleString()}.`);
  setTimeout(async () => {
    await runFinanceSync();
    void scheduleHourlyFinanceSync();
  }, delay);
}

if (immediate) {
  await runOnce();
}

void scheduleHourlyFinanceSync();
void scheduleNext();
