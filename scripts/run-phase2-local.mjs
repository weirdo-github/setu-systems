import { readFile } from "node:fs/promises";

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = await readFile(file, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) {
          process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Local env files are optional for CI and hosted runtime usage.
    }
  }
}

await loadLocalEnv();

const baseUrl = (process.env.DISCOVER_URL || "http://127.0.0.1:4173")
  .replace(/\/discover\/?$/, "")
  .replace(/\/$/, "");
const token = process.env.PHASE2_RUN_TOKEN;
const mode = process.argv[2] || process.env.PHASE2_RUN_MODE || "scheduled";

if (!token) {
  console.error("PHASE2_RUN_TOKEN is required for local Phase 2 runs.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/discover/ingestion/run`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-discover-run-token": token,
  },
  body: JSON.stringify({ mode }),
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(payload.error || `Phase 2 run failed with HTTP ${response.status}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      id: payload.run?.id,
      status: payload.run?.status,
      pagesChecked: payload.run?.pages_checked,
      pagesChanged: payload.run?.pages_changed,
      eventsUpserted: payload.run?.events_upserted,
      reviewItems: payload.run?.low_confidence_count,
      error: payload.run?.error,
    },
    null,
    2,
  ),
);
