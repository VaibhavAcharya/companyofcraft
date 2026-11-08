import {
  AppWindowIcon,
  GlobeIcon,
  LinkSimpleIcon,
  RobotIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/ssr";
import { Badge } from "uiofcraft";
import { Mark, OutboundChip, Page } from "../lib/layout.tsx";

const TOOLS = [
  { href: "/og-preview", icon: LinkSimpleIcon, name: "Open Graph preview" },
  {
    href: "/security-headers",
    icon: ShieldCheckIcon,
    name: "Security headers",
  },
  { href: "/agent-readability", icon: RobotIcon, name: "Agent readability" },
  { href: "/favicon-checker", icon: AppWindowIcon, name: "Favicon checker" },
  { href: "/ip-lookup", icon: GlobeIcon, name: "IP lookup" },
];

export default function Home() {
  return (
    <Page page="home">
      <main className="grid w-full max-w-2xl grid-cols-[auto_1fr] items-start gap-8 self-center justify-self-center text-lg sm:text-xl max-sm:grid-cols-1 max-sm:justify-items-center max-sm:gap-6 max-sm:text-center">
        <Mark className="block h-auto w-24" size={200} />
        <div>
          <h1 className="font-heading font-semibold">
            <a className="hover:underline" href="/">
              Company of Craft
            </a>
          </h1>
          <p className="text-muted-foreground">Well-made software.</p>
          <p className="mt-6">
            We build{" "}
            <OutboundChip
              href="https://stateofpixel.com"
              icon="/logos/stateofpixel.svg"
              name="stateofpixel"
              page="home"
            >
              stateofpixel
            </OutboundChip>
            .
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm max-sm:justify-center">
            <span className="mr-1">Free tools</span>
            {TOOLS.map(({ href, icon: Icon, name }) => [
              " ",
              <Badge
                key={href}
                variant="outline"
                size="lg"
                render={<a href={href} />}
              >
                <Icon />
                {name}
              </Badge>,
            ])}
          </p>
        </div>
      </main>
    </Page>
  );
}
