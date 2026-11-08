import { LinkSimpleIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";
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

type Preview = {
  url: string;
  status: number;
  domain: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  imageAlt?: string;
  card?: string;
  themeColor?: string;
  favicon: string;
  tags: [string, string][];
  checks: Check[];
};

const TOOL = "og-preview";

export default function OgPreview() {
  const lookup = useLookup<Preview>(
    TOOL,
    "Too many previews. Try again in a minute.",
  );
  return (
    <ToolPage
      page={TOOL}
      title="Open Graph preview"
      tagline="See how a link looks when you share it on X, LinkedIn, Slack and Discord."
      frame="Preview a link"
      note="Fetched from our server. Nothing is stored."
      tool={
        <>
          <LookupForm
            action={`/${TOOL}`}
            name="url"
            label="Link"
            button="Preview"
            query={lookup.query}
            icon={<LinkSimpleIcon />}
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
          {lookup.result && <Results preview={lookup.result} />}
        </>
      }
    >
      <Faq
        tool={TOOL}
        questions={[
          [
            "What are Open Graph tags?",
            "Meta tags in the head of a page, like og:title, og:description, og:image and og:url. Chat apps and social networks read them to build the preview card when someone shares the link. X also reads twitter: tags and uses the og: tags when they are missing.",
          ],
          [
            "Why does my link still show the old preview?",
            "Platforms cache a preview after the first time someone shares a link. LinkedIn has a Post Inspector that fetches the page again. The others update when their cache expires.",
          ],
          [
            "What size should the og:image be?",
            "1200x630 pixels is the common size. It has the 1.91:1 shape of the large cards on X and LinkedIn, so nothing gets cropped. Keep the file under 5 MB.",
          ],
          [
            "Why does my image not show up?",
            "Check that og:image is a full URL that starts with https://, that the image loads without signing in, and that the server sends it with an image content type. The checks above test the last two.",
          ],
          [
            "Are the links I check saved?",
            "No. The page and its image are fetched when you press Preview, and nothing is stored.",
          ],
        ]}
      />
      <About title="How it works">
        <p>
          The page at the link is fetched from our server, the same way a chat
          app or social network does when someone pastes a link. It reads the{" "}
          <code>og:</code> and <code>twitter:</code> tags, falls back to the
          page title and description like the platforms do, and checks that the
          image loads.
        </p>
        <p>
          The previews are close to what each platform shows, but each one can
          change its layout or cache an older version of the page.
        </p>
        <AlsoBuilds page={TOOL} />
      </About>
    </ToolPage>
  );
}

function Image({
  preview,
  className,
}: {
  preview: Preview;
  className: string;
}) {
  if (!preview.image) {
    return null;
  }
  return (
    <img
      className={className}
      src={preview.image}
      alt={preview.imageAlt ?? ""}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function Text({
  className,
  value,
}: {
  className: string;
  value: string | undefined;
}) {
  return value ? <p className={className}>{value}</p> : null;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="preview min-w-0 rounded-xl border bg-muted/40 p-4 sm:p-5">
      <figcaption className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </figcaption>
      {children}
    </figure>
  );
}

function Favicon({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return null;
  }
  return (
    <img
      className="favicon"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function Results({ preview }: { preview: Preview }) {
  const title = preview.title ?? preview.domain;
  const site = preview.siteName ?? preview.domain;
  const large = preview.card !== "summary";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Summary checks={preview.checks} />
        <Fetched tool={TOOL} status={preview.status} url={preview.url} />
      </div>
      <div className="previews mt-6 grid gap-4 lg:grid-cols-2">
        <Figure label="X">
          <div>
            <div className={`x ${large ? "x-large" : "x-small"}`}>
              <div className="x-media">
                <Image preview={preview} className="x-image" />
                {large && <span className="x-title">{title}</span>}
              </div>
              {!large && (
                <div className="x-body">
                  <Text className="x-domain" value={preview.domain} />
                  <Text className="x-name" value={title} />
                  <Text className="x-description" value={preview.description} />
                </div>
              )}
            </div>
            <p className="x-from">From {preview.domain}</p>
          </div>
        </Figure>
        <Figure label="LinkedIn">
          <div className="linkedin">
            <Image preview={preview} className="linkedin-image" />
            <div className="linkedin-body">
              <Text className="linkedin-title" value={title} />
              <Text className="linkedin-domain" value={preview.domain} />
            </div>
          </div>
        </Figure>
        <Figure label="Slack">
          <div className="slack">
            <p className="slack-site">
              <Favicon src={preview.favicon} />
              {site}
            </p>
            <Text className="slack-title" value={title} />
            <Text className="slack-description" value={preview.description} />
            <Image preview={preview} className="slack-image" />
          </div>
        </Figure>
        <Figure label="Discord">
          <div
            className="discord"
            style={
              preview.themeColor
                ? { borderLeftColor: preview.themeColor }
                : undefined
            }
          >
            <Text className="discord-site" value={site} />
            <Text className="discord-title" value={title} />
            <Text className="discord-description" value={preview.description} />
            <Image preview={preview} className="discord-image" />
          </div>
        </Figure>
      </div>
      <Columns>
        <div>
          <Heading>Checks</Heading>
          <CheckList checks={preview.checks} />
        </div>
        <div>
          <Heading>Tags</Heading>
          {preview.tags.length === 0 ? (
            <Empty>No og: or twitter: tags on this page.</Empty>
          ) : (
            <DefinitionList pairs={preview.tags} />
          )}
        </div>
      </Columns>
    </div>
  );
}
