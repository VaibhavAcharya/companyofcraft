import type { Config } from "@netlify/functions";
import {
  fetchError,
  parseTarget,
  readBytes,
  readText,
  safeFetch,
} from "../lib/fetch.ts";
import {
  decodeEntities,
  readMetaTags,
  readTags,
  readTitle,
} from "../lib/html.ts";

const MAX_PAGE_ICONS = 12;
const MAX_MANIFEST_ICONS = 12;
const MAX_ICON_HEADER_BYTES = 64 * 1024;
const APPLE_RELS = ["apple-touch-icon", "apple-touch-icon-precomposed"];
const ICON_RELS = ["icon", "mask-icon", ...APPLE_RELS];

type Check = { ok: boolean; label: string; detail: string };
type IconSource = {
  source: string;
  rel?: string[];
  href: string;
  declared?: string;
  type?: string;
  purpose?: string;
};
type Icon = IconSource & {
  loads: boolean;
  status?: number;
  contentType?: string;
  sizes: string[];
};
type Manifest = Record<string, unknown>;

export const config: Config = {
  path: "/api/favicon-checker",
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
  const links = readTags(html, "link");
  const absolute = (value: string | undefined, base = page.url) => {
    const decoded = value ? decodeEntities(value).trim() : "";
    if (!decoded || !URL.canParse(decoded, base)) {
      return undefined;
    }
    const url = new URL(decoded, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  };
  const meta = readMetaTags(html);
  const themeColor = meta.find(([name]) => name === "theme-color")?.[1];

  const linked: IconSource[] = links.flatMap((attrs) => {
    const rel = attrs.rel?.toLowerCase().split(/\s+/) ?? [];
    const href = absolute(attrs.href);
    if (!href || !rel.some((value) => ICON_RELS.includes(value))) {
      return [];
    }
    return [
      {
        source: `rel="${rel.join(" ")}"`,
        rel,
        href,
        declared: attrs.sizes,
        type: attrs.type,
      },
    ];
  });
  const hasAppleIcon = linked.some((icon) =>
    icon.rel?.some((rel) => APPLE_RELS.includes(rel)),
  );
  const fallbacks: IconSource[] = [
    { source: "/favicon.ico", href: new URL("/favicon.ico", page.url).href },
    ...(hasAppleIcon
      ? []
      : [
          {
            source: "/apple-touch-icon.png",
            href: new URL("/apple-touch-icon.png", page.url).href,
          },
        ]),
  ];

  const manifestUrl = absolute(
    links.find((attrs) =>
      attrs.rel?.toLowerCase().split(/\s+/).includes("manifest"),
    )?.href,
  );
  const manifest = manifestUrl ? await loadManifest(manifestUrl) : null;
  const manifestIcons: IconSource[] =
    manifest?.data && Array.isArray(manifest.data.icons)
      ? manifest.data.icons.flatMap((icon: Record<string, unknown>) => {
          const href = absolute(
            typeof icon.src === "string" ? icon.src : undefined,
            manifest.url,
          );
          return href
            ? [
                {
                  source: "manifest",
                  href,
                  declared:
                    typeof icon.sizes === "string" ? icon.sizes : undefined,
                  type: typeof icon.type === "string" ? icon.type : undefined,
                  purpose:
                    typeof icon.purpose === "string" ? icon.purpose : undefined,
                },
              ]
            : [];
        })
      : [];

  const icons = await Promise.all(
    [
      ...[...linked, ...fallbacks].slice(0, MAX_PAGE_ICONS),
      ...manifestIcons
        .sort((a, b) => largestSize(b.declared) - largestSize(a.declared))
        .slice(0, MAX_MANIFEST_ICONS),
    ].map(inspectIcon),
  );

  return Response.json(
    {
      url: page.url,
      status: page.response.status,
      title: readTitle(html) ?? new URL(page.url).hostname,
      themeColor,
      appTitle:
        meta.find(([name]) => name === "apple-mobile-web-app-title")?.[1] ??
        (typeof manifest?.data?.short_name === "string"
          ? manifest.data.short_name
          : undefined),
      icons,
      manifest: manifest?.data
        ? Object.entries(manifest.data)
            .filter(([key]) => key !== "icons")
            .map(([key, value]) => [
              key,
              typeof value === "string" ? value : JSON.stringify(value),
            ])
        : [],
      checks: [
        ...iconChecks(icons),
        ...manifestChecks(manifestUrl, manifest, icons),
        {
          ok: Boolean(themeColor),
          label: "theme-color",
          detail:
            themeColor ??
            "Missing. Mobile browsers use it to color the address bar.",
        },
      ],
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
};

function largestSize(declared: string | undefined) {
  return Math.max(
    0,
    ...(declared?.split(/\s+/) ?? []).map(
      (size) => Number(size.split("x")[0]) || 0,
    ),
  );
}

async function loadManifest(url: string) {
  try {
    const { url: finalUrl, response } = await safeFetch(
      new URL(url),
      "application/manifest+json, application/json",
    );
    if (response.status !== 200) {
      await response.body?.cancel();
      return { url: finalUrl, status: response.status, data: null };
    }
    const text = await readText(response);
    try {
      const data = JSON.parse(text);
      return {
        url: finalUrl,
        status: response.status,
        data:
          data && typeof data === "object" && !Array.isArray(data)
            ? (data as Manifest)
            : null,
      };
    } catch {
      return { url: finalUrl, status: response.status, data: null };
    }
  } catch {
    return null;
  }
}

async function inspectIcon(icon: IconSource): Promise<Icon> {
  try {
    const { response } = await safeFetch(new URL(icon.href), "image/*");
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status !== 200) {
      await response.body?.cancel();
      return {
        ...icon,
        loads: false,
        status: response.status,
        contentType,
        sizes: [],
      };
    }
    const bytes = await readBytes(response, MAX_ICON_HEADER_BYTES);
    const sizes = imageSizes(bytes, contentType);
    return {
      ...icon,
      loads: sizes !== null,
      status: response.status,
      contentType,
      sizes: sizes ?? [],
    };
  } catch {
    return { ...icon, loads: false, sizes: [] };
  }
}

function imageSizes(bytes: Uint8Array, contentType: string): string[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isPng = bytes.length >= 24 && view.getUint32(0) === 0x89504e47;
  if (isPng) {
    return [`${view.getUint32(16)}x${view.getUint32(20)}`];
  }
  const isIco =
    bytes.length >= 6 &&
    view.getUint16(0, true) === 0 &&
    view.getUint16(2, true) === 1;
  if (isIco) {
    const count = view.getUint16(4, true);
    const sizes: string[] = [];
    for (let i = 0; i < count && 6 + i * 16 + 2 <= bytes.length; i++) {
      const width = bytes[6 + i * 16] || 256;
      const height = bytes[7 + i * 16] || 256;
      sizes.push(`${width}x${height}`);
    }
    return sizes;
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
  if (contentType.includes("svg") || /^(<\?xml[^>]*>\s*)?<svg\b/i.test(head)) {
    return ["SVG"];
  }
  if (contentType.startsWith("image/") && !/^<(!doctype|html)/i.test(head)) {
    return [];
  }
  return null;
}

function hasSize(icon: Icon, size: number) {
  const wanted = `${size}x${size}`;
  if (icon.sizes.length > 0) {
    return icon.sizes.includes(wanted) || icon.sizes.includes("SVG");
  }
  return (
    icon.declared?.split(/\s+/).includes(wanted) || icon.declared === "any"
  );
}

function describe(icon: Icon) {
  if (!icon.loads) {
    return icon.status
      ? `Returned ${icon.status} ${icon.contentType ?? ""}`.trim()
      : "Could not load it";
  }
  return icon.sizes.length > 0 ? `Loads, ${icon.sizes.join(", ")}` : "Loads";
}

function iconChecks(icons: Icon[]): Check[] {
  const favicon = icons.find((icon) => icon.source === "/favicon.ico");
  const linked = icons.filter((icon) => icon.rel?.includes("icon"));
  const apple =
    icons.find((icon) => icon.rel?.some((rel) => APPLE_RELS.includes(rel))) ??
    icons.find((icon) => icon.source === "/apple-touch-icon.png");
  const brokenLinks = linked.filter((icon) => !icon.loads);
  return [
    {
      ok: Boolean(favicon?.loads),
      label: "/favicon.ico",
      detail: favicon?.loads
        ? describe(favicon)
        : `${favicon ? describe(favicon) : "Not checked"}. Some browsers, feed readers and bots ask for /favicon.ico even when the page links another icon.`,
    },
    {
      ok: linked.length > 0 && brokenLinks.length === 0,
      label: '<link rel="icon">',
      detail:
        linked.length === 0
          ? "Missing. Browsers fall back to /favicon.ico."
          : brokenLinks.length > 0
            ? `${brokenLinks.length} of ${linked.length} do not load: ${brokenLinks.map((icon) => new URL(icon.href).pathname).join(", ")}`
            : `${linked.length} linked, all load`,
    },
    {
      ok: Boolean(apple?.loads) && Boolean(apple && hasSize(apple, 180)),
      label: "apple-touch-icon",
      detail: !apple?.loads
        ? "Missing. iOS has no icon to put on the home screen."
        : hasSize(apple, 180)
          ? `${describe(apple)}${apple.source === "/apple-touch-icon.png" ? ", found without a link tag" : ""}`
          : `${describe(apple)}. Use 180x180.`,
    },
  ];
}

function manifestChecks(
  url: string | undefined,
  manifest: Awaited<ReturnType<typeof loadManifest>>,
  icons: Icon[],
): Check[] {
  if (!url) {
    return [
      {
        ok: false,
        label: "Web manifest",
        detail:
          'Missing. Add <link rel="manifest"> so Android and desktop browsers can install the site with its icon.',
      },
    ];
  }
  if (!manifest?.data) {
    return [
      {
        ok: false,
        label: "Web manifest",
        detail: !manifest
          ? "Could not load it"
          : manifest.status !== 200
            ? `Returned ${manifest.status}`
            : "Loads, but it is not a JSON object",
      },
    ];
  }
  const data = manifest.data;
  const manifestIcons = icons.filter(
    (icon) => icon.source === "manifest" && icon.loads,
  );
  const missingSizes = [192, 512].filter(
    (size) => !manifestIcons.some((icon) => hasSize(icon, size)),
  );
  const maskable = manifestIcons.some((icon) =>
    icon.purpose?.split(/\s+/).includes("maskable"),
  );
  const name = typeof data.name === "string" ? data.name : undefined;
  const shortName =
    typeof data.short_name === "string" ? data.short_name : undefined;
  return [
    {
      ok: true,
      label: "Web manifest",
      detail: `Loads from ${new URL(manifest.url).pathname}`,
    },
    {
      ok: Boolean(name || shortName),
      label: "Manifest name",
      detail:
        name || shortName
          ? [
              name,
              shortName && shortName !== name ? `short name ${shortName}` : "",
            ]
              .filter(Boolean)
              .join(", ")
          : "Missing name and short_name",
    },
    {
      ok: missingSizes.length === 0,
      label: "Manifest icons",
      detail:
        missingSizes.length === 0
          ? `${manifestIcons.length} load, with 192x192 and 512x512`
          : `No ${missingSizes.map((size) => `${size}x${size}`).join(" or ")} icon that loads. Android needs both to install the site.`,
    },
    {
      ok: maskable,
      label: "Maskable icon",
      detail: maskable
        ? "Set"
        : 'None. Android puts icons without purpose "maskable" inside a white shape.',
    },
  ];
}
