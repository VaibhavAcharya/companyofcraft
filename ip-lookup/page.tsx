import type { Icon } from "@phosphor-icons/react";
import {
  CheckCircleIcon,
  GlobeIcon,
  RobotIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { type ReactNode, useEffect, useState } from "react";
import {
  Badge,
  type BadgeProps,
  Button,
  Card,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  useCopyToClipboard,
} from "uiofcraft";
import { track } from "../lib/analytics.ts";
import { About, AlsoBuilds, ToolPage } from "../lib/layout.tsx";
import {
  Columns,
  DefinitionList,
  Empty,
  Faq,
  File,
  Heading,
  type Lookup,
  LookupForm,
  LookupStatus,
} from "../lib/tool.tsx";
import type { highlight } from "./highlight.ts";
import {
  COLUMNS,
  COUNTRIES,
  DEGREES,
  FIRST_COUNTRY_CODE,
  LAND,
  ROWS,
  TOP_LATITUDE,
} from "./world.ts";

const TOOL = "ip-lookup";

const VERDICTS: Record<
  string,
  { label: string; variant: BadgeProps["variant"]; icon: Icon }
> = {
  human: {
    label: "Looks like a person",
    variant: "success",
    icon: CheckCircleIcon,
  },
  proxy: {
    label: "Likely a VPN, proxy or server",
    variant: "warning",
    icon: WarningIcon,
  },
  bot: { label: "Bot or script", variant: "error", icon: XCircleIcon },
  ai_crawler: { label: "AI crawler", variant: "secondary", icon: RobotIcon },
  search_bot: {
    label: "Search engine bot",
    variant: "secondary",
    icon: RobotIcon,
  },
  spoofed_crawler: {
    label: "Fake crawler",
    variant: "error",
    icon: XCircleIcon,
  },
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

function useIpLookup() {
  const [lookup, setLookup] = useState<Lookup<Report>>({
    query: "",
    state: "idle",
    message: "",
  });

  useEffect(() => {
    const ip = new URLSearchParams(location.search).get("ip")?.trim() ?? "";
    setLookup({
      query: ip,
      state: "loading",
      message: ip ? `Looking up ${ip}...` : "Finding your IP...",
    });
    load(ip).then(
      (result) => setLookup({ query: ip, state: "done", message: "", result }),
      (error: Error) =>
        setLookup({ query: ip, state: "error", message: error.message }),
    );
  }, []);

  return lookup;
}

async function load(ip: string): Promise<Report> {
  const query = ip ? `?${new URLSearchParams({ ip })}` : "";
  const response = await fetch(`/api/ip-lookup${query}`);
  if (response.status === 429) {
    track("Lookup", { tool: TOOL, ip: ip || "self", result: "rate-limited" });
    throw new Error("Too many lookups. Try again in a minute.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    track("Lookup", { tool: TOOL, ip: ip || "self", result: "error" });
    throw new Error(body?.error ?? "Could not look up that IP.");
  }
  track("Lookup", { tool: TOOL, ip: ip || "self", result: "ok" });
  return body;
}

export default function IpLookup() {
  const lookup = useIpLookup();
  return (
    <ToolPage
      page={TOOL}
      title="IP lookup"
      tagline="See what a website can tell from an IP address: where it is, whose network it is on, and whether it looks like a VPN, a bot or an AI crawler."
      frame="Look up an IP"
      note="Leave it empty to see your own. Nothing is stored."
      tool={
        <>
          <LookupForm
            action={`/${TOOL}`}
            name="ip"
            label="IP address"
            button="Look up"
            icon={<GlobeIcon />}
            query={lookup.query}
            placeholder="Any IP, like 8.8.8.8"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
          />
          <LookupStatus
            lookup={lookup}
            action={`/${TOOL}`}
            name="ip"
            examples={["8.8.8.8", "1.1.1.1", "66.249.66.1"]}
          />
          {lookup.result && (
            <Results report={lookup.result} self={lookup.query === ""} />
          )}
        </>
      }
    >
      <Faq
        tool={TOOL}
        questions={[
          [
            "How do I check if a request comes from a real Googlebot or GPTBot?",
            <>
              Anyone can put Googlebot or GPTBot in a user agent. Google, Bing,
              Apple, OpenAI, Anthropic and Perplexity publish the IP ranges
              their crawlers use. A request is real when its IP is in those
              ranges. Call the API with the <code>ip</code> and <code>ua</code>{" "}
              of the request to check it.
            </>,
          ],
          [
            "Can it tell if someone uses a VPN?",
            "Partly. Tor exit nodes are on a public list, so those are certain. VPNs and proxies mostly run on hosting networks like AWS, DigitalOcean, Hetzner or M247, so an IP from one of those is likely a VPN, a proxy or a server. A VPN on a home network looks like any home connection.",
          ],
          [
            "Why is my location a different city?",
            "An IP address belongs to a network, not a house. The location is where your internet provider says that network is, which can be the nearest big city. Mobile networks and VPNs can show a city far away.",
          ],
          [
            "Why is the city missing when I look up another IP?",
            "The city comes from the network your request arrives through, so it is only known for your own IP. For other IPs the country comes from the regional internet registry.",
          ],
          ["Are the IPs I look up saved?", "No. Nothing is stored."],
        ]}
      />
      <About title="Detect bots on your site">
        <p>
          Send the visitor's IP and a few request headers from your server to{" "}
          <code>POST /api/ip-lookup</code>. The answer has a{" "}
          <code>verdict</code>: <code>human</code>, <code>proxy</code>,{" "}
          <code>bot</code>, <code>ai_crawler</code>, <code>search_bot</code> or{" "}
          <code>spoofed_crawler</code>, plus <code>isBot</code>,{" "}
          <code>isAiCrawler</code> and <code>isProxy</code>. Send only the
          headers below, not cookies.
        </p>
        <Code lang="shellscript" code={CURL_EXAMPLE} />
        <p>On Netlify, an Edge Function can check every request:</p>
        <Code lang="javascript" code={EDGE_FUNCTION_EXAMPLE} />
        <p>
          To check your own request, call <code>GET /api/ip-lookup</code>. Add{" "}
          <code>?ip=</code> and <code>&amp;ua=</code> to look up another IP.
          Each server or browser can make 600 calls a minute.
        </p>
      </About>
      <About title="How it works">
        <p>
          The network and its country come from the{" "}
          <a
            href="https://www.team-cymru.com/ip-asn-mapping"
            target="_blank"
            rel="noopener"
          >
            Team Cymru IP to ASN service
          </a>
          . Tor exit nodes come from the{" "}
          <a
            href="https://check.torproject.org/torbulkexitlist"
            target="_blank"
            rel="noopener"
          >
            Tor Project list
          </a>
          . Bots are matched by user agent and checked against the IP ranges
          each company publishes. The map uses{" "}
          <a
            href="https://www.naturalearthdata.com"
            target="_blank"
            rel="noopener"
          >
            Natural Earth
          </a>{" "}
          data.
        </p>
        <AlsoBuilds page={TOOL} />
      </About>
    </ToolPage>
  );
}

const CURL_EXAMPLE = `curl -X POST https://companyofcraft.com/api/ip-lookup \\
  -d '{"ip":"66.249.66.1","headers":{"user-agent":"Googlebot/2.1"}}'`;

const EDGE_FUNCTION_EXAMPLE = `const HEADERS = ["user-agent", "accept", "accept-language", "sec-ch-ua", "sec-fetch-mode"];

export default async (request, context) => {
  const headers = Object.fromEntries(
    HEADERS.filter((name) => request.headers.has(name)).map((name) => [name, request.headers.get(name)]),
  );
  const response = await fetch("https://companyofcraft.com/api/ip-lookup", {
    method: "POST",
    body: JSON.stringify({ ip: context.ip, headers }),
  });
  const { verdict } = await response.json();
  if (verdict === "spoofed_crawler") {
    return new Response("Forbidden", { status: 403 });
  }
  return context.next();
};`;

type Tokens = Awaited<ReturnType<typeof highlight>>;

function Code({
  lang,
  code,
  className,
}: {
  lang: string;
  code: string;
  className?: string;
}) {
  const [tokens, setTokens] = useState<Tokens>();

  useEffect(() => {
    import("./highlight.ts")
      .then(({ highlight }) => highlight(code, lang))
      .then(setTokens);
  }, [code, lang]);

  return (
    <File className={className}>
      {tokens === undefined
        ? code
        : tokens.flatMap((line, index) => [
            index > 0 && "\n",
            ...line.map((token) => (
              <span
                key={token.offset}
                className="highlighted"
                style={token.htmlStyle}
              >
                {token.content}
              </span>
            )),
          ])}
    </File>
  );
}

function CopyButton({ label, text }: { label: string; text: () => string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 1500 });
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        track("IP lookup copy", { label });
        copyToClipboard(text());
      }}
    >
      {isCopied ? "Copied" : label}
    </Button>
  );
}

