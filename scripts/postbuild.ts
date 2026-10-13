import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

const SITE_URL = "https://companyofcraft.com";
const OUT_DIR = "dist";
const WIDTH = 1200;
const HEIGHT = 630;
const X_BANNER_WIDTH = 1500;
const X_BANNER_HEIGHT = 500;

const PAGES = [
  {
    path: "/",
    title: "Company of Craft",
    tagline: "Well-made software.",
    sources: ["index.html", "styles/main.css"],
  },
];

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown; src?: string };
};

function h(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node {
  return { type, props: { style, children } };
}

function image(src: string, style: Record<string, unknown>): Node {
  return { type: "img", props: { src, style } };
}

const require = createRequire(import.meta.url);

function font(file: string): Promise<Buffer> {
  return readFile(require.resolve(file));
}

async function dataUri(file: string, type: string): Promise<string> {
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
}

function ogImagePath(path: string): string {
  return path === "/" ? "/og/index.png" : `/og${path}.png`;
}

async function renderPng(
  card: Node,
  width: number,
  height: number,
): Promise<Buffer> {
  const [regular, semibold] = await Promise.all([
    font("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff"),
    font("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff"),
  ]);
  const svg = await satori(card as never, {
    width,
    height,
    fonts: [
      { name: "IBM Plex Sans", data: regular, weight: 400 },
      { name: "IBM Plex Sans", data: semibold, weight: 600 },
    ],
  });
  return new Resvg(svg).render().asPng();
}

async function renderOgImage(page: (typeof PAGES)[number]): Promise<Buffer> {
  const mark = await dataUri("public/logos/mark-dark.svg", "image/svg+xml");
  const card = h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a",
      fontFamily: "IBM Plex Sans",
      color: "#ededed",
      letterSpacing: "-0.02em",
    },
    [
      image(mark, { width: 260, height: 260 }),
      h(
        "div",
        {
          marginTop: 40,
          fontSize: 60,
          fontWeight: 600,
          letterSpacing: "-0.03em",
        },
        page.title,
      ),
      h("div", { marginTop: 8, fontSize: 32, color: "#a1a1a1" }, page.tagline),
    ],
  );
  return renderPng(card, WIDTH, HEIGHT);
}

async function renderXBanner(): Promise<Buffer> {
  const mark = await dataUri("public/logos/mark-dark.svg", "image/svg+xml");
  const banner = h(
    "div",
    {
      width: X_BANNER_WIDTH,
      height: X_BANNER_HEIGHT,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 48,
      background: "#0a0a0a",
      fontFamily: "IBM Plex Sans",
      color: "#ededed",
      letterSpacing: "-0.02em",
    },
    [
      image(mark, { width: 200, height: 200 }),
      h("div", { display: "flex", flexDirection: "column" }, [
        h(
          "div",
          { fontSize: 60, fontWeight: 600, letterSpacing: "-0.03em" },
          PAGES[0].title,
        ),
        h(
          "div",
          { marginTop: 4, fontSize: 32, color: "#a1a1a1" },
          PAGES[0].tagline,
        ),
      ]),
    ],
  );
  return renderPng(banner, X_BANNER_WIDTH, X_BANNER_HEIGHT);
}

function lastModified(sources: string[]): string | undefined {
  try {
    return (
      execFileSync("git", ["log", "-1", "--format=%cI", "--", ...sources], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function sitemap(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((page) => {
      const date = lastModified(page.sources);
      const lastmod = date === undefined ? "" : `<lastmod>${date}</lastmod>`;
      return `  <url><loc>${SITE_URL}${page.path}</loc>${lastmod}</url>`;
    }),
    "</urlset>",
    "",
  ].join("\n");
}

for (const page of PAGES) {
  const file = join(OUT_DIR, ogImagePath(page.path));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, await renderOgImage(page));
}
console.log(`Wrote ${PAGES.length} Open Graph images to ${OUT_DIR}/og`);

await writeFile(join(OUT_DIR, "og/x-banner.png"), await renderXBanner());
console.log(`Wrote the X banner to ${OUT_DIR}/og/x-banner.png`);

await writeFile(join(OUT_DIR, "sitemap.xml"), sitemap());
console.log(`Wrote ${PAGES.length} URLs to ${OUT_DIR}/sitemap.xml`);
