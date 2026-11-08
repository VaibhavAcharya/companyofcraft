import { RobotIcon } from "@phosphor-icons/react/ssr";
import { About, AlsoBuilds, ToolPage } from "../lib/layout.tsx";
import {
  type Check,
  CheckList,
  Columns,
  Empty,
  Faq,
  Fetched,
  File,
  Heading,
  LookupForm,
  LookupStatus,
  Summary,
  useLookup,
} from "../lib/tool.tsx";

type Report = {
  url: string;
  status: number;
  crawlers: { name: string; owner: string; allowed: boolean }[];
  llmsTxt: string | null;
  checks: Check[];
};

const TOOL = "agent-readability";

export default function AgentReadability() {
  const lookup = useLookup<Report>(
    TOOL,
    "Too many checks. Try again in a minute.",
  );
  return (
    <ToolPage
      page={TOOL}
      title="Agent readability checker"
      tagline="Check if AI agents and crawlers can find and read a page."
      frame="Check a page"
      note="Fetched without running scripts. Nothing is stored."
      tool={
        <>
          <LookupForm
            action={`/${TOOL}`}
            name="url"
            label="Link"
            button="Check"
            query={lookup.query}
            icon={<RobotIcon />}
            placeholder="example.com"
            inputMode="url"
            autoComplete="url"
            required
          />
          <LookupStatus
            lookup={lookup}
            action={`/${TOOL}`}
            name="url"
            examples={["stateofpixel.com", "github.com", "netlify.com"]}
          />
          {lookup.result && <Results report={lookup.result} />}
        </>
      }
    >
      <Faq
        tool={TOOL}
        questions={[
          [
            "What is llms.txt?",
            <>
              A Markdown file at <code>/llms.txt</code> that lists the important
              pages of a site with a short summary of each. It was proposed at{" "}
              <a href="https://llmstxt.org" target="_blank" rel="noopener">
                llmstxt.org
              </a>
              . Agents read it to find the right page without crawling the whole
              site.
            </>,
          ],
          [
            "How do I block or allow an AI crawler?",
            <>
              Add a <code>User-agent</code> group for the crawler in{" "}
              <code>robots.txt</code>, with <code>Disallow: /</code> to block it
              or <code>Allow: /</code> to allow it. Crawlers that collect
              training data, like GPTBot and ClaudeBot, are separate from the
              ones that fetch a page when a person asks, like ChatGPT-User and
              Claude-User, so you can block one and allow the other.
            </>,
          ],
          [
            "Why serve a Markdown version of a page?",
            <>
              An HTML page carries navigation, scripts and styles, and an agent
              pays for all of it in tokens. A Markdown copy has only the
              content. Serve it at the same path with <code>.md</code> at the
              end, link it with{" "}
              <code>{'<link rel="alternate" type="text/markdown">'}</code>, or
              return it when the request has <code>Accept: text/markdown</code>.
            </>,
          ],
          [
            "Do AI crawlers run JavaScript?",
            "Many do not. If scripts add the text of a page, those crawlers see an empty page. Render the text on the server or at build time.",
          ],
          [
            "Are the links I check saved?",
            "No. The page and its files are fetched when you press Check, and nothing is stored.",
          ],
        ]}
      />
      <About title="How it works">
        <p>
          The page at the link is fetched from our server without running its
          scripts, the way crawlers that do not run JavaScript see it. Then{" "}
          <code>robots.txt</code>, <code>llms.txt</code>,{" "}
          <code>llms-full.txt</code>, the sitemap and the Markdown version of
          the page are fetched from the same site.
        </p>
        <p>
          The crawler list reads the <code>robots.txt</code> rules for each
          crawler and the path of the page. Some sites also block crawlers at
          the firewall, which this check cannot see.
        </p>
        <AlsoBuilds page={TOOL} />
      </About>
    </ToolPage>
  );
}

function Results({ report }: { report: Report }) {
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Summary checks={report.checks} />
        <Fetched tool={TOOL} status={report.status} url={report.url} />
      </div>
      <Columns>
        <div>
          <Heading>Checks</Heading>
          <CheckList checks={report.checks} />
        </div>
        <div>
          <Heading>AI crawlers</Heading>
          <CheckList
            checks={report.crawlers.map((crawler) => ({
              ok: crawler.allowed,
              label: crawler.name,
              detail: `${crawler.allowed ? "Allowed" : "Blocked"}. ${crawler.owner}`,
            }))}
          />
        </div>
      </Columns>
      <Heading>llms.txt</Heading>
      {report.llmsTxt === null ? (
        <Empty>No llms.txt on this site.</Empty>
      ) : (
        <File>{report.llmsTxt}</File>
      )}
    </div>
  );
}