function Results({ report, self }: { report: Report; self: boolean }) {
  const { label, variant, icon: VerdictIcon } = VERDICTS[report.verdict];
  return (
    <div className="mt-8">
      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">
                {self ? "Your IP address" : "IP address"}
              </p>
              <p className="wrap-anywhere font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
                {report.ip}
              </p>
              {report.hostname && (
                <p className="mt-1 wrap-anywhere text-muted-foreground text-sm">
                  {report.hostname}
                </p>
              )}
            </div>
            <CopyButton label="Copy" text={() => report.ip} />
          </div>
          <Badge className="mt-4 self-start" variant={variant} size="lg">
            <VerdictIcon weight="bold" />
            {label}
          </Badge>
          <WorldMap report={report} />
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <LocationTile report={report} self={self} />
          <NetworkTile report={report} />
          <ProxyTile report={report} />
          <BotTile report={report} />
        </div>
      </div>
      <Views report={report} />
    </div>
  );
}

function WorldMap({ report: { location } }: { report: Report }) {
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
  const x = point && (point[0] + 180) / DEGREES;
  const y = point && (TOP_LATITUDE - point[1]) / DEGREES;
  return (
    <figure className="map">
      <svg
        viewBox={`0 0 ${COLUMNS} ${ROWS}`}
        role="img"
        aria-label={place ? `Map pointing at ${place}` : "World map"}
      >
        <path className="map-land" d={land} />
        <path className="map-country" d={country} />
        {x !== null && y !== null && (
          <>
            <circle className="map-pulse" cx={x} cy={y} r={1.6} />
            <circle className="map-pin" cx={x} cy={y} r={1.6}>
              <title>{place}</title>
            </circle>
          </>
        )}
      </svg>
      <figcaption>
        {location.city
          ? "Approximate location of the network, not a street address."
          : place
            ? "Country of the network. The city is only known for your own IP."
            : "No location for this IP."}
      </figcaption>
    </figure>
  );
}

