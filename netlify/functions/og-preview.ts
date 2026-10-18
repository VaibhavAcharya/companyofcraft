import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Config } from "@netlify/functions";

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (compatible; CompanyofCraftBot/1.0; +https://companyofcraft.com/og-preview/)";

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

  const html = await readHead(page.response);
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

function parseTarget(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (!URL.canParse(withProtocol)) {
    return null;
  }
  const url = new URL(withProtocol);
  return ["http:", "https:"].includes(url.protocol) ? url : null;
}

async function safeFetch(url: URL, accept: string) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept },
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return { url: current.href, response };
    }
    await response.body?.cancel();
    current = new URL(location, current);
    if (!["http:", "https:"].includes(current.protocol)) {
      throw new Error("redirect");
    }
  }
  throw new Error("redirects");
}

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map(({ address }) => address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("private");
  }
}

function isPrivateAddress(address: string) {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateAddress(mapped[1]);
  }
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = address.toLowerCase();
  return (
    lower === "::" ||
    lower === "::1" ||
    /^f[cd]/.test(lower) ||
    /^fe[89ab]/.test(lower)
  );
}

function fetchError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "private") {
    return "That link points to a private address.";
  }
  if (message === "redirects") {
    return `That link redirects more than ${MAX_REDIRECTS} times.`;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return `That page did not answer within ${TIMEOUT_MS / 1000} seconds.`;
  }
  return "Could not load that page.";
}

async function readHead(response: Response) {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) {
      break;
    }
  }
  await reader.cancel();
  return html;
}

function readMetaTags(html: string): [string, string][] {
  const tags: [string, string][] = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = readAttributes(tag);
    const name = (attrs.property ?? attrs.name)?.toLowerCase();
    if (name && attrs.content !== undefined) {
      tags.push([name, decodeEntities(attrs.content).trim()]);
    }
  }
  return tags;
}

function readTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title).trim() : undefined;
}

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

function readAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(
    /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  )) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  }
  return attrs;
}

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39|nbsp);/gi,
    (entity, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      }
      if (lower.startsWith("#")) {
        return String.fromCodePoint(Number(lower.slice(1)));
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[
          lower
        ] ?? entity
      );
    },
  );
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
