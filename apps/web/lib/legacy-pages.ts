import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PageName } from "./routes";

const pageDirectory = [path.resolve(process.cwd(), "../../pages"), path.resolve(process.cwd(), "pages")].find(existsSync);

if (!pageDirectory) throw new Error("DealFlow360 page sources were not found.");

const bluePages = new Set<PageName>(["dashboard", "login", "quotation-detail", "quotations"]);

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
  const theme: Record<string, string> = {};

  if (bluePages.has(page)) {
    Object.assign(theme, {
      "--df-outline-variant": "195 197 215",
      "--df-surface-bright": "255 252 245",
      "--df-surface-container": "237 237 248",
      "--df-surface-container-high": "231 231 242",
      "--df-surface-container-highest": "226 225 236",
    });
  }

  if (page === "login") theme["--df-surface-container-low"] = "243 243 254";
  if (page === "quotation-detail") theme["--df-primary-container"] = "36 87 214";
  if (page === "quotations") {
    theme["--df-primary"] = "36 87 214";
    theme["--df-primary-container"] = "36 87 214";
    theme["--df-gutter"] = "1.5rem";
  }

  return { bodyClass, html, scripts, theme, title };
}
