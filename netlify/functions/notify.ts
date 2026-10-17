import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const HISTORY_DEFAULT_LIMIT = 50;
const HISTORY_MAX_LIMIT = 200;

type Notification = {
  project: string;
  title?: string;
  message: string;
  link?: string;
};

type HistoryEntry = Notification & { id: string; sentAt: string };

export const config: Config = {
  path: "/api/notify",
  method: ["GET", "POST"],
};

export default async (req: Request) => {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getStore({ name: "notify", consistency: "strong" });

  if (req.method === "GET") {
    const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
    return Response.json({ notifications: await readHistory(store, limit) });
  }

  const notification = parseNotification(await req.json().catch(() => null));
  if (!notification) {
    return Response.json(
      {
        error:
          "Body must be JSON with string `project` and `message`, optional string `title` and http(s) `link`",
      },
      { status: 400 },
    );
  }

  const now = Date.now();

  const dedupeKey = `dedupe/${hash(notification.project, notification.title ?? "", notification.message)}`;
  const lastSent = await store.get(dedupeKey, { type: "json" });
  if (lastSent && now - lastSent.sentAt < DEDUPE_WINDOW_MS) {
    return Response.json({ status: "deduped" });
  }

  const rateKey = `rate/${encodeURIComponent(notification.project)}`;
  const rate = await store.get(rateKey, { type: "json" });
  const recentSends: number[] = (rate?.sentAt ?? []).filter(
    (sentAt: number) => now - sentAt < RATE_LIMIT_WINDOW_MS,
  );
  if (recentSends.length >= RATE_LIMIT_MAX) {
    return Response.json({ status: "rate_limited" }, { status: 429 });
  }

  const telegramResponse = await sendTelegramMessage(notification);
  if (!telegramResponse.ok) {
    return Response.json(
      {
        error: "Telegram request failed",
        telegram: await telegramResponse.json(),
      },
      { status: 502 },
    );
  }

  const id = randomUUID();
  const entry: HistoryEntry = {
    id,
    sentAt: new Date(now).toISOString(),
    ...notification,
  };

  await Promise.all([
    store.setJSON(dedupeKey, { sentAt: now }),
    store.setJSON(rateKey, { sentAt: [...recentSends, now] }),
    store.setJSON(`history/${newestFirstKey(now)}-${id}`, entry),
  ]);

  return Response.json({ status: "sent", id });
};

function isAuthorized(req: Request) {
  const apiKey = Netlify.env.get("NOTIFY_API_KEY");
  const authorization = req.headers.get("authorization");
  if (!apiKey || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  return timingSafeEqual(
    createHash("sha256").update(authorization.slice("Bearer ".length)).digest(),
    createHash("sha256").update(apiKey).digest(),
  );
}

function parseNotification(body: unknown): Notification | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { project, title, message, link } = body as Record<string, unknown>;
  if (typeof project !== "string" || project.trim() === "") {
    return null;
  }
  if (typeof message !== "string" || message.trim() === "") {
    return null;
  }
  if (title !== undefined && typeof title !== "string") {
    return null;
  }
  if (link !== undefined && !isHttpUrl(link)) {
    return null;
  }
  return { project, title, message, link: link as string | undefined };
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) {
    return false;
  }
  return ["http:", "https:"].includes(new URL(value).protocol);
}

function parseLimit(value: string | null) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return HISTORY_DEFAULT_LIMIT;
  }
  return Math.min(limit, HISTORY_MAX_LIMIT);
}

function sendTelegramMessage({ project, title, message, link }: Notification) {
  const lines = [
    title
      ? `<b>${escapeHtml(project)}</b> · ${escapeHtml(title)}`
      : `<b>${escapeHtml(project)}</b>`,
    escapeHtml(message),
  ];
  if (link) {
    lines.push(escapeHtml(link));
  }

  return fetch(
    `https://api.telegram.org/bot${Netlify.env.get("TELEGRAM_BOT_TOKEN")}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: Netlify.env.get("TELEGRAM_CHAT_ID"),
        text: lines.join("\n"),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
    },
  );
}

async function readHistory(
  store: ReturnType<typeof getStore>,
  limit: number,
): Promise<HistoryEntry[]> {
  const { blobs } = await store.list({ prefix: "history/" });
  const entries = await Promise.all(
    blobs.slice(0, limit).map(({ key }) => store.get(key, { type: "json" })),
  );
  return entries.filter(Boolean);
}

function newestFirstKey(timestamp: number) {
  return (Number.MAX_SAFE_INTEGER - timestamp).toString().padStart(16, "0");
}

function hash(...parts: string[]) {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
