import { readFile } from "node:fs/promises";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer, defineConfig, type ViteDevServer } from "vite";
import {
  htmlFile,
  markdownPath,
  pageMarkdown,
  pagePath,
} from "./scripts/markdown.ts";

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src https://umami.vaibhavacharya.com; connect-src https://umami.vaibhavacharya.com; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

const TOOL_PATHS = [
  "/og-preview.html",
  "/security-headers.html",
  "/agent-readability.html",
  "/favicon-checker.html",
  "/ip-lookup.html",
];

const TOOL_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self' https://umami.vaibhavacharya.com; connect-src 'self' https://umami.vaibhavacharya.com; style-src 'self'; img-src 'self' https:; font-src 'self'; base-uri 'none'; form-action 'self'";

const PRERENDER = /<!--prerender (\S+)-->/;

let buildRenderer: Promise<ViteDevServer> | undefined;

async function prerender(html: string, server: ViteDevServer | undefined) {
  const match = html.match(PRERENDER);
  if (match === null) {
    return html;
  }
  buildRenderer ??=
    server === undefined
      ? createServer({
          server: { middlewareMode: true, hmr: false, ws: false },
          appType: "custom",
        })
      : undefined;
  const renderer = server ?? (await buildRenderer);
  if (renderer === undefined) {
    throw new Error("No server to render pages");
  }
  const page = await renderer.ssrLoadModule(match[1]);
  return html.replace(match[0], renderToString(createElement(page.default)));
}

export default defineConfig({
  appType: "mpa",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "prerender",
      transformIndexHtml: {
        order: "pre",
        handler: (html, { server }) => prerender(html, server),
      },
      async closeBundle() {
        await (await buildRenderer)?.close();
      },
    },
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
          const html = await readFile(htmlFile(path), "utf8");
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(await pageMarkdown(await prerender(html, server)));
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
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: "system-dark-mode",
          Rule(rule, { AtRule }) {
            if (rule.selector === ".dark") {
              const media = new AtRule({
                name: "media",
                params: "(prefers-color-scheme: dark)",
              });
              rule.replaceWith(media);
              rule.selector = ":root";
              media.append(rule);
            }
          },
        },
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        notFound: "404.html",
        ogPreview: "og-preview.html",
        securityHeaders: "security-headers.html",
        agentReadability: "agent-readability.html",
        faviconChecker: "favicon-checker.html",
        ipLookup: "ip-lookup.html",
      },
    },
  },
});
