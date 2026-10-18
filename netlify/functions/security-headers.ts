import type { Config } from "@netlify/functions";
import { fetchError, parseTarget, readText, safeFetch } from "../lib/fetch.ts";
import { decodeEntities, readTags } from "../lib/html.ts";

const ONE_YEAR_SECONDS = 31536000;
const LOOSE_SCRIPT_SOURCES = ["*", "http:", "https:", "data:"];
const LEAKY_REFERRER_POLICIES = ["unsafe-url", "no-referrer-when-downgrade"];

type Check = { ok: boolean; label: string; detail: string };
type Policy = Map<string, string[]>;

export const config: Config = {
  path: "/api/security-headers",
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

  const headers = page.response.headers;
  const html = await readText(page.response, /<\/head>/i);
  const metaContent = readTags(html, "meta").find(
    (attrs) => attrs["http-equiv"]?.toLowerCase() === "content-security-policy",
  )?.content;
  const metaPolicy = metaContent ? decodeEntities(metaContent) : undefined;
  const headerPolicy = headers.get("content-security-policy");
  const policy =
    headerPolicy || metaPolicy
      ? parsePolicy([headerPolicy, metaPolicy].filter(Boolean).join(";"))
      : null;

  return Response.json(
    {
      url: page.url,
      status: page.response.status,
      headers: Array.from(headers.entries()).filter(
        ([name]) => name !== "set-cookie",
      ),
      policy: policy
        ? Array.from(policy, ([name, values]) => [name, values.join(" ")])
        : [],
      checks: [
        ...(await transportChecks(page.url, headers)),
        policyCheck(headers, headerPolicy, metaPolicy),
        ...(policy ? policyChecks(policy) : []),
        framingCheck(headers, headerPolicy ? parsePolicy(headerPolicy) : null),
        {
          ok:
            headers.get("x-content-type-options")?.toLowerCase() === "nosniff",
          label: "X-Content-Type-Options",
          detail:
            headers.get("x-content-type-options")?.toLowerCase() === "nosniff"
              ? "nosniff"
              : "Missing. Set it to nosniff so browsers do not guess file types.",
        },
        referrerCheck(headers.get("referrer-policy")),
        {
          ok: headers.has("permissions-policy"),
          label: "Permissions-Policy",
          detail: headers.has("permissions-policy")
            ? "Set"
            : "Missing. It turns off browser features the site does not use, like the camera.",
        },
        ...cookieChecks(headers.getSetCookie()),
        ...serverChecks(headers),
      ],
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
};

async function transportChecks(url: string, headers: Headers) {
  const https = new URL(url).protocol === "https:";
  const checks: Check[] = [
    {
      ok: https,
      label: "HTTPS",
      detail: https ? "Served over HTTPS" : "Served over plain HTTP",
    },
  ];
  if (!https) {
    return checks;
  }

  const insecure = new URL(url);
  insecure.protocol = "http:";
  const redirect = await safeFetch(insecure, "text/html").then(
    async ({ url, response }) => {
      await response.body?.cancel();
      return new URL(url).protocol === "https:";
    },
    () => null,
  );
  checks.push({
    ok: redirect !== false,
    label: "HTTP to HTTPS",
    detail:
      redirect === null
        ? "No answer on http://"
        : redirect
          ? "http:// redirects to https://"
          : "http:// serves the page without redirecting to https://",
  });

  const hsts = headers.get("strict-transport-security");
  const maxAge = Number(hsts?.match(/max-age\s*=\s*"?(\d+)/i)?.[1] ?? 0);
  const extras = [
    /includesubdomains/i.test(hsts ?? "") ? "includes subdomains" : "",
    /preload/i.test(hsts ?? "") ? "preload" : "",
  ].filter(Boolean);
  checks.push({
    ok: maxAge >= ONE_YEAR_SECONDS,
    label: "Strict-Transport-Security",
    detail: !hsts
      ? "Missing. Browsers can still load the site over plain HTTP first."
      : maxAge >= ONE_YEAR_SECONDS
        ? [`max-age is ${duration(maxAge)}`, ...extras].join(", ")
        : `max-age is ${duration(maxAge)}. Use at least 1 year (${ONE_YEAR_SECONDS}).`,
  });
  return checks;
}

function duration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function parsePolicy(text: string): Policy {
  const policy: Policy = new Map();
  for (const directive of text.split(/[;,]/)) {
    const [name, ...values] = directive.trim().split(/\s+/);
    if (name && !policy.has(name.toLowerCase())) {
      policy.set(name.toLowerCase(), values);
    }
  }
  return policy;
}

function policyCheck(
  headers: Headers,
  headerPolicy: string | null,
  metaPolicy: string | undefined,
): Check {
  if (headerPolicy) {
    return {
      ok: true,
      label: "Content-Security-Policy",
      detail: metaPolicy ? "Set in the header and in a <meta> tag" : "Set",
    };
  }
  if (metaPolicy) {
    return {
      ok: true,
      label: "Content-Security-Policy",
      detail:
        "Set in a <meta> tag. frame-ancestors and report-uri only work in the header.",
    };
  }
  return {
    ok: false,
    label: "Content-Security-Policy",
    detail: headers.has("content-security-policy-report-only")
      ? "Only Content-Security-Policy-Report-Only is set. It reports problems and does not block anything."
      : "Missing. A policy limits where scripts, styles and images can load from.",
  };
}

function policyChecks(policy: Policy): Check[] {
  const scripts = policy.get("script-src") ?? policy.get("default-src");
  const objects = policy.get("object-src") ?? policy.get("default-src");
  return [
    scriptCheck(scripts),
    {
      ok: objects?.length === 1 && objects[0] === "'none'",
      label: "CSP object-src",
      detail:
        objects?.length === 1 && objects[0] === "'none'"
          ? "'none'"
          : "Set object-src 'none' to block <object> and <embed> content.",
    },
    {
      ok: policy.has("base-uri"),
      label: "CSP base-uri",
      detail: policy.has("base-uri")
        ? policy.get("base-uri")?.join(" ") || "Set"
        : "Missing. Without it an injected <base> tag can change where relative scripts load from.",
    },
  ];
}

function scriptCheck(sources: string[] | undefined): Check {
  if (!sources) {
    return {
      ok: false,
      label: "CSP script-src",
      detail:
        "No script-src or default-src, so scripts can load from anywhere.",
    };
  }
  const lower = sources.map((source) => source.toLowerCase());
  const pinned = lower.some(
    (source) =>
      source.startsWith("'nonce-") ||
      /^'sha(256|384|512)-/.test(source) ||
      source === "'strict-dynamic'",
  );
  const problems = [
    lower.includes("'unsafe-inline'") && !pinned
      ? "'unsafe-inline' lets any inline script run"
      : "",
    lower.includes("'unsafe-eval'") ? "'unsafe-eval' allows eval()" : "",
    ...LOOSE_SCRIPT_SOURCES.filter((loose) => lower.includes(loose)).map(
      (loose) => `${loose} allows scripts from too many places`,
    ),
  ].filter(Boolean);
  return {
    ok: problems.length === 0,
    label: "CSP script-src",
    detail:
      problems.length === 0 ? sources.join(" ") : `${problems.join(". ")}.`,
  };
}

function framingCheck(headers: Headers, headerPolicy: Policy | null): Check {
  const ancestors = headerPolicy?.get("frame-ancestors");
  const frameOptions = headers.get("x-frame-options")?.toUpperCase();
  if (ancestors) {
    return {
      ok: true,
      label: "Framing",
      detail: `frame-ancestors ${ancestors.join(" ")}`,
    };
  }
  if (frameOptions === "DENY" || frameOptions === "SAMEORIGIN") {
    return {
      ok: true,
      label: "Framing",
      detail: `X-Frame-Options ${frameOptions}`,
    };
  }
  return {
    ok: false,
    label: "Framing",
    detail:
      "Any site can put this page in a frame. Set frame-ancestors in the CSP header or X-Frame-Options.",
  };
}

function referrerCheck(value: string | null): Check {
  const policies = value?.toLowerCase().split(/\s*,\s*/) ?? [];
  const leaky = LEAKY_REFERRER_POLICIES.includes(policies.at(-1) ?? "");
  return {
    ok: Boolean(value) && !leaky,
    label: "Referrer-Policy",
    detail: !value
      ? "Missing. Browsers default to strict-origin-when-cross-origin."
      : leaky
        ? `${value} sends the full URL to other sites.`
        : value,
  };
}

function cookieChecks(cookies: string[]): Check[] {
  if (cookies.length === 0) {
    return [];
  }
  const problems = cookies.flatMap((cookie) => {
    const [pair, ...attributes] = cookie.split(";").map((part) => part.trim());
    const name = pair.split("=")[0];
    const flags = attributes.map((part) => part.split("=")[0].toLowerCase());
    const missing = ["Secure", "HttpOnly"].filter(
      (flag) => !flags.includes(flag.toLowerCase()),
    );
    return missing.length === 0
      ? []
      : [`${name} has no ${missing.join(" or ")}`];
  });
  return [
    {
      ok: problems.length === 0,
      label: "Cookies",
      detail:
        problems.length === 0
          ? `${cookies.length} set, all Secure and HttpOnly`
          : `${problems.join(". ")}.`,
    },
  ];
}

function serverChecks(headers: Headers): Check[] {
  const poweredBy = headers.get("x-powered-by");
  const server = headers.get("server");
  const leaks = [
    poweredBy ? `X-Powered-By: ${poweredBy}` : "",
    server && /\d/.test(server) ? `Server: ${server}` : "",
  ].filter(Boolean);
  if (!poweredBy && !server) {
    return [];
  }
  return [
    {
      ok: leaks.length === 0,
      label: "Server details",
      detail:
        leaks.length === 0
          ? "No version numbers"
          : `${leaks.join(", ")}. Versions tell attackers what to try.`,
    },
  ];
}
