import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Next only auto-loads .env from its own project root (apps/web), but this repo
 * keeps one .env at the workspace root so the API and the web app cannot drift
 * apart. Without this, NEXT_PUBLIC_API_URL and NEXT_PUBLIC_USE_MOCKS were
 * silently undefined in the browser and the app ran on lib/api.ts's fallbacks -
 * editing .env appeared to do nothing at all.
 */
function rootEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const file = readFileSync(path.resolve(process.cwd(), "../../.env"), "utf8");
    for (const line of file.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (!key.startsWith("NEXT_PUBLIC_")) continue;
      out[key] = raw.trim().replace(/^["'](.*)["']$/, "$1");
    }
  } catch {
    // No .env yet (fresh clone). lib/api.ts falls back to localhost defaults.
  }
  return out;
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  env: rootEnv(),
};

export default nextConfig;
