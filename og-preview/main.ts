import {
  type Check,
  checkList,
  definitionList,
  el,
  fetched,
  runLookup,
} from "../lib/tool.ts";

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

runLookup<Preview>(
  "/api/og-preview",
  "Too many previews. Try again in a minute.",
  render,
);

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

  return [
    fetched(preview.status, preview.url),
    el("div", "previews", [
      figure("X", el("div", "", [x, xFrom])),
      figure("LinkedIn", linkedin),
      figure("Slack", slack),
      figure("Discord", discord),
    ]),
    el("h2", "", ["Checks"]),
    checkList(preview.checks),
    el("h2", "", ["Tags"]),
    preview.tags.length === 0
      ? el("p", "empty", ["No og: or twitter: tags on this page."])
      : definitionList(preview.tags),
  ];
}
