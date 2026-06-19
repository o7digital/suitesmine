import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.suitesmine.com",
  integrations: [
    sitemap({
      filter(page) {
        const path = new URL(page).pathname;
        const baseRoutes = [
          "/",
          "/about-the-hotel/",
          "/amenities-services/",
          "/contact/",
          "/estudio/",
          "/local-activities/",
          "/preguntas/",
          "/room/apartment-king/",
          "/room/avenue-view-penthouse/",
          "/room/city-view-studio/",
          "/room/deluxe-penthouse/",
          "/room/one-bed-apartment/",
          "/room/park-view-penthouse/",
          "/room/studio-king/",
          "/room/studio-with-balcony/",
          "/room/terrace-apartment/",
          "/rooms/",
          "/suites/",
          "/suites-doble/",
          "/the-restaurant/",
        ];
        const allowed = new Set(
          baseRoutes.flatMap((route) => [
            route,
            route === "/" ? "/en/" : `/en${route}`,
            route === "/" ? "/zh/" : `/zh${route}`,
          ]),
        );

        return allowed.has(path);
      },
    }),
  ],
  output: "static",
  trailingSlash: "always",
});
