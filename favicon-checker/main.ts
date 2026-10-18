import {
  type Check,
  checkList,
  definitionList,
  el,
  fetched,
  runLookup,
  summary,
} from "../lib/tool.ts";

type Icon = {
  source: string;
  rel?: string[];
  href: string;
  declared?: string;
  purpose?: string;
  loads: boolean;
  status?: number;
  sizes: string[];
};

type Report = {
  url: string;
  status: number;
  title: string;
  appTitle?: string;
  themeColor?: string;
  icons: Icon[];
  manifest: [string, string][];
  checks: Check[];
};

runLookup<Report>(
  "/api/favicon-checker",
  "Too many checks. Try again in a minute.",
  render,
);

function image(icon: Icon | undefined, className: string) {
  if (!icon) {
    return el("span", `${className} icon-missing`);
  }
  const img = el("img", className);
  img.src = icon.href;
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  return img;
}

function largest(icon: Icon) {
  return Math.max(
    0,
    ...icon.sizes.map((size) => Number(size.split("x")[0]) || 0),
  );
}

function tabIcon(icons: Icon[]) {
  const linked = icons.filter(
    (icon) => icon.loads && icon.rel?.includes("icon"),
  );
  return (
    linked.find((icon) => icon.sizes.includes("SVG")) ??
    linked[0] ??
    icons.find((icon) => icon.loads && icon.source === "/favicon.ico")
  );
}

function homeScreenIcon(icons: Icon[]) {
  const apple = icons.find(
    (icon) =>
      icon.loads &&
      (icon.rel?.some((rel) => rel.startsWith("apple-touch-icon")) ||
        icon.source === "/apple-touch-icon.png"),
  );
  return (
    apple ??
    icons
      .filter((icon) => icon.loads && icon.source === "manifest")
      .sort((a, b) => largest(b) - largest(a))[0]
  );
}

function tab(report: Report, theme: string) {
  return el("div", `tab tab-${theme}`, [
    image(tabIcon(report.icons), "tab-icon"),
    el("span", "tab-title", [report.title]),
  ]);
}

function iconFigure(icon: Icon) {
  const path = new URL(icon.href).pathname;
  const facts = [
    icon.loads
      ? icon.sizes.join(", ") || "Unknown size"
      : `Does not load${icon.status ? ` (${icon.status})` : ""}`,
    icon.declared && icon.declared !== icon.sizes.join(" ")
      ? `sizes="${icon.declared}"`
      : "",
    icon.purpose ? `purpose="${icon.purpose}"` : "",
  ].filter(Boolean);
  return el("figure", icon.loads ? "icon" : "icon icon-broken", [
    el("div", "icon-frame", [icon.loads ? image(icon, "icon-image") : null]),
    el("figcaption", "", [
      el("code", "", [
        icon.source === "manifest" ? `manifest ${path}` : icon.source,
      ]),
      el("span", "", [facts.join(", ")]),
    ]),
  ]);
}

function render(report: Report) {
  const homeScreen = el("div", "homescreen", [
    image(homeScreenIcon(report.icons), "homescreen-icon"),
    el("span", "homescreen-label", [report.appTitle ?? report.title]),
  ]);
  return [
    fetched("favicon-checker", report.status, report.url),
    el("div", "previews", [
      el("figure", "preview", [
        el("figcaption", "", ["Browser tab"]),
        el("div", "tabs", [tab(report, "light"), tab(report, "dark")]),
      ]),
      el("figure", "preview", [
        el("figcaption", "", ["Home screen"]),
        homeScreen,
      ]),
    ]),
    summary(report.checks),
    el("h2", "", ["Checks"]),
    checkList(report.checks),
    el("h2", "", ["Icons"]),
    report.icons.length === 0
      ? el("p", "empty", ["No icons found."])
      : el("div", "icons", report.icons.map(iconFigure)),
    el("h2", "", ["Web manifest"]),
    report.manifest.length === 0
      ? el("p", "empty", ["No web manifest on this page."])
      : definitionList(report.manifest),
  ];
}
