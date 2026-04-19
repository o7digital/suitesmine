import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MIRROR_ROOT = resolve(process.cwd(), "site-mirror/suitesmine.com");
const INDEX_FILE = "index.html";
const EXCLUDED_ROUTE_SEGMENTS = new Set([
  "wp-admin",
  "wp-content",
  "wp-includes",
  "wp-json",
  "xmlrpc.php",
]);

function hasExcludedSegment(segments: string[]): boolean {
  return segments.some((segment) => EXCLUDED_ROUTE_SEGMENTS.has(segment));
}

const RUNTIME_SHIM = `<script id="detached-runtime-shim">
if (typeof cozystayAjaxNavigation === "undefined") {
  var cozystayAjaxNavigation = { noMoreText: "No More Posts", url: "", data: { action: "", query: { paged: 1 } } };
}
if (typeof loftoceanSocialAjax === "undefined") {
  var loftoceanSocialAjax = { url: "", like: { action: "" }, social: { action: "" }, loadPostMetasDynamically: "", currentPostID: "" };
}
if (typeof elementorFrontendConfig === "undefined") {
  var elementorFrontendConfig = {
    environmentMode: { edit: false, wpPreview: false, isScriptDebug: false },
    i18n: {},
    is_rtl: false,
    breakpoints: { xs: 0, sm: 480, md: 768, lg: 1025, xl: 1440, xxl: 1600 },
    responsive: { breakpoints: {} },
    version: "3.35.0",
    is_static: true,
    experimentalFeatures: {},
    urls: { assets: "/assets/plugins/elementor/assets/", ajaxurl: "", uploadUrl: "/assets/uploads" },
    nonces: {},
    swiperClass: "swiper",
    settings: { page: [], editorPreferences: [] },
    kit: { active_breakpoints: ["viewport_mobile", "viewport_tablet"] },
    post: { id: 0, title: "", excerpt: "", featuredImage: false }
  };
}
</script>`;

function injectRuntimeShim(html: string): string {
  if (html.includes('id="detached-runtime-shim"')) {
    return html;
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `${RUNTIME_SHIM}\n</head>`);
  }

  return `${RUNTIME_SHIM}\n${html}`;
}

function walkIndexRoutes(dir: string, segments: string[], routes: string[]): void {
  if (hasExcludedSegment(segments)) {
    return;
  }

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
  const html = readFileSync(htmlPath, "utf-8").replace(/^\uFEFF?\s*<!doctype html>\s*/i, "");
  return injectRuntimeShim(html);
}
