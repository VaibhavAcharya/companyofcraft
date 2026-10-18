import { isIP } from "node:net";
import type { Config, Context } from "@netlify/functions";
import { isPrivateAddress } from "../lib/fetch.ts";
import { describe, plainAddress, publicAddress } from "../lib/ip.ts";

const FORWARDED_HEADERS = [
  "user-agent",
  "accept",
  "accept-language",
  "sec-ch-ua",
  "sec-fetch-mode",
];

export const config: Config = {
  path: "/api/ip-lookup",
  method: ["GET", "POST"],
  rateLimit: {
    windowLimit: 600,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

export default async (req: Request, context: Context) =>
  req.method === "POST" ? detect(req) : lookup(req, context);

async function lookup(req: Request, context: Context) {
  const params = new URL(req.url).searchParams;
  const callerIp = plainAddress(context.ip);
  const caller = isPrivateAddress(callerIp)
    ? await publicAddress().catch(() => callerIp)
    : callerIp;
  const ip = plainAddress(params.get("ip")?.trim() || caller);
  if (!isIP(ip)) {
    return Response.json(
      { error: "Enter an IPv4 or IPv6 address." },
      { status: 400 },
    );
  }
  const self = ip === caller;
  if (!self && isPrivateAddress(ip)) {
    return Response.json(
      { error: "That is a private address." },
      { status: 400 },
    );
  }

  const ownRequest = self && !params.has("ua");
  return Response.json(
    await describe({
      ip,
      geo: self ? context.geo : null,
      userAgent: ownRequest
        ? (req.headers.get("user-agent") ?? "")
        : params.get("ua"),
      headers: ownRequest ? req.headers : null,
    }),
    { headers: { "cache-control": "private, no-store" } },
  );
}

async function detect(req: Request) {
  const body = await req.json().catch(() => null);
  const ip = typeof body?.ip === "string" ? plainAddress(body.ip.trim()) : "";
  if (!isIP(ip)) {
    return Response.json(
      { error: "Send the visitor's IPv4 or IPv6 address as ip." },
      { status: 400 },
    );
  }
  if (isPrivateAddress(ip)) {
    return Response.json(
      { error: "That is a private address." },
      { status: 400 },
    );
  }

  const sent =
    typeof body.headers === "object" && body.headers !== null
      ? Object.entries(body.headers)
      : null;
  const headers =
    sent &&
    new Headers(
      sent.filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" &&
          FORWARDED_HEADERS.includes(entry[0].toLowerCase()),
      ),
    );
  return Response.json(
    await describe({
      ip,
      geo: null,
      userAgent: headers ? (headers.get("user-agent") ?? "") : null,
      headers,
    }),
    { headers: { "cache-control": "private, no-store" } },
  );
}
