import { track, trackFaqOpens } from "../lib/analytics.ts";
import { definitionList, el } from "../lib/tool.ts";
import {
  COLUMNS,
  COUNTRIES,
  DEGREES,
  FIRST_COUNTRY_CODE,
  LAND,
  ROWS,
  TOP_LATITUDE,
} from "./world.ts";

const SVG = "http://www.w3.org/2000/svg";

const VERDICTS: Record<string, { label: string; tone: string }> = {
  human: { label: "Looks like a person", tone: "good" },
  proxy: { label: "Likely a VPN, proxy or server", tone: "warning" },
  bot: { label: "Bot or script", tone: "critical" },
  ai_crawler: { label: "AI crawler", tone: "crawler" },
  search_bot: { label: "Search engine bot", tone: "crawler" },
  spoofed_crawler: { label: "Fake crawler", tone: "critical" },
};

const ICONS: Record<string, string> = {
  good: '<circle cx="8" cy="8" r="6.25" /><path d="m5.5 8 1.75 1.75L10.5 6.5" />',
  warning: '<path d="M8 2.25 14 13H2z" /><path d="M8 6.5v2.75M8 11.25h.01" />',
  critical: '<circle cx="8" cy="8" r="6.25" /><path d="m6 6 4 4m0-4-4 4" />',
  crawler:
    '<rect x="3" y="5" width="10" height="8" rx="2" /><path d="M8 2.25V5M6 9h.01M10 9h.01" />',
};

type Report = {
  ip: string;
  verdict: string;
  isBot: boolean;
  hostname: string | null;
  location: {
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    postalCode: string | null;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  network: {
    asn: number;
    organization: string | null;
    prefix: string;
    registry: string;
  } | null;
  proxy: { tor: boolean | null; hosting: boolean | null };
  userAgent: string | null;
  bot: {
    name: string;
    owner: string | null;
    kind: string;
    verified: boolean | null;
  } | null;
  signals: string[];
};

const input = document.querySelector<HTMLInputElement>("#ip");
const statusLine = document.querySelector<HTMLParagraphElement>(".status");
const results = document.querySelector<HTMLDivElement>(".results");

const ip = new URLSearchParams(location.search).get("ip")?.trim() ?? "";
if (input && statusLine && results) {
  input.value = ip;
  statusLine.textContent = ip ? `Looking up ${ip}...` : "Finding your IP...";
  load(ip).then(
    (report) => {
      statusLine.textContent = "";
      results.replaceChildren(...render(report, ip === ""));
      results.hidden = false;
      highlightCode();
    },
    (error: Error) => {
      statusLine.textContent = error.message;
    },
  );
}

highlightCode();
trackFaqOpens("ip-lookup");

function highlightCode() {
  import("./highlight.ts").then(({ highlight }) => {
    for (const pre of document.querySelectorAll<HTMLElement>(
      "pre[data-lang]:not(.highlighted)",
    )) {
      highlight(pre);
    }
  });
}

async function load(ip: string): Promise<Report> {
  const query = ip ? `?${new URLSearchParams({ ip })}` : "";
  const response = await fetch(`/api/ip-lookup${query}`);
  if (response.status === 429) {
    track("Lookup", {
      tool: "ip-lookup",
      ip: ip || "self",
      result: "rate-limited",
    });
    throw new Error("Too many lookups. Try again in a minute.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    track("Lookup", { tool: "ip-lookup", ip: ip || "self", result: "error" });
    throw new Error(body?.error ?? "Could not look up that IP.");
  }
  track("Lookup", { tool: "ip-lookup", ip: ip || "self", result: "ok" });
  return body;
}

function render(report: Report, self: boolean) {
  return [
    el("section", "ip-card", [
      el("div", "ip-head", [
        el("div", "", [
          el("p", "ip-label", [self ? "Your IP address" : "IP address"]),
          el("p", "ip-value", [report.ip]),
          report.hostname ? el("p", "ip-host", [report.hostname]) : null,
        ]),
        copyButton("Copy", () => report.ip),
      ]),
      verdictBadge(report.verdict),
      worldMap(report),
    ]),
    el("div", "tiles", [
      locationTile(report, self),
      networkTile(report),
      proxyTile(report),
      botTile(report),
    ]),
    ...views(report),
  ];
}

function copyButton(label: string, text: () => string) {
  const button = el("button", "copy", [label]);
  button.type = "button";
  button.addEventListener("click", () => {
    track("IP lookup copy", { label });
    navigator.clipboard.writeText(text()).then(() => {
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = label;
      }, 1500);
    });
  });
  return button;
}

