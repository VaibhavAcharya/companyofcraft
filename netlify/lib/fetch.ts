import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_TEXT_BYTES = 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (compatible; CompanyofCraftBot/1.0; +https://companyofcraft.com/)";

export function parseTarget(value: string | null) {
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

export async function safeFetch(url: URL, accept: string) {
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

export function isPrivateAddress(address: string) {
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

export function fetchError(error: unknown) {
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

export async function readBytes(response: Response, maxBytes: number) {
  if (!response.body) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }
  await reader.cancel();
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return all.subarray(0, maxBytes);
}

export async function readText(response: Response, until?: RegExp) {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < MAX_TEXT_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (until?.test(text)) {
      break;
    }
  }
  await reader.cancel();
  return text;
}
