// This Vite config file (vite.config.js) tells Rollup (production bundler)
// to treat multiple HTML files as entry points so each becomes its own built page.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        about: resolve(__dirname, "pages/about.html"),
        arrival: resolve(__dirname, "pages/arrival.html"),
        help: resolve(__dirname, "pages/help.html"),
        login: resolve(__dirname, "pages/login.html"),
        main: resolve(__dirname, "pages/main.html"),
        map: resolve(__dirname, "pages/map.html"),
        post: resolve(__dirname, "pages/post.html"),
        reports: resolve(__dirname, "pages/reports.html"),
      },
    },
  },
});