function placeName(location: Report["location"]) {
  return [location.city, location.region, location.country]
    .filter((part) => part !== null)
    .join(", ");
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className="mt-0.5 mb-1 line-clamp-2 wrap-anywhere font-semibold"
        title={value}
      >
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </Card>
  );
}

function LocationTile({
  report: { location },
  self,
}: {
  report: Report;
  self: boolean;
}) {
  if (!location.country) {
    return (
      <Tile
        label="Location"
        value="Unknown"
        detail="No country found for this IP."
      />
    );
  }
  if (!location.city) {
    return (
      <Tile
        label="Location"
        value={location.country}
        detail={
          self
            ? "No city for this IP."
            : "From the internet registry. Look up your own IP to see a city."
        }
      />
    );
  }
  return (
    <Tile
      label="Location"
      value={`${location.city}, ${location.country}`}
      detail={[location.region, location.timezone].filter(Boolean).join(", ")}
    />
  );
}

function NetworkTile({ report: { network } }: { report: Report }) {
  return network === null ? (
    <Tile
      label="Network"
      value="Unknown"
      detail="No network found for this IP."
    />
  ) : (
    <Tile
      label="Network"
      value={network.organization ?? `AS${network.asn}`}
      detail={`AS${network.asn}, ${network.prefix}`}
    />
  );
}