function icon(name: string) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name];
  return svg;
}

function verdictBadge(verdict: string) {
  const { label, tone } = VERDICTS[verdict];
  const badge = el("p", "verdict", [icon(tone), label]);
  badge.dataset.tone = tone;
  return badge;
}

function svgElement(tag: string, attributes: Record<string, string | number>) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

function worldMap({ location }: Report) {
  const index = COUNTRIES.findIndex(([code]) => code === location.countryCode);
  const highlight =
    index === -1 ? null : String.fromCharCode(FIRST_COUNTRY_CODE + index);
  const point =
    location.latitude !== null && location.longitude !== null
      ? [location.longitude, location.latitude]
      : index === -1
        ? null
        : [COUNTRIES[index][1], COUNTRIES[index][2]];

  let land = "";
  let country = "";
  for (let cell = 0; cell < LAND.length; cell++) {
    if (LAND[cell] === " ") {
      continue;
    }
    const dot = `M${(cell % COLUMNS) + 0.5} ${Math.floor(cell / COLUMNS) + 0.5}h0`;
    if (LAND[cell] === highlight) {
      country += dot;
    } else {
      land += dot;
    }
  }

  const place = placeName(location);
  const svg = svgElement("svg", {
    viewBox: `0 0 ${COLUMNS} ${ROWS}`,
    role: "img",
    "aria-label": place ? `Map pointing at ${place}` : "World map",
  });
  svg.append(
    svgElement("path", { class: "map-land", d: land }),
    svgElement("path", { class: "map-country", d: country }),
  );
  if (point) {
    const x = (point[0] + 180) / DEGREES;
    const y = (TOP_LATITUDE - point[1]) / DEGREES;
    const pin = svgElement("circle", {
      class: "map-pin",
      cx: x,
      cy: y,
      r: 1.6,
    });
    const title = svgElement("title", {});
    title.textContent = place;
    pin.append(title);
    svg.append(
      svgElement("circle", { class: "map-pulse", cx: x, cy: y, r: 1.6 }),
      pin,
    );
  }
  return el("figure", "map", [
    svg,
    el("figcaption", "", [
      location.city
        ? "Approximate location of the network, not a street address."
        : place
          ? "Country of the network. The city is only known for your own IP."
          : "No location for this IP.",
    ]),
  ]);
}

function placeName(location: Report["location"]) {
  return [location.city, location.region, location.country]
    .filter((part) => part !== null)
    .join(", ");
}

function tile(label: string, value: string, detail: string) {
  return el("div", "tile", [
    el("p", "tile-label", [label]),
    Object.assign(el("p", "tile-value", [value]), { title: value }),
    el("p", "tile-detail", [detail]),
  ]);
}

function locationTile({ location }: Report, self: boolean) {
  if (!location.country) {
    return tile("Location", "Unknown", "No country found for this IP.");
  }
  if (!location.city) {
    return tile(
      "Location",
      location.country,
      self
        ? "No city for this IP."
        : "From the internet registry. Look up your own IP to see a city.",
    );
  }
  return tile(
    "Location",
    `${location.city}, ${location.country}`,
    [location.region, location.timezone].filter(Boolean).join(", "),
  );
}

function networkTile({ network }: Report) {
  return network === null
    ? tile("Network", "Unknown", "No network found for this IP.")
    : tile(
        "Network",
        network.organization ?? `AS${network.asn}`,
        `AS${network.asn}, ${network.prefix}`,
      );
}

