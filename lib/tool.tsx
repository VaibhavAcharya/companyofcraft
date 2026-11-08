import { CaretDownIcon, CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { Button, cn, Input } from "uiofcraft";
import { track } from "./analytics.ts";

export type Check = { ok: boolean; label: string; detail: string };

export type Lookup<Result> = {
  query: string;
  status: string;
  result?: Result;
};

export function useLookup<Result>(tool: string, tooMany: string) {
  const [lookup, setLookup] = useState<Lookup<Result>>({
    query: "",
    status: "",
  });

  useEffect(() => {
    const url = new URLSearchParams(location.search).get("url");
    if (!url) {
      return;
    }
    setLookup({ query: url, status: "Fetching the page..." });
    load<Result>(tool, url, tooMany).then(
      (result) => setLookup({ query: url, status: "", result }),
      (error: Error) => setLookup({ query: url, status: error.message }),
    );
  }, [tool, tooMany]);

  return lookup;
}

async function load<Result>(
  tool: string,
  url: string,
  tooMany: string,
): Promise<Result> {
  const response = await fetch(`/api/${tool}?${new URLSearchParams({ url })}`);
  if (response.status === 429) {
    track("Lookup", { tool, url, result: "rate-limited" });
    throw new Error(tooMany);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    track("Lookup", { tool, url, result: "error" });
    throw new Error(body?.error ?? "Could not load that page.");
  }
  track("Lookup", { tool, url, result: "ok" });
  return body;
}

export function LookupForm({
  action,
  name,
  label,
  button,
  query,
  ...input
}: {
  action: string;
  name: string;
  label: string;
  button: string;
  query: string;
  placeholder: string;
  inputMode: "url" | "text";
  autoComplete: string;
  spellCheck?: boolean;
  required?: boolean;
}) {
  return (
    <form className="mt-6 flex gap-2" method="get" action={action}>
      <label className="sr-only" htmlFor={name}>
        {label}
      </label>
      <Input
        key={query}
        id={name}
        name={name}
        type="text"
        size="lg"
        defaultValue={query}
        {...input}
      />
      <Button type="submit" size="lg">
        {button}
      </Button>
    </form>
  );
}

export function Status({ children }: { children: string }) {
  return (
    <p
      className="mt-4 text-muted-foreground empty:hidden"
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 font-semibold">{children}</h2>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

export function Fetched({
  tool,
  status,
  url,
}: {
  tool: string;
  status: number;
  url: string;
}) {
  return (
    <p className="mt-6 break-all text-muted-foreground text-sm">
      {status}{" "}
      <a
        className="underline"
        href={url}
        rel="noopener nofollow"
        target="_blank"
        onClick={() => track("Result link", { tool })}
      >
        {url}
      </a>
    </p>
  );
}

export function Summary({ checks }: { checks: Check[] }) {
  const passed = checks.filter((check) => check.ok).length;
  return (
    <p className="mt-6 font-semibold">
      {passed} of {checks.length} checks pass
    </p>
  );
}

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="text-sm">
      {checks.map((check) => (
        <li
          key={check.label}
          className="grid grid-cols-[1.25rem_minmax(8rem,auto)_1fr] gap-3 border-t py-2 max-sm:grid-cols-[1.25rem_1fr]"
        >
          {check.ok ? (
            <CheckIcon
              className="mt-0.5 size-4 text-success-foreground"
              weight="bold"
              aria-label="Pass"
            />
          ) : (
            <XIcon
              className="mt-0.5 size-4 text-destructive-foreground"
              weight="bold"
              aria-label="Fail"
            />
          )}
          <code>{check.label}</code>
          <span className="wrap-anywhere text-muted-foreground max-sm:col-start-2">
            {check.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DefinitionList({ pairs }: { pairs: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] text-sm max-sm:grid-cols-1">
      {pairs.map(([name, value]) => (
        <Fragment key={`${name}: ${value}`}>
          <dt className="border-t py-2 pr-4 font-mono">{name}</dt>
          <dd className="wrap-anywhere border-t py-2 text-muted-foreground max-sm:border-t-0 max-sm:pt-0">
            {value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function File({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <pre
      className={cn(
        "max-h-96 overflow-auto whitespace-pre-wrap wrap-anywhere rounded-lg border bg-card px-4 py-3 font-mono text-xs leading-normal",
        className,
      )}
    >
      {children}
    </pre>
  );
}

export function Faq({
  tool,
  questions,
}: {
  tool: string;
  questions: [string, ReactNode][];
}) {
  return (
    <section className="mt-12">
      <h2 className="font-semibold">Questions</h2>
      <div className="mt-2 border-t text-sm">
        {questions.map(([question, answer]) => (
          <details
            key={question}
            className="group border-b"
            onToggle={(event) => {
              if (event.currentTarget.open) {
                track("FAQ open", { tool, question });
              }
            }}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-3 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {question}
              <CaretDownIcon className="size-4 shrink-0 translate-y-0.5 opacity-80 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-muted-foreground [&_a]:underline">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
