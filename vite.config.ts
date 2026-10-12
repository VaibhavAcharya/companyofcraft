import { defineConfig } from "vite";

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

export default defineConfig({
  appType: "mpa",
  plugins: [
    {
      name: "content-security-policy",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        notFound: "404.html",
      },
    },
  },
});
