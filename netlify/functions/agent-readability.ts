import type { Config } from "@netlify/functions";
import { fetchError, parseTarget, readText, safeFetch } from "../lib/fetch.ts";
import {
  decodeEntities,
  readAttributes,
  readMetaTags,
  readTags,
  readTitle,
} from "../lib/html.ts";

const MIN_WORDS = 20;
const LLMS_TXT_PREVIEW_CHARS = 2000;

const CRAWLERS = [
  { name: "GPTBot", owner: "OpenAI, training" },
  { name: "OAI-SearchBot", owner: "OpenAI, search" },
  { name: "ChatGPT-User", owner: "OpenAI, user requests" },
  { name: "ClaudeBot", owner: "Anthropic, training" },
  { name: "Claude-SearchBot", owner: "Anthropic, search" },
  { name: "Claude-User", owner: "Anthropic, user requests" },
  { name: "PerplexityBot", owner: "Perplexity, search" },
  { name: "Perplexity-User", owner: "Perplexity, user requests" },
  { name: "Google-Extended", owner: "Google, Gemini training" },
  { name: "Applebot-Extended", owner: "Apple, training" },
  { name: "meta-externalagent", owner: "Meta, training" },
  { name: "Amazonbot", owner: "Amazon" },
  { name: "Bytespider", owner: "ByteDance" },
  { name: "CCBot", owner: "Common Crawl" },
];

type Check = { ok: boolean; label: string; detail: string };
type TextFile = { url: string; type: string; text: string };
type RobotsGroup = {
  agents: string[];
  rules: { allow: boolean; path: string }[];
};

