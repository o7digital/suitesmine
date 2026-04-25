import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MIRROR_ROOT = resolve(process.cwd(), "site-mirror/suitesmine.com");
const INDEX_FILE = "index.html";
const SITE_ORIGIN = "https://www.suitesmine.com";
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
const DETACHED_NOOP_AJAX_URL = "/__detached-noop-admin-ajax";
if (typeof cozystayAjaxNavigation === "undefined") {
  var cozystayAjaxNavigation = {
    noMoreText: "No More Posts",
    url: DETACHED_NOOP_AJAX_URL,
    data: {
      query: { page: "", pagename: "", paged: 2, ignore_sticky_posts: true, post_status: "publish" },
      action: "cozystay_load_more",
      settings: {
        archive_page: "",
        page_layout: "",
        layout: "list",
        columns: false,
        post_meta: "a:4:{i:0;s:7:\\"excerpt\\";i:1;s:13:\\"read_more_btn\\";i:2;s:6:\\"author\\";i:3;s:4:\\"date\\";}"
      }
    }
  };
}
if (typeof loftoceanSocialAjax === "undefined") {
  var loftoceanSocialAjax = {
    url: DETACHED_NOOP_AJAX_URL,
    like: { action: "loftocean_post_like" },
    social: { action: "loftocean_social_counter" },
    loadPostMetasDynamically: "",
    currentPostID: ""
  };
}
if (typeof elementorFrontendConfig === "undefined") {
  var elementorFrontendConfig = {
    environmentMode: { edit: false, wpPreview: false, isScriptDebug: false },
    i18n: {
      shareOnFacebook: "Share on Facebook",
      shareOnTwitter: "Share on Twitter",
      pinIt: "Pin it",
      download: "Download",
      downloadImage: "Download image",
      fullscreen: "Fullscreen",
      zoom: "Zoom",
      share: "Share",
      playVideo: "Play Video",
      previous: "Previous",
      next: "Next",
      close: "Close",
      a11yCarouselPrevSlideMessage: "Previous slide",
      a11yCarouselNextSlideMessage: "Next slide",
      a11yCarouselFirstSlideMessage: "This is the first slide",
      a11yCarouselLastSlideMessage: "This is the last slide",
      a11yCarouselPaginationBulletMessage: "Go to slide"
    },
    is_rtl: false,
    breakpoints: { xs: 0, sm: 480, md: 768, lg: 1025, xl: 1440, xxl: 1600 },
    responsive: {
      breakpoints: {
        mobile: { label: "Mobile Portrait", value: 767, default_value: 767, direction: "max", is_enabled: true },
        mobile_extra: { label: "Mobile Landscape", value: 880, default_value: 880, direction: "max", is_enabled: false },
        tablet: { label: "Tablet Portrait", value: 1024, default_value: 1024, direction: "max", is_enabled: true },
        tablet_extra: { label: "Tablet Landscape", value: 1200, default_value: 1200, direction: "max", is_enabled: false },
        laptop: { label: "Laptop", value: 1366, default_value: 1366, direction: "max", is_enabled: false },
        widescreen: { label: "Widescreen", value: 2400, default_value: 2400, direction: "min", is_enabled: false }
      },
      hasCustomBreakpoints: false
    },
    version: "3.35.7",
    is_static: false,
    experimentalFeatures: {
      e_font_icon_svg: true,
      additional_custom_breakpoints: true,
      container: true,
      "nested-elements": true,
      home_screen: true,
      global_classes_should_enforce_capabilities: true,
      e_variables: true,
      "cloud-library": true,
      e_opt_in_v4_page: true,
      e_components: true,
      e_interactions: true,
      e_editor_one: true,
      "import-export-customization": true
    },
    urls: {
      assets: "/assets/plugins/elementor/assets/",
      ajaxurl: DETACHED_NOOP_AJAX_URL,
      uploadUrl: "/assets/uploads"
    },
    nonces: { floatingButtonsClickTracking: "" },
    swiperClass: "swiper",
    settings: { page: [], editorPreferences: [] },
    kit: {
      active_breakpoints: ["viewport_mobile", "viewport_tablet"],
      global_image_lightbox: "yes",
      lightbox_enable_counter: "yes",
      lightbox_enable_fullscreen: "yes",
      lightbox_enable_zoom: "yes",
      lightbox_enable_share: "yes",
      lightbox_title_src: "title",
      lightbox_description_src: "description"
    },
    post: { id: 0, title: "", excerpt: "", featuredImage: false }
  };
}

