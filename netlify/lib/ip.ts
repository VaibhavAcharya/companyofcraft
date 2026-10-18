import { Resolver, resolveTxt, reverse } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { Context } from "@netlify/functions";

const TIMEOUT_MS = 5000;
const LIST_TTL_MS = 60 * 60 * 1000;
const TOR_EXIT_LIST = "https://check.torproject.org/torbulkexitlist";
const OPENDNS_RESOLVER = "208.67.222.222";

const BOTS = [
  {
    name: "GPTBot",
    owner: "OpenAI, training",
    kind: "ai",
    ranges: "https://openai.com/gptbot.json",
  },
  {
    name: "OAI-SearchBot",
    owner: "OpenAI, search",
    kind: "ai",
    ranges: "https://openai.com/searchbot.json",
  },
  {
    name: "ChatGPT-User",
    owner: "OpenAI, user requests",
    kind: "ai",
    ranges: "https://openai.com/chatgpt-user.json",
  },
  {
    name: "ClaudeBot",
    owner: "Anthropic, training",
    kind: "ai",
    ranges: "https://claude.com/crawling/bots.json",
  },
  {
    name: "Claude-SearchBot",
    owner: "Anthropic, search",
    kind: "ai",
    ranges: "https://claude.com/crawling/bots.json",
  },
  {
    name: "Claude-User",
    owner: "Anthropic, user requests",
    kind: "ai",
    ranges: "https://claude.com/crawling/bots.json",
  },
  {
    name: "PerplexityBot",
    owner: "Perplexity, search",
    kind: "ai",
    ranges: "https://www.perplexity.com/perplexitybot.json",
  },
  {
    name: "Perplexity-User",
    owner: "Perplexity, user requests",
    kind: "ai",
    ranges: "https://www.perplexity.com/perplexity-user.json",
  },
  { name: "meta-externalagent", owner: "Meta, training", kind: "ai" },
  { name: "Amazonbot", owner: "Amazon", kind: "ai" },
  { name: "Bytespider", owner: "ByteDance", kind: "ai" },
  { name: "CCBot", owner: "Common Crawl", kind: "ai" },
  {
    name: "Googlebot",
    owner: "Google, search",
    kind: "search",
    ranges: "https://developers.google.com/search/apis/ipranges/googlebot.json",
  },
  {
    name: "bingbot",
    owner: "Microsoft, Bing search",
    kind: "search",
    ranges: "https://www.bing.com/toolbox/bingbot.json",
  },
  {
    name: "Applebot",
    owner: "Apple, search",
    kind: "search",
    ranges: "https://search.developer.apple.com/applebot.json",
  },
  { name: "DuckDuckBot", owner: "DuckDuckGo, search", kind: "search" },
  { name: "YandexBot", owner: "Yandex, search", kind: "search" },
  { name: "Baiduspider", owner: "Baidu, search", kind: "search" },
];

const GENERIC_BOT = /[\w.-]*(bot|crawler|spider|scraper)\b/i;
const SCRIPT_CLIENTS =
  /\b(curl|wget|python-requests|python-urllib|python-httpx|aiohttp|go-http-client|okhttp|axios|node-fetch|undici|scrapy|headlesschrome|phantomjs)\b/i;

const HOSTING_ASNS = new Set([
  8075, 9009, 12876, 13335, 14061, 14618, 15169, 16276, 16509, 20473, 24940,
  31898, 39351, 45102, 51167, 60068, 63949, 212238, 396982,
]);

type Bot = {
  name: string;
  owner: string | null;
  kind: string;
  verified: boolean | null;
};
export type Visitor = {
  ip: string;
  geo: Context["geo"] | null;
  userAgent: string | null;
  headers: Headers | null;
};

export async function describe({ ip, geo, userAgent, headers }: Visitor) {
  const [hostname, network, tor, bot] = await Promise.all([
    reverse(ip).then(
      (names) => names[0] ?? null,
      () => null,
    ),
    lookupNetwork(ip),
    isTorExit(ip),
    detectBot(ip, userAgent),
  ]);
  const hosting = network ? HOSTING_ASNS.has(network.asn) : null;
  const signals = headerSignals(headers, userAgent);
  const verdict = verdictOf(bot, signals, tor === true || hosting === true);
  const countryCode = geo
    ? (geo.country?.code ?? null)
    : (network?.country ?? null);

  return {
    ip,
    verdict,
    isBot: verdict !== "human" && verdict !== "proxy",
    isAiCrawler: verdict === "ai_crawler",
    isProxy: (tor === true || hosting === true) && bot?.verified !== true,
    version: isIP(ip),
    hostname,
    location: {
      city: geo?.city ?? null,
      region: geo?.subdivision?.name ?? null,
      country: countryCode ? countryName(countryCode) : null,
      countryCode,
      postalCode: geo?.postalCode ?? null,
      timezone: geo?.timezone ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    },
    network: network && {
      asn: network.asn,
      organization: network.organization,
      prefix: network.prefix,
      registry: network.registry,
    },
    proxy: { tor, hosting },
    userAgent,
    bot,
    signals,
  };
}

