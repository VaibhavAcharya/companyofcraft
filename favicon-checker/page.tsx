import type { ReactNode } from "react";
import { About, AlsoBuilds, ToolPage } from "../lib/layout.tsx";
import {
  type Check,
  CheckList,
  DefinitionList,
  Empty,
  Faq,
  Fetched,
  Heading,
  LookupForm,
  Status,
  Summary,
  useLookup,
} from "../lib/tool.tsx";

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

const TOOL = "favicon-checker";

export default function FaviconChecker() {
  const { query, status, result } = useLookup<Report>(
    TOOL,
    "Too many checks. Try again in a minute.",
  );
  return (
    <ToolPage
      page={TOOL}
      title="Favicon checker"
      tagline="Check the favicon, apple-touch-icon and web manifest of any page."
    >
      <LookupForm
        action={`/${TOOL}`}
        name="url"
        label="Link"
        button="Check"
        query={query}
        placeholder="example.com"
        inputMode="url"
        autoComplete="url"
        required
      />
      <Status>{status}</Status>
      {result && <Results report={result} />}
      <Faq
        tool={TOOL}
        questions={[
          [
            "Which icon files does a site need?",
            <>
              A <code>/favicon.ico</code> for older browsers and tools, an SVG
              or 32x32 PNG linked with <code>rel="icon"</code>, a 180x180{" "}
              <code>apple-touch-icon</code> for iOS, and a web manifest with
              192x192 and 512x512 PNG icons for Android and installed apps.
            </>,
          ],
          [
            "Why does my old favicon still show?",
            <>
              Browsers cache favicons apart from the page and keep them for a
              long time. Change the file name, or add a query string to the{" "}
              <code>href</code>, so browsers fetch the new file.
            </>,
          ],
          [
            "What is a maskable icon?",
            <>
              An icon with room around the logo, marked{" "}
              <code>"purpose": "maskable"</code> in the web manifest. Android
              crops it to the shape the device uses, like a circle or a rounded
              square. Keep the logo inside the center 80% of the image.
            </>,
          ],
          [
            "Where does iOS get the home screen icon?",
            <>
              From the <code>apple-touch-icon</code> link. When the page links
              none, Safari asks for <code>/apple-touch-icon.png</code> at the
              root of the site. Use a 180x180 PNG.
            </>,
          ],
          [
            "Are the links I check saved?",
            "No. The page, its icons and its manifest are fetched when you press Check, and nothing is stored.",
          ],
        ]}
      />
      <About title="How it works">
        <p>
          The page at the link is fetched from our server. The checks read its
          icon and manifest links, then load each icon,{" "}
          <code>/favicon.ico</code> and the manifest to see that they work.
          Sizes come from the image files, not from the <code>sizes</code>{" "}
          attribute.
        </p>
        <p>
          The tab and home screen are close to what browsers show, but each
          browser picks between icons in its own way.
        </p>
        <AlsoBuilds page={TOOL} />
      </About>
    </ToolPage>
  );
}

function Image({ icon, className }: { icon?: Icon; className: string }) {
  if (!icon) {
    return <span className={`${className} icon-missing`} />;
  }
  return (
    <img
      className={className}
      src={icon.href}
      alt=""
      referrerPolicy="no-referrer"
    />
  );
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

function Tab({ report, theme }: { report: Report; theme: string }) {
  return (
    <div className={`tab tab-${theme}`}>
      <Image icon={tabIcon(report.icons)} className="tab-icon" />
      <span className="tab-title">{report.title}</span>
    </div>
  );
}

function IconFigure({ icon }: { icon: Icon }) {
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
  return (
    <figure className={icon.loads ? "icon" : "icon icon-broken"}>
      <div className="icon-frame">
        {icon.loads && <Image icon={icon} className="icon-image" />}
      </div>
      <figcaption>
        <code>
          {icon.source === "manifest" ? `manifest ${path}` : icon.source}
        </code>
        <span>{facts.join(", ")}</span>
      </figcaption>
    </figure>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure>
      <figcaption className="mb-2 text-muted-foreground text-sm">
        {label}
      </figcaption>
      {children}
    </figure>
  );
}

function Results({ report }: { report: Report }) {
  return (
    <div>
      <Fetched tool={TOOL} status={report.status} url={report.url} />
      <div className="mt-6 grid gap-8">
        <Figure label="Browser tab">
          <div className="tabs">
            <Tab report={report} theme="light" />
            <Tab report={report} theme="dark" />
          </div>
        </Figure>
        <Figure label="Home screen">
          <div className="homescreen">
            <Image
              icon={homeScreenIcon(report.icons)}
              className="homescreen-icon"
            />
            <span className="homescreen-label">
              {report.appTitle ?? report.title}
            </span>
          </div>
        </Figure>
      </div>
      <Summary checks={report.checks} />
      <Heading>Checks</Heading>
      <CheckList checks={report.checks} />
      <Heading>Icons</Heading>
      {report.icons.length === 0 ? (
        <Empty>No icons found.</Empty>
      ) : (
        <div className="icons">
          {report.icons.map((icon) => (
            <IconFigure key={`${icon.source} ${icon.href}`} icon={icon} />
          ))}
        </div>
      )}
      <Heading>Web manifest</Heading>
      {report.manifest.length === 0 ? (
        <Empty>No web manifest on this page.</Empty>
      ) : (
        <DefinitionList pairs={report.manifest} />
      )}
    </div>
  );
}