// Fallback lightbox for detached static mirrors when Elementor dynamic lightbox assets are missing.
(function () {
  var overlayId = "detached-lightbox-overlay";
  var styleId = "detached-lightbox-style";

  function ensureStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      "#" + overlayId + " { position: fixed; inset: 0; background: rgba(10,10,10,.92); z-index: 999999; display: none; align-items: center; justify-content: center; }",
      "#" + overlayId + ".is-open { display: flex; }",
      "#" + overlayId + " img { max-width: 92vw; max-height: 88vh; object-fit: contain; box-shadow: 0 12px 50px rgba(0,0,0,.45); }",
      "#" + overlayId + " .dlb-btn { position: absolute; border: 0; background: rgba(255,255,255,.16); color: #fff; font-size: 28px; line-height: 1; width: 44px; height: 44px; cursor: pointer; }",
      "#" + overlayId + " .dlb-close { top: 16px; right: 16px; }",
      "#" + overlayId + " .dlb-prev { left: 16px; top: 50%; transform: translateY(-50%); }",
      "#" + overlayId + " .dlb-next { right: 16px; top: 50%; transform: translateY(-50%); }",
      ".site-footer .elementor-widget-cs_social, .site-footer .social-navigation, .site-footer .socialwidget { display: none !important; }"
    ].join("");
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    var existing = document.getElementById(overlayId);
    if (existing) return existing;

    var overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.innerHTML = [
      '<button class="dlb-btn dlb-close" aria-label="Close">×</button>',
      '<button class="dlb-btn dlb-prev" aria-label="Previous">‹</button>',
      '<img alt="" />',
      '<button class="dlb-btn dlb-next" aria-label="Next">›</button>'
    ].join("");
    document.body.appendChild(overlay);
    return overlay;
  }

  function initFallbackLightbox() {
    ensureStyle();
    var overlay = ensureOverlay();
    var imageEl = overlay.querySelector("img");
    var group = [];
    var index = 0;
    var scale = 1;

    function resetZoom() {
      scale = 1;
      imageEl.style.transform = "scale(1)";
      imageEl.style.transformOrigin = "center center";
      imageEl.style.cursor = "zoom-in";
    }

    function open(items, startIndex) {
      group = items;
      index = startIndex;
      imageEl.src = group[index].href;
      resetZoom();
      overlay.classList.add("is-open");
      document.documentElement.style.overflow = "hidden";
    }

    function close() {
      overlay.classList.remove("is-open");
      document.documentElement.style.overflow = "";
      imageEl.removeAttribute("src");
      resetZoom();
    }

    function move(step) {
      if (!group.length) return;
      index = (index + step + group.length) % group.length;
      imageEl.src = group[index].href;
      resetZoom();
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".dlb-close").addEventListener("click", close);
    overlay.querySelector(".dlb-prev").addEventListener("click", function () { move(-1); });
    overlay.querySelector(".dlb-next").addEventListener("click", function () { move(1); });
    imageEl.addEventListener("dblclick", function () {
      if (scale === 1) {
        scale = 2;
        imageEl.style.transform = "scale(2)";
        imageEl.style.cursor = "zoom-out";
      } else {
        resetZoom();
      }
    });
    imageEl.addEventListener("wheel", function (e) {
      if (!overlay.classList.contains("is-open")) return;
      e.preventDefault();
      scale += e.deltaY < 0 ? 0.15 : -0.15;
      if (scale < 1) scale = 1;
      if (scale > 4) scale = 4;
      imageEl.style.transform = "scale(" + scale + ")";
      imageEl.style.cursor = scale > 1 ? "zoom-out" : "zoom-in";
    }, { passive: false });

    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    });

    document.addEventListener("click", function (e) {
      var link = e.target && e.target.closest && e.target.closest('a[data-elementor-open-lightbox="yes"], .cs-gallery-item a[href], .gallery-item a[href]');
      if (!link) return;
      var href = link.getAttribute("href") || "";
      var looksLikeImage = /\\.(avif|webp|png|jpe?g|gif|svg)(\\?.*)?$/i.test(href);
      var shouldHandle = link.getAttribute("data-elementor-open-lightbox") === "yes" || looksLikeImage;
      if (!shouldHandle) return;

      e.preventDefault();
      var groupId = link.getAttribute("data-elementor-lightbox-slideshow");
      var selector = "";
      if (groupId) {
        selector = 'a[data-elementor-open-lightbox="yes"][data-elementor-lightbox-slideshow="' + groupId + '"]';
      } else {
        var galleryRoot = link.closest(".cs-gallery, .gallery, .cs-gallery-wrap, .gallery-carousel");
        selector = galleryRoot ? "a[href]" : 'a[data-elementor-open-lightbox="yes"], .cs-gallery-item a[href], .gallery-item a[href]';
      }
      var rawItems = Array.prototype.slice.call((selector === "a[href]" && link.closest(".cs-gallery, .gallery, .cs-gallery-wrap, .gallery-carousel"))
        ? link.closest(".cs-gallery, .gallery, .cs-gallery-wrap, .gallery-carousel").querySelectorAll("a[href]")
        : document.querySelectorAll(selector));
      var items = rawItems.filter(function (a) {
        var u = a.getAttribute("href") || "";
        return /\\.(avif|webp|png|jpe?g|gif|svg)(\\?.*)?$/i.test(u);
      });
      if (!items.length) return;
      var start = items.indexOf(link);
      open(items, start < 0 ? 0 : start);
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFallbackLightbox);
  } else {
    initFallbackLightbox();
  }
})();
</script>`;

export type MirrorDocument = {
  htmlAttributes: Record<string, string | boolean>;
  headInnerHtml: string;
  bodyAttributes: Record<string, string | boolean>;
  bodyInnerHtml: string;
};

function injectRuntimeShim(html: string): string {
  if (html.includes('id="detached-runtime-shim"')) {
    return html;
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `${RUNTIME_SHIM}\n</head>`);
  }

  return `${RUNTIME_SHIM}\n${html}`;
}

function sanitizeMirrorRuntime(html: string): string {
  return html
    // Remove legacy pingback tags that point to xmlrpc endpoints.
    .replace(/<link[^>]*rel=["']pingback["'][^>]*>\s*/gi, "")
    .replaceAll("/xmlrpc.php", "/__detached-noop-xmlrpc")
    .replaceAll("/en/xmlrpc.php", "/__detached-noop-xmlrpc")
    .replaceAll('wp.apiFetch.createRootURLMiddleware( "/wp-json/" )', 'wp.apiFetch.createRootURLMiddleware( "/__detached-noop-wp-json/" )')
    .replaceAll("wp-json/", "__detached-noop-wp-json/")
    .replaceAll("/__detached-noop-__detached-noop-wp-json/", "/__detached-noop-wp-json/")
    .replaceAll("https://suitesmine.com/wp-admin/admin-ajax.php", "/__detached-noop-admin-ajax")
    .replaceAll("https://suitesmine.com/wp-content/plugins/elementor/assets/", "/assets/plugins/elementor/assets/")
    .replaceAll("https://suitesmine.com/wp-content/uploads", "/assets/uploads")
    .replaceAll("https:\\/\\/suitesmine.com\\/wp-content\\/uploads", "\\/assets\\/uploads")
    .replaceAll("https:\\/\\u002F\\u002Fsuitesmine.com\\u002Fwp-content\\u002Fuploads", "\\/assets\\u002Fuploads")
    .replaceAll("https:\\/\\/suitesmine.com\\/wp-content\\/plugins\\/elementor\\/assets\\/", "\\/assets\\/plugins\\/elementor\\/assets\\/")
    .replaceAll("%5C%2Fwp-content%5C%2Fuploads", "%5C%2Fassets%5C%2Fuploads")
    .replaceAll("%5C%2F%5C%2Fsuitesmine.com%5C%2Fwp-content%5C%2Fuploads", "%5C%2Fassets%5C%2Fuploads")
    .replaceAll("%5C%2Fwp-content%5C%2Fplugins%5C%2Felementor%5C%2Fassets%5C%2F", "%5C%2Fassets%5C%2Fplugins%5C%2Felementor%5C%2Fassets%5C%2F")
    .replaceAll("%5C%2Fwp-content%5C%2Fplugins%5C%2Fwoocommerce%5C%2Fassets%5C%2F", "%5C%2Fassets%5C%2Fplugins%5C%2Fwoocommerce%5C%2Fassets%5C%2F")
    .replaceAll("%5C%2F%5C%2Fsuitesmine.com%5C%2Fwp-content%5C%2Fplugins%5C%2Fwoocommerce%5C%2Fassets%5C%2F", "%5C%2Fassets%5C%2Fplugins%5C%2Fwoocommerce%5C%2Fassets%5C%2F")
    .replaceAll("%5C%2Fwp-login.php", "%5C%2F__detached-noop-login")
    .replaceAll("%5C%2F%5C%2Fsuitesmine.com%5C%2Fwp-login.php", "%5C%2F__detached-noop-login")
    .replaceAll("%5C%2Fwp-json%5C%2F", "%5C%2F__detached-noop-wp-json%5C%2F")
    .replaceAll("https://suitesmine.com/wp-login.php", "/__detached-noop-login")
    .replaceAll("https:\\/\\/suitesmine.com\\/wp-login.php", "\\/__detached-noop-login");
}

function hasWebpVariant(uploadPath: string): boolean {
  const clean = uploadPath.replace(/^\/+/, "");
  const source = join(MIRROR_ROOT, "wp-content", clean);
  const webp = source.replace(/\.(?:jpe?g|png)$/i, ".webp");
  return existsSync(webp);
}

function replaceUploadsWithWebp(html: string): string {
  const plainPattern = /\/assets\/uploads\/([^\s"'()<>?#]+\.(?:jpe?g|png))(?=([?#][^"')<>\s]*)?|["')<>\s])/gi;
  const escapedPattern = /\\\/assets\\\/uploads\\\/([^"'()<>\s?#]+?\.(?:jpe?g|png))(?=([?#][^"'()<>\s]*)?|["'<>\s])/gi;

  const replacePlain = (value: string): string =>
    value.replace(plainPattern, (full, relativePath) => {
      const lookupPath = `uploads/${relativePath}`;
      return hasWebpVariant(lookupPath) ? full.replace(/\.(?:jpe?g|png)$/i, ".webp") : full;
    });

  return replacePlain(html).replace(escapedPattern, (full, relativePath) => {
    const normalizedPath = String(relativePath).replaceAll("\\/", "/");
    const lookupPath = `uploads/${normalizedPath}`;
    return hasWebpVariant(lookupPath) ? full.replace(/\.(?:jpe?g|png)$/i, ".webp") : full;
  });
}

function normalizeOgImageType(html: string): string {
  return html.replace(
    /(<meta\s+property=["']og:image["']\s+content=["'][^"']+\.webp["'][^>]*>[\s\S]{0,400}?<meta\s+property=["']og:image:type["']\s+content=["'])image\/(?:jpeg|png)(["'][^>]*>)/gi,
    "$1image/webp$2"
  );
}

function getCanonicalPath(slug: string): string {
  const clean = slug.split("/").filter(Boolean).join("/");
  return clean.length === 0 ? "/" : `/${clean}/`;
}

function stripSmartCrawlJsonLd(html: string): string {
  return html.replace(
    /<!--\s*SEO meta tags powered by SmartCrawl[\s\S]*?<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi,
    ""
  );
}

function normalizeOgUrl(html: string, canonicalUrl: string): string {
  return html.replace(
    /(<meta\s+property=["']og:url["']\s+content=["'])[^"']*(["'][^>]*>)/gi,
    `$1${canonicalUrl}$2`
  );
}

function upsertCanonical(html: string, canonicalUrl: string): string {
  const withoutCanonical = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "");
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;

  if (withoutCanonical.includes("</head>")) {
    return withoutCanonical.replace("</head>", `${canonicalTag}\n</head>`);
  }

  return `${withoutCanonical}\n${canonicalTag}`;
}

function upsertHreflangSet(html: string): string {
  const withoutAlternates = html.replace(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["'][^"']+["'][^>]*>\s*/gi, "");
  const alternateTags = [
    '<link rel="alternate" href="https://www.suitesmine.com/" hreflang="es" />',
    '<link rel="alternate" href="https://www.suitesmine.com/en/" hreflang="en" />',
    '<link rel="alternate" href="https://www.suitesmine.com/" hreflang="x-default" />',
  ].join("\n");

  if (withoutAlternates.includes("</head>")) {
    return withoutAlternates.replace("</head>", `${alternateTags}\n</head>`);
  }

  return `${withoutAlternates}\n${alternateTags}`;
}

function normalizeSeo(html: string, slug: string): string {
  const canonicalUrl = `${SITE_ORIGIN}${getCanonicalPath(slug)}`;
  const noDuplicateSeo = stripSmartCrawlJsonLd(html);
  const withOgUrl = normalizeOgUrl(noDuplicateSeo, canonicalUrl);
  const withCanonical = upsertCanonical(withOgUrl, canonicalUrl);
  return upsertHreflangSet(withCanonical);
}

function isEnglishSlug(slug: string): boolean {
  return slug === "en" || slug.startsWith("en/");
}

function upsertFooterKeywordCloud(html: string, slug: string): string {
  const markerId = "seo-keywords-footer";
  const withoutExisting = html.replace(
    /<div id=["']seo-keywords-footer["'][\s\S]*?<\/div>\s*/gi,
    ""
  );

  const spanishKeywords = [
    "suites en cdmx",
    "suites cerca del angel de la independencia",
    "hotel con suites en reforma",
    "departamentos amueblados en cdmx",
    "alojamiento ejecutivo en cdmx",
    "suites para estancias largas cdmx",
    "hospedaje en colonia cuauhtemoc",
    "apart hotel en ciudad de mexico",
    "suites con cocina en cdmx",
    "hotel boutique cerca de reforma",
    "hospedaje para negocios cdmx",
    "suites cerca de embajada usa cdmx",
    "alojamiento cerca de zona rosa",
    "suites con terraza en cdmx",
    "donde hospedarse cerca del angel cdmx",
  ];

  const englishKeywords = [
    "suites in mexico city",
    "suites near angel of independence",
    "hotel suites near reforma",
    "furnished apartments in mexico city",
    "executive stay in mexico city",
    "extended stay suites mexico city",
    "accommodation in cuauhtemoc mexico city",
    "aparthotel in mexico city",
    "suites with kitchen in mexico city",
    "boutique hotel near reforma avenue",
    "business travel stay mexico city",
    "suites near us embassy mexico city",
    "stay near zona rosa mexico city",
    "suites with terrace in mexico city",
    "where to stay near angel of independence",
  ];

  const keywords = isEnglishSlug(slug) ? englishKeywords : spanishKeywords;
  const content = keywords.join(" · ");
  const keywordBlock = `<div id="${markerId}" style="margin-top:24px;padding:18px 12px 26px;border-top:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.68);font-size:13px;line-height:1.9;text-align:center;text-wrap:pretty;">${content}</div>`;

  if (withoutExisting.includes("</body>")) {
    return withoutExisting.replace("</body>", `${keywordBlock}\n</body>`);
  }

  return `${withoutExisting}\n${keywordBlock}`;
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
  const sanitized = sanitizeMirrorRuntime(html);
  const webpOptimized = replaceUploadsWithWebp(sanitized);
  const seoNormalized = normalizeSeo(normalizeOgImageType(webpOptimized), slug);
  const withFooterKeywords = upsertFooterKeywordCloud(seoNormalized, slug);
  return injectRuntimeShim(withFooterKeywords);
}

function extractTagAttrs(html: string, tagName: "html" | "body"): string {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "i");
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractTagInner(html: string, tagName: "head" | "body"): string {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match?.[1] ?? "";
}

function parseHtmlAttributes(attrs: string): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  const attrPattern = /([:@A-Za-z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/=`]+)))?/g;
  let match: RegExpExecArray | null = null;

  while ((match = attrPattern.exec(attrs)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    parsed[key] = value ?? true;
  }

  return parsed;
}

export function readMirrorDocumentBySlug(slug = ""): MirrorDocument {
  const html = readMirrorHtmlBySlug(slug);
  const htmlAttrs = extractTagAttrs(html, "html");
  const bodyAttrs = extractTagAttrs(html, "body");

  return {
    htmlAttributes: parseHtmlAttributes(htmlAttrs),
    headInnerHtml: extractTagInner(html, "head"),
    bodyAttributes: parseHtmlAttributes(bodyAttrs),
    bodyInnerHtml: extractTagInner(html, "body"),
  };
}