function verdictOf(bot: Bot | null, signals: string[], proxy: boolean) {
  if (bot?.verified === false) {
    return "spoofed_crawler";
  }
  if (bot?.kind === "ai") {
    return "ai_crawler";
  }
  if (bot?.kind === "search") {
    return "search_bot";
  }
  if (bot || signals.length > 0) {
    return "bot";
  }
  return proxy ? "proxy" : "human";
}

function headerSignals(headers: Headers | null, userAgent: string | null) {
  if (headers === null || !userAgent?.startsWith("Mozilla/")) {
    return [];
  }
  return [
    headers.has("accept-language") ? "" : "No Accept-Language header",
    headers.has("sec-fetch-mode") ? "" : "No Sec-Fetch headers",
    userAgent.includes("Chrome/") && !headers.has("sec-ch-ua")
      ? "Chrome user agent without Sec-CH-UA"
      : "",
  ].filter(Boolean);
}

export function plainAddress(address: string) {
  return address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? address;
}

export async function publicAddress() {
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 1 });
  resolver.setServers([OPENDNS_RESOLVER]);
  return (await resolver.resolve4("myip.opendns.com"))[0];
}

function countryName(code: string) {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
}

async function lookupNetwork(ip: string) {
  const zone =
    isIP(ip) === 4 ? "origin.asn.cymru.com" : "origin6.asn.cymru.com";
  const origin = await readTxt(`${reverseName(ip)}.${zone}`);
  if (!origin) {
    return null;
  }
  const [asns, prefix, country, registry] = origin
    .split("|")
    .map((part) => part.trim());
  const asn = Number(asns.split(" ")[0]);
  const name = (await readTxt(`AS${asn}.asn.cymru.com`))?.split("|")[4]?.trim();
  return {
    asn,
    organization:
      name?.replace(/^\S+ - /, "").replace(/, [A-Z]{2}$/, "") ?? null,
    prefix,
    country: country || null,
    registry,
  };
}

async function readTxt(name: string) {
  try {
    return (await resolveTxt(name))[0]?.join("") ?? null;
  } catch {
    return null;
  }
}

function reverseName(ip: string) {
  if (isIP(ip) === 4) {
    return ip.split(".").reverse().join(".");
  }
  const [head, tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const groups = [
    ...headGroups,
    ...Array(8 - headGroups.length - tailGroups.length).fill("0"),
    ...tailGroups,
  ];
  return groups
    .map((group) => group.padStart(4, "0"))
    .join("")
    .split("")
    .reverse()
    .join(".");
}

const lists = new Map<
  string,
  { expires: number; text: Promise<string | null> }
>();

function fetchList(url: string) {
  const cached = lists.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.text;
  }
  const text = fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((response) => (response.ok ? response.text() : null))
    .catch(() => null);
  lists.set(url, { expires: Date.now() + LIST_TTL_MS, text });
  text.then((value) => {
    if (value === null) {
      lists.delete(url);
    }
  });
  return text;
}

async function isTorExit(ip: string) {
  const list = await fetchList(TOR_EXIT_LIST);
  return list === null ? null : list.split("\n").includes(ip);
}

async function inRanges(url: string, ip: string) {
  const text = await fetchList(url);
  if (text === null) {
    return null;
  }
  try {
    const prefixes: { ipv4Prefix?: string; ipv6Prefix?: string }[] =
      JSON.parse(text).prefixes;
    const ranges = new BlockList();
    for (const { ipv4Prefix, ipv6Prefix } of prefixes) {
      const [address, bits] = (ipv4Prefix ?? ipv6Prefix ?? "").split("/");
      if (isIP(address)) {
        ranges.addSubnet(address, Number(bits), ipv4Prefix ? "ipv4" : "ipv6");
      }
    }
    return ranges.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
  } catch {
    return null;
  }
}

async function detectBot(
  ip: string,
  userAgent: string | null,
): Promise<Bot | null> {
  const lower = userAgent?.toLowerCase() ?? "";
  const claimed = BOTS.find((bot) => lower.includes(bot.name.toLowerCase()));
  if (claimed) {
    return {
      name: claimed.name,
      owner: claimed.owner,
      kind: claimed.kind,
      verified: claimed.ranges ? await inRanges(claimed.ranges, ip) : null,
    };
  }

  const urls = [...new Set(BOTS.flatMap((bot) => bot.ranges ?? []))];
  const matches = await Promise.all(urls.map((url) => inRanges(url, ip)));
  const url = urls.find((_, index) => matches[index]);
  const owners = BOTS.filter((bot) => bot.ranges === url);
  if (url && owners.length > 0) {
    return {
      name: owners.map((bot) => bot.name).join(" or "),
      owner: owners[0].owner.split(",")[0],
      kind: owners[0].kind,
      verified: true,
    };
  }

  if (userAgent === null) {
    return null;
  }
  const generic =
    userAgent === ""
      ? "No user agent"
      : (userAgent.match(GENERIC_BOT)?.[0] ??
        userAgent.match(SCRIPT_CLIENTS)?.[0]);
  return generic
    ? { name: generic, owner: null, kind: "other", verified: null }
    : null;
}