function ProxyTile({ report: { proxy, network } }: { report: Report }) {
  if (proxy.tor) {
    return (
      <Tile
        label="VPN or proxy"
        value="Tor exit node"
        detail="Traffic leaves the Tor network here, so the real sender is hidden."
      />
    );
  }
  if (proxy.hosting) {
    return (
      <Tile
        label="VPN or proxy"
        value="Hosting network"
        detail={`${network?.organization ?? "This network"} rents out servers. VPNs, proxies and bots often run there.`}
      />
    );
  }
  if (proxy.tor === null && proxy.hosting === null) {
    return (
      <Tile
        label="VPN or proxy"
        value="Unknown"
        detail="Could not check this IP."
      />
    );
  }
  return (
    <Tile
      label="VPN or proxy"
      value="No sign"
      detail="Not Tor, and not a known hosting or VPN network."
    />
  );
}

function BotTile({ report: { bot, userAgent, signals } }: { report: Report }) {
  if (bot === null && signals.length > 0) {
    return (
      <Tile
        label="Bot"
        value="Likely a script"
        detail={`${signals.join(". ")}.`}
      />
    );
  }
  if (bot === null) {
    return userAgent === null ? (
      <Tile
        label="Bot"
        value="Not a known crawler"
        detail="Not in the IP ranges that crawlers publish."
      />
    ) : (
      <Tile
        label="Bot"
        value="Looks like a browser"
        detail="The user agent and headers match a real browser."
      />
    );
  }
  if (bot.verified === false) {
    return (
      <Tile
        label="Bot"
        value={`Fake ${bot.name}`}
        detail="The user agent says so, but the IP is not in its published ranges."
      />
    );
  }
  return (
    <Tile
      label="Bot"
      value={bot.name}
      detail={[
        bot.owner,
        bot.verified ? "The IP is in its published ranges." : "",
      ]
        .filter(Boolean)
        .join(". ")}
    />
  );
}

function Views({ report }: { report: Report }) {
  const json = JSON.stringify(report, null, 2);
  return (
    <Tabs
      className="mt-10"
      defaultValue="Details"
      onValueChange={(view) => track("IP lookup view", { view })}
    >
      <TabsList aria-label="Views">
        <TabsTab value="Details">Details</TabsTab>
        <TabsTab value="JSON">JSON</TabsTab>
      </TabsList>
      <TabsPanel value="Details">
        <Details report={report} />
      </TabsPanel>
      <TabsPanel value="JSON">
        <div className="mt-2 mb-3">
          <CopyButton label="Copy JSON" text={() => json} />
        </div>
        <Code className="max-h-128" lang="json" code={json} />
      </TabsPanel>
    </Tabs>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Heading>{title}</Heading>
      {children}
    </div>
  );
}

function Details({
  report: { location, network, userAgent, signals },
}: {
  report: Report;
}) {
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
  return (
    <Columns>
      <Group title="Location">
        {place.length === 0 ? (
          <Empty>No location for this IP.</Empty>
        ) : (
          <DefinitionList pairs={place} />
        )}
      </Group>
      <Group title="Network">
        {network === null ? (
          <Empty>No network found for this IP.</Empty>
        ) : (
          <DefinitionList
            pairs={[
              ["ASN", `AS${network.asn}`],
              ["Organization", network.organization ?? "Unknown"],
              ["Prefix", network.prefix],
              ["Registry", network.registry.toUpperCase()],
            ]}
          />
        )}
      </Group>
      {userAgent !== null && (
        <Group title="Request">
          <DefinitionList
            pairs={[
              ["User agent", userAgent || "None"],
              [
                "Header checks",
                signals.length === 0 ? "Pass" : signals.join(". "),
              ],
            ]}
          />
        </Group>
      )}
    </Columns>
  );
}
