import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.suitesmine.com",
  integrations: [
    sitemap({
      filter(page) {
        const path = new URL(page).pathname;
        const allowed = new Set([
          "/",
          "/en/",
          "/about-the-hotel/",
          "/en/about-the-hotel/",
          "/amenities-services/",
          "/en/amenities-services/",
          "/contact/",
          "/en/contact/",
          "/estudio/",
          "/en/estudio/",
          "/local-activities/",
          "/en/local-activities/",
          "/preguntas/",
          "/en/preguntas/",
          "/room/apartment-king/",
          "/en/room/apartment-king/",
          "/room/avenue-view-penthouse/",
          "/en/room/avenue-view-penthouse/",
          "/room/city-view-studio/",
          "/en/room/city-view-studio/",
          "/room/deluxe-penthouse/",
          "/en/room/deluxe-penthouse/",
          "/room/one-bed-apartment/",
          "/en/room/one-bed-apartment/",
          "/room/park-view-penthouse/",
          "/en/room/park-view-penthouse/",
          "/room/studio-king/",
          "/en/room/studio-king/",
          "/room/studio-with-balcony/",
          "/en/room/studio-with-balcony/",
          "/room/terrace-apartment/",
          "/en/room/terrace-apartment/",
          "/rooms/",
          "/en/rooms/",
          "/suites/",
          "/en/suites/",
          "/suites-doble/",
          "/en/suites-doble/",
          "/the-restaurant/",
          "/en/the-restaurant/",
        ]);

        return allowed.has(path);
      },
    }),
  ],
  output: "static",
  trailingSlash: "always",
});
