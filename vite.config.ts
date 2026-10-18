import { defineConfig } from "vite";
import { markdownPath, pageMarkdown, pagePath } from "./scripts/markdown.ts";

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

const TOOL_PATHS = [
  "/og-preview.html",
  "/security-headers.html",
  "/agent-readability.html",
  "/favicon-checker.html",
];

const TOOL_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' https:; font-src 'self'; base-uri 'none'; form-action 'self'";

export default defineConfig({
  appType: "mpa",
  plugins: [
    {
      name: "markdown-pages",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const file = req.url?.split("?")[0] ?? "";
          const path = file.endsWith(".md") ? pagePath(file) : undefined;
          if (path === undefined || markdownPath(path) !== file) {
            return next();
          }
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(await pageMarkdown(path));
        });
      },
    },
    {
      name: "content-security-policy",
      apply: "build",
      transformIndexHtml: (_html, { path }) => [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: TOOL_PATHS.includes(path)
              ? TOOL_CONTENT_SECURITY_POLICY
              : CONTENT_SECURITY_POLICY,
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
        ogPreview: "og-preview.html",
        securityHeaders: "security-headers.html",
        agentReadability: "agent-readability.html",
        faviconChecker: "favicon-checker.html",
      },
    },
  },
});