function proxyTile({ proxy, network }: Report) {
  if (proxy.tor) {
    return tile(
      "VPN or proxy",
      "Tor exit node",
      "Traffic leaves the Tor network here, so the real sender is hidden.",
    );
  }
  if (proxy.hosting) {
    return tile(
      "VPN or proxy",
      "Hosting network",
      `${network?.organization ?? "This network"} rents out servers. VPNs, proxies and bots often run there.`,
    );
  }
  if (proxy.tor === null && proxy.hosting === null) {
    return tile("VPN or proxy", "Unknown", "Could not check this IP.");
  }
  return tile(
    "VPN or proxy",
    "No sign",
    "Not Tor, and not a known hosting or VPN network.",
  );
}

function botTile({ bot, userAgent, signals }: Report) {
  if (bot === null && signals.length > 0) {
    return tile("Bot", "Likely a script", `${signals.join(". ")}.`);
  }
  if (bot === null) {
    return userAgent === null
      ? tile(
          "Bot",
          "Not a known crawler",
          "Not in the IP ranges that crawlers publish.",
        )
      : tile(
          "Bot",
          "Looks like a browser",
          "The user agent and headers match a real browser.",
        );
  }
  if (bot.verified === false) {
    return tile(
      "Bot",
      `Fake ${bot.name}`,
      "The user agent says so, but the IP is not in its published ranges.",
    );
  }
  return tile(
    "Bot",
    bot.name,
    [bot.owner, bot.verified ? "The IP is in its published ranges." : ""]
      .filter(Boolean)
      .join(". "),
  );
}

function views(report: Report) {
  const json = el("pre", "file json", [JSON.stringify(report, null, 2)]);
  json.dataset.lang = "json";
  const panels = [
    { name: "Details", panel: details(report) },
    {
      name: "JSON",
      panel: el("div", "", [
        copyButton("Copy JSON", () => JSON.stringify(report, null, 2)),
        json,
      ]),
    },
  ];
  const tabs = panels.map(({ name, panel }, index) => {
    const tab = el("button", "view-tab", [name]);
    tab.type = "button";
    tab.id = `view-${name.toLowerCase()}`;
    tab.setAttribute("role", "tab");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.hidden = index !== 0;
    return tab;
  });
  const select = (selected: number) => {
    tabs.forEach((tab, index) => {
      tab.setAttribute("aria-selected", String(index === selected));
      tab.tabIndex = index === selected ? 0 : -1;
      panels[index].panel.hidden = index !== selected;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      select(index);
      track("IP lookup view", { view: panels[index].name });
    });
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const next =
          (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
        select(next);
        track("IP lookup view", { view: panels[next].name });
        tabs[next].focus();
      }
    });
  });
  select(0);
  const list = el("div", "view-tabs", tabs);
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Views");
  return [list, ...panels.map(({ panel }) => panel)];
}

function details({ location, network, userAgent, signals }: Report) {
  const place = [
    ["City", location.city],
    ["Region", location.region],
    ["Country", location.country],
    ["Postal code", location.postalCode],
    ["Timezone", location.timezone],
    [
      "Coordinates",
      location.latitude === null || location.longitude === null
        ? null
        : `${location.latitude}, ${location.longitude}`,
    ],
  ].filter((pair): pair is [string, string] => pair[1] !== null);
  return el("div", "", [
    el("h2", "", ["Location"]),
    place.length === 0
      ? el("p", "empty", ["No location for this IP."])
      : definitionList(place),
    el("h2", "", ["Network"]),
    network === null
      ? el("p", "empty", ["No network found for this IP."])
      : definitionList([
          ["ASN", `AS${network.asn}`],
          ["Organization", network.organization ?? "Unknown"],
          ["Prefix", network.prefix],
          ["Registry", network.registry.toUpperCase()],
        ]),
    ...(userAgent === null
      ? []
      : [
          el("h2", "", ["Request"]),
          definitionList([
            ["User agent", userAgent || "None"],
            [
              "Header checks",
              signals.length === 0 ? "Pass" : signals.join(". "),
            ],
          ]),
        ]),
  ]);
}
