import { defineConfig } from "vite";

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        notFound: "404.html",
      },
    },
  },
});
