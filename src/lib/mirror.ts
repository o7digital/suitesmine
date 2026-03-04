import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MIRROR_ROOT = resolve(process.cwd(), "site-mirror/suitesmine.com");
const INDEX_FILE = "index.html";

function walkIndexRoutes(dir: string, segments: string[], routes: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  if (entries.some((entry) => entry.isFile() && entry.name === INDEX_FILE)) {
    routes.push(segments.join("/"));
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    walkIndexRoutes(join(dir, entry.name), [...segments, entry.name], routes);
  }
}

export function getMirrorRouteSlugs(): string[] {
  const routes: string[] = [];
  walkIndexRoutes(MIRROR_ROOT, [], routes);

  return routes
    .filter((route) => route.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

export function readMirrorHtmlBySlug(slug = ""): string {
  const segments = slug.split("/").filter(Boolean);
  const htmlPath = join(MIRROR_ROOT, ...segments, INDEX_FILE);

  if (!existsSync(htmlPath)) {
    throw new Error(`Mirror page not found: ${htmlPath}`);
  }

  // Astro already injects <!DOCTYPE html>; strip a duplicate if present in source.
  return readFileSync(htmlPath, "utf-8").replace(/^\uFEFF?\s*<!doctype html>\s*/i, "");
}

