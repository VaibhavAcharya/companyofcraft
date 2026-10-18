type Check = { ok: boolean; label: string; detail: string };

type Preview = {
  url: string;
  status: number;
  domain: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  imageAlt?: string;
  card?: string;
  themeColor?: string;
  favicon: string;
  tags: [string, string][];
  checks: Check[];
};

const input = document.querySelector<HTMLInputElement>("#url");
const statusLine = document.querySelector<HTMLParagraphElement>(".status");
const results = document.querySelector<HTMLDivElement>(".results");

const target = new URLSearchParams(location.search).get("url");
if (input && statusLine && results && target) {
  input.value = target;
  statusLine.textContent = "Fetching the page...";
  load(target).then(
    (preview) => {
      statusLine.textContent = "";
      results.replaceChildren(...render(preview));
      results.hidden = false;
    },
    (error: Error) => {
      statusLine.textContent = error.message;
    },
  );
}

async function load(url: string): Promise<Preview> {
  const response = await fetch(
    `/api/og-preview?${new URLSearchParams({ url })}`,
  );
  if (response.status === 429) {
    throw new Error("Too many previews. Try again in a minute.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    throw new Error(body?.error ?? "Could not load that page.");
  }
  return body;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  node.append(...children.filter((child) => child != null));
  return node;
}

function image(preview: Preview, className: string) {
  if (!preview.image) {
    return null;
  }
  const img = el("img", className);
  img.src = preview.image;
  img.alt = preview.imageAlt ?? "";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  return img;
}

function favicon(preview: Preview) {
  const img = el("img", "favicon");
  img.src = preview.favicon;
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => img.remove());
  return img;
}

function text(className: string, value: string | undefined) {
  return value ? el("p", className, [value]) : null;
}

function figure(label: string, card: HTMLElement) {
  return el("figure", "preview", [el("figcaption", "", [label]), card]);
}

function render(preview: Preview) {
  const title = preview.title ?? preview.domain;
  const site = preview.siteName ?? preview.domain;
  const large = preview.card !== "summary";

  const x = el("div", `x ${large ? "x-large" : "x-small"}`, [
    el("div", "x-media", [
      image(preview, "x-image"),
      large ? el("span", "x-title", [title]) : null,
    ]),
    large
      ? null
      : el("div", "x-body", [
          text("x-domain", preview.domain),
          text("x-name", title),
          text("x-description", preview.description),
        ]),
  ]);
  const xFrom = el("p", "x-from", [`From ${preview.domain}`]);

  const linkedin = el("div", "linkedin", [
    image(preview, "linkedin-image"),
    el("div", "linkedin-body", [
      text("linkedin-title", title),
      text("linkedin-domain", preview.domain),
    ]),
  ]);

  const slack = el("div", "slack", [
    el("p", "slack-site", [favicon(preview), site]),
    text("slack-title", title),
    text("slack-description", preview.description),
    image(preview, "slack-image"),
  ]);

  const discord = el("div", "discord", [
    text("discord-site", site),
    text("discord-title", title),
    text("discord-description", preview.description),
    image(preview, "discord-image"),
  ]);
  if (preview.themeColor) {
    discord.style.borderLeftColor = preview.themeColor;
  }

  const link = el("a", "", [preview.url]);
  link.href = preview.url;
  link.rel = "noopener nofollow";
  link.target = "_blank";

  return [
    el("p", "fetched", [`${preview.status} `, link]),
    el("div", "previews", [
      figure("X", el("div", "", [x, xFrom])),
      figure("LinkedIn", linkedin),
      figure("Slack", slack),
      figure("Discord", discord),
    ]),
    el("h2", "", ["Checks"]),
    el(
      "ul",
      "checks",
      preview.checks.map((check) =>
        el("li", check.ok ? "ok" : "missing", [
          el("span", "check-icon", [check.ok ? "✓" : "✕"]),
          el("code", "", [check.label]),
          el("span", "check-detail", [check.detail]),
        ]),
      ),
    ),
    el("h2", "", ["Tags"]),
    preview.tags.length === 0
      ? el("p", "empty", ["No og: or twitter: tags on this page."])
      : el(
          "dl",
          "tags",
          preview.tags.flatMap(([name, value]) => [
            el("dt", "", [name]),
            el("dd", "", [value]),
          ]),
        ),
  ];
}
