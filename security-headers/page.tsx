import { ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import { About, AlsoBuilds, ToolPage } from "../lib/layout.tsx";
import {
  type Check,
  CheckList,
  Columns,
  DefinitionList,
  Empty,
  Faq,
  Fetched,
  Heading,
  LookupForm,
  LookupStatus,
  Summary,
  useLookup,
} from "../lib/tool.tsx";

type Report = {
  url: string;
  status: number;
  headers: [string, string][];
  policy: [string, string][];
  checks: Check[];
};

const TOOL = "security-headers";

export default function SecurityHeaders() {
  const lookup = useLookup<Report>(
    TOOL,
    "Too many checks. Try again in a minute.",
  );
  return (
    <ToolPage
      page={TOOL}
      title="Security headers checker"
      tagline="Check the Content-Security-Policy and security headers of any page."
      frame="Check a page"
      note="Fetched from our server. Nothing is stored."
      tool={
        <>
          <LookupForm
            action={`/${TOOL}`}
            name="url"
            label="Link"
            button="Check"
            query={lookup.query}
            icon={<ShieldCheckIcon />}
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
            "What do security headers do?",
            "They are HTTP response headers that tell the browser what a page may do: where scripts can load from, whether other sites can put it in a frame, and whether to always use HTTPS. They protect visitors from attacks like cross-site scripting and clickjacking.",
          ],
          [
            "What is a good first Content-Security-Policy?",
            <>
              Start with{" "}
              <code>
                default-src 'self'; object-src 'none'; base-uri 'none';
                frame-ancestors 'none'
              </code>{" "}
              and add the hosts your page loads from. Send it as{" "}
              <code>Content-Security-Policy-Report-Only</code> first, check the
              browser console for blocked requests, then switch to{" "}
              <code>Content-Security-Policy</code>.
            </>,
          ],
          [
            "Why is 'unsafe-inline' a problem?",
            <>
              It lets every inline script run, including one an attacker
              injects. Give the inline scripts you need a nonce or a hash
              instead. When a nonce or a hash is in <code>script-src</code>,
              browsers ignore <code>'unsafe-inline'</code>.
            </>,
          ],
          [
            "Does a Content-Security-Policy in a meta tag work?",
            <>
              Most of it does. Browsers ignore <code>frame-ancestors</code>,{" "}
              <code>report-uri</code> and <code>sandbox</code> in a meta tag, so
              send those in the header.
            </>,
          ],
          [
            "Are the links I check saved?",
            "No. The page is fetched when you press Check, and nothing is stored.",
          ],
        ]}
      />
      <About title="How it works">
        <p>
          The page at the link is fetched from our server, once at its address
          and once over <code>http://</code> to see if it redirects to HTTPS.
          The checks read the response headers and any Content-Security-Policy
          in a <code>{"<meta>"}</code> tag. When both are set, the browser
          applies both, so the checks read them together.
        </p>
        <p>
          The checks cover the headers most sites need. A page can pass all of
          them and still have other security problems.
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
          <Heading>Content-Security-Policy</Heading>
          {report.policy.length === 0 ? (
            <Empty>No Content-Security-Policy on this page.</Empty>
          ) : (
            <DefinitionList pairs={report.policy} />
          )}
          <Heading>Response headers</Heading>
          <DefinitionList pairs={report.headers} />
        </div>
      </Columns>
    </div>
  );
}
