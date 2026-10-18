import type { Config } from "@netlify/functions";
import { fetchError, parseTarget, readText, safeFetch } from "../lib/fetch.ts";
import {
  decodeEntities,
  readAttributes,
  readMetaTags,
  readTitle,
} from "../lib/html.ts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Check = { ok: boolean; label: string; detail: string };

export const config: Config = {
  path: "/api/og-preview",
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

  const html = await readText(page.response, /<\/head>/i);
  const tags = readMetaTags(html);
  const meta = (key: string) => tags.find(([name]) => name === key)?.[1];
  const absolute = (value: string | undefined) =>
    value && URL.canParse(value, page.url)
      ? new URL(value, page.url).href
      : undefined;

  const image = absolute(meta("og:image") ?? meta("twitter:image"));
  const imageCheck = image ? await checkImage(image) : null;

  return Response.json(
    {
      url: page.url,
      status: page.response.status,
      domain: new URL(page.url).hostname.replace(/^www\./, ""),
      title: meta("og:title") ?? meta("twitter:title") ?? readTitle(html),
      description:
        meta("og:description") ??
        meta("twitter:description") ??
        meta("description"),
      siteName: meta("og:site_name"),
      image,
      imageAlt: meta("og:image:alt") ?? meta("twitter:image:alt"),
      card: meta("twitter:card"),
      themeColor: meta("theme-color"),
      favicon:
        absolute(readIcon(html)) ?? new URL("/favicon.ico", page.url).href,
      tags: tags.filter(([name]) => /^(og|twitter|article|fb):/.test(name)),
      checks: checks(meta, image, imageCheck),
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
};

function readIcon(html: string) {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = readAttributes(tag);
    const rel = attrs.rel?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes("icon") && attrs.href) {
      return decodeEntities(attrs.href);
    }
  }
  return undefined;
}

async function checkImage(url: string) {
  try {
    const { response } = await safeFetch(new URL(url), "image/*");
    await response.body?.cancel();
    return {
      status: response.status,
      type: response.headers.get("content-type") ?? "",
      bytes: Number(response.headers.get("content-length")) || null,
    };
  } catch {
    return null;
  }
}

function checks(
  meta: (key: string) => string | undefined,
  image: string | undefined,
  imageCheck: Awaited<ReturnType<typeof checkImage>>,
): Check[] {
  const present = (key: string, missing: string): Check => ({
    ok: Boolean(meta(key)),
    label: key,
    detail: meta(key) ? "Set" : missing,
  });
  const imageLoads =
    imageCheck?.status === 200 && imageCheck.type.startsWith("image/");
  const size: Check[] = imageCheck?.bytes
    ? [
        {
          ok: imageCheck.bytes <= MAX_IMAGE_BYTES,
          label: "Image size",
          detail: `${Math.round(imageCheck.bytes / 1024)} KB${imageCheck.bytes > MAX_IMAGE_BYTES ? ", over 5 MB. X may not show it." : ""}`,
        },
      ]
    : [];
  return [
    present("og:title", "Missing. Platforms fall back to the page title."),
    present("og:description", "Missing. Most previews show no description."),
    {
      ok: Boolean(image) && imageLoads,
      label: "og:image",
      detail: !image
        ? "Missing. Previews show no image."
        : imageLoads
          ? "Loads as an image"
          : imageCheck
            ? `Returned ${imageCheck.status} ${imageCheck.type}`.trim()
            : "Could not load the image",
    },
    ...size,
    present("og:url", "Missing. Platforms use the shared link instead."),
    present("twitter:card", "Missing. X may show a small card."),
  ];
}