export const config: Config = {
  path: "/api/agent-readability",
  method: "GET",
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

export default async (req: Request) => {
  const target = parseTarget(new URL(req.url).searchParams.get("url"));
  if (!target) {
    return Response.json(
      { error: "Enter a link that starts with http:// or https://" },
      { status: 400 },
    );
  }

  let page: Awaited<ReturnType<typeof safeFetch>>;
  try {
    page = await safeFetch(target, "text/html,application/xhtml+xml");
  } catch (error) {
    return Response.json({ error: fetchError(error) }, { status: 502 });
  }

  const html = await readText(page.response);
  const pageUrl = new URL(page.url);
  const origin = pageUrl.origin;
  const [robots, llmsTxt, llmsFullTxt, markdown] = await Promise.all([
    fetchTextFile(new URL("/robots.txt", origin), "text/plain"),
    fetchTextFile(new URL("/llms.txt", origin), "text/plain, text/markdown"),
    fetchTextFile(
      new URL("/llms-full.txt", origin),
      "text/plain, text/markdown",
    ),
    findMarkdown(pageUrl, html),
  ]);
  const { groups, sitemaps } = parseRobots(robots?.text ?? "");
  const sitemap = await findSitemap(
    sitemaps.length > 0 ? sitemaps[0] : new URL("/sitemap.xml", origin).href,
  );
  const crawlers = CRAWLERS.map((crawler) => ({
    ...crawler,
    allowed: isAllowed(groups, crawler.name, pageUrl.pathname + pageUrl.search),
  }));

  return Response.json(
    {
      url: page.url,
      status: page.response.status,
      crawlers,
      llmsTxt: llmsTxt?.text.slice(0, LLMS_TXT_PREVIEW_CHARS) ?? null,
      checks: [
        {
          ok: robots !== null,
          label: "robots.txt",
          detail: robots
            ? "Found"
            : "Missing. Crawlers may read every page, but there is no place to list the sitemap.",
        },
        crawlerCheck(crawlers),
        indexingCheck(html, page.response.headers),
        {
          ok: sitemap !== null,
          label: "Sitemap",
          detail: sitemap
            ? `Found at ${sitemap}`
            : "Missing. Add /sitemap.xml and list it in robots.txt.",
        },
        llmsTxtCheck(llmsTxt),
        ...(llmsFullTxt
          ? [
              {
                ok: true,
                label: "llms-full.txt",
                detail: "Found",
              },
            ]
          : []),
        {
          ok: markdown !== null,
          label: "Markdown version",
          detail:
            markdown ??
            "None found. Agents read Markdown with fewer tokens than HTML.",
        },
        ...pageChecks(html),
      ],
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
};

async function fetchTextFile(
  url: URL,
  accept: string,
): Promise<TextFile | null> {
  try {
    const { url: finalUrl, response } = await safeFetch(url, accept);
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 200 || type.includes("html")) {
      await response.body?.cancel();
      return null;
    }
    const text = await readText(response);
    return /^\s*<(!doctype|html)/i.test(text)
      ? null
      : { url: finalUrl, type, text };
  } catch {
    return null;
  }
}

async function findMarkdown(pageUrl: URL, html: string) {
  const alternate = readTags(html, "link").find(
    (attrs) =>
      attrs.rel?.toLowerCase().split(/\s+/).includes("alternate") &&
      attrs.type?.toLowerCase() === "text/markdown" &&
      attrs.href,
  );
  if (alternate && URL.canParse(decodeEntities(alternate.href), pageUrl)) {
    const url = new URL(decodeEntities(alternate.href), pageUrl);
    if (await fetchTextFile(url, "text/markdown")) {
      return `Linked with <link rel="alternate" type="text/markdown"> at ${url.pathname}`;
    }
  }

  const negotiated = await fetchTextFile(pageUrl, "text/markdown");
  if (negotiated?.type.includes("markdown")) {
    return "Served for Accept: text/markdown";
  }

  for (const path of markdownPaths(pageUrl.pathname)) {
    if (await fetchTextFile(new URL(path, pageUrl), "text/markdown")) {
      return `Found at ${path}`;
    }
  }
  return null;
}

function markdownPaths(pathname: string) {
  if (pathname === "/") {
    return ["/index.md"];
  }
  return pathname.endsWith("/")
    ? [`${pathname.slice(0, -1)}.md`, `${pathname}index.md`]
    : [`${pathname}.md`];
}

async function findSitemap(url: string) {
  if (!URL.canParse(url)) {
    return null;
  }
  try {
    const { url: finalUrl, response } = await safeFetch(
      new URL(url),
      "application/xml, text/xml",
    );
    if (response.status !== 200) {
      await response.body?.cancel();
      return null;
    }
    const text = await readText(response, /<(urlset|sitemapindex)\b/i);
    return /<(urlset|sitemapindex)\b/i.test(text) ? finalUrl : null;
  } catch {
    return null;
  }
}

function parseRobots(text: string) {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | undefined;
  let readingAgents = false;
  for (const line of text.split(/\r?\n/)) {
    const match = line
      .replace(/#.*/, "")
      .match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (!match) {
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2];
    if (key === "user-agent") {
      if (!current || !readingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      readingAgents = true;
      continue;
    }
    readingAgents = false;
    if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }
  return { groups, sitemaps };
}

function isAllowed(groups: RobotsGroup[], agent: string, path: string) {
  const named = groups.filter((group) =>
    group.agents.includes(agent.toLowerCase()),
  );
  const matching =
    named.length > 0
      ? named
      : groups.filter((group) => group.agents.includes("*"));
  let best: { allow: boolean; length: number } | undefined;
  for (const rule of matching.flatMap((group) => group.rules)) {
    if (rule.path === "" || !robotsPattern(rule.path).test(path)) {
      continue;
    }
    if (
      !best ||
      rule.path.length > best.length ||
      (rule.path.length === best.length && rule.allow)
    ) {
      best = { allow: rule.allow, length: rule.path.length };
    }
  }
  return best?.allow ?? true;
}

function robotsPattern(path: string) {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function crawlerCheck(crawlers: { name: string; allowed: boolean }[]): Check {
  const blocked = crawlers.filter((crawler) => !crawler.allowed);
  return {
    ok: blocked.length === 0,
    label: "AI crawlers",
    detail:
      blocked.length === 0
        ? `All ${crawlers.length} may read this page`
        : `robots.txt blocks ${blocked.map((crawler) => crawler.name).join(", ")}`,
  };
}

function indexingCheck(html: string, headers: Headers): Check {
  const directives = [
    ...readMetaTags(html)
      .filter(([name]) => name === "robots")
      .map(([, value]) => value),
    headers.get("x-robots-tag") ?? "",
  ]
    .join(",")
    .toLowerCase()
    .split(/[\s,:]+/);
  const blocked = ["noindex", "none", "noai"].filter((directive) =>
    directives.includes(directive),
  );
  return {
    ok: blocked.length === 0,
    label: "Indexing",
    detail:
      blocked.length === 0
        ? "No noindex or noai in the robots meta tag or X-Robots-Tag"
        : `The page asks crawlers not to use it: ${blocked.join(", ")}`,
  };
}

function llmsTxtCheck(file: TextFile | null): Check {
  if (!file) {
    return {
      ok: false,
      label: "llms.txt",
      detail:
        "Missing. /llms.txt is a Markdown index of the site for language models.",
    };
  }
  const titled = /^\s*# \S/.test(file.text);
  return {
    ok: titled,
    label: "llms.txt",
    detail: titled
      ? `Found, ${file.text.split(/\r?\n/).length} lines`
      : "Found, but it does not start with a # title line.",
  };
}

function pageChecks(html: string): Check[] {
  const words = visibleText(html).split(/\s+/).filter(Boolean).length;
  const title = readTitle(html);
  const description = readMetaTags(html).find(
    ([name]) => name === "description",
  )?.[1];
  const lang = readAttributes(html.match(/<html\b[^>]*>/i)?.[0] ?? "").lang;
  const types = jsonLdTypes(html);
  return [
    {
      ok: words >= MIN_WORDS,
      label: "Text without JavaScript",
      detail:
        words >= MIN_WORDS
          ? `${words} words in the HTML`
          : `Only ${words} words in the HTML. Many AI crawlers do not run JavaScript, so they miss text that scripts add.`,
    },
    {
      ok: Boolean(title),
      label: "<title>",
      detail: title ?? "Missing",
    },
    {
      ok: Boolean(description),
      label: "Meta description",
      detail:
        description ?? "Missing. Agents use it as the summary of the page.",
    },
    {
      ok: Boolean(lang),
      label: "<html lang>",
      detail: lang ?? "Missing. Set the language of the page.",
    },
    {
      ok: types.length > 0,
      label: "JSON-LD",
      detail:
        types.length > 0
          ? types.join(", ")
          : "None. Structured data says what the page is about, like a product or an article.",
    },
  ];
}

function visibleText(html: string) {
  const body = html.match(/<body\b[^>]*>([\s\S]*)/i)?.[1] ?? html;
  return decodeEntities(
    body
      .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function jsonLdTypes(html: string) {
  const types = new Set<string>();
  const collect = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(collect);
    } else if (node && typeof node === "object") {
      const { "@type": type, "@graph": graph } = node as Record<
        string,
        unknown
      >;
      for (const value of [type].flat()) {
        if (typeof value === "string") {
          types.add(value);
        }
      }
      collect(graph);
    }
  };
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      collect(JSON.parse(json));
    } catch {}
  }
  return Array.from(types);
}
