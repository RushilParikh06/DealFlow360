import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PageName } from "./routes";

const pageDirectory = [path.resolve(process.cwd(), "../../pages"), path.resolve(process.cwd(), "pages")].find(existsSync);

if (!pageDirectory) throw new Error("DealFlow360 page sources were not found.");

export type LegacyPage = {
  bodyClass: string;
  html: string;
  scripts: string[];
  theme: Record<string, string>;
  title: string;
};

export function loadLegacyPage(page: PageName): LegacyPage {
  const source = readFileSync(path.join(pageDirectory!, `${page}.html`), "utf8");
  const body = source.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);

  if (!body) throw new Error(`Invalid page source: ${page}.html`);

  const bodyClass = body[1].match(/class="([^"]*)"/i)?.[1] ?? "";
  const scripts = [...body[2].matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const html = body[2].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  const title = page
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  return { bodyClass, html, scripts, theme: {}, title };
}
