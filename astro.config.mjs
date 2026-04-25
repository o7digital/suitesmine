import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.suitesmine.com",
  integrations: [sitemap()],
  output: "static",
  trailingSlash: "always",
});
