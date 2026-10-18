export type Check = { ok: boolean; label: string; detail: string };

export function runLookup<Result>(
  api: string,
  tooMany: string,
  render: (result: Result) => Node[],
) {
  const input = document.querySelector<HTMLInputElement>("#url");
  const statusLine = document.querySelector<HTMLParagraphElement>(".status");
  const results = document.querySelector<HTMLDivElement>(".results");

  const target = new URLSearchParams(location.search).get("url");
  if (input && statusLine && results && target) {
    input.value = target;
    statusLine.textContent = "Fetching the page...";
    load<Result>(api, target, tooMany).then(
      (result) => {
        statusLine.textContent = "";
        results.replaceChildren(...render(result));
        results.hidden = false;
      },
      (error: Error) => {
        statusLine.textContent = error.message;
      },
    );
  }
}

async function load<Result>(
  api: string,
  url: string,
  tooMany: string,
): Promise<Result> {
  const response = await fetch(`${api}?${new URLSearchParams({ url })}`);
  if (response.status === 429) {
    throw new Error(tooMany);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    throw new Error(body?.error ?? "Could not load that page.");
  }
  return body;
}

export function el<K extends keyof HTMLElementTagNameMap>(
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

export function fetched(status: number, url: string) {
  const link = el("a", "", [url]);
  link.href = url;
  link.rel = "noopener nofollow";
  link.target = "_blank";
  return el("p", "fetched", [`${status} `, link]);
}

export function summary(checks: Check[]) {
  const passed = checks.filter((check) => check.ok).length;
  return el("p", "summary", [`${passed} of ${checks.length} checks pass`]);
}

export function checkList(checks: Check[]) {
  return el(
    "ul",
    "checks",
    checks.map((check) =>
      el("li", check.ok ? "ok" : "missing", [
        el("span", "check-icon", [check.ok ? "✓" : "✕"]),
        el("code", "", [check.label]),
        el("span", "check-detail", [check.detail]),
      ]),
    ),
  );
}

export function definitionList(pairs: [string, string][]) {
  return el(
    "dl",
    "tags",
    pairs.flatMap(([name, value]) => [
      el("dt", "", [name]),
      el("dd", "", [value]),
    ]),
  );
}
