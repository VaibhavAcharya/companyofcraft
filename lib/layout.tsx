import {
  AppWindowIcon,
  ArrowRightIcon,
  GlobeIcon,
  LinkSimpleIcon,
  RobotIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
  cn,
} from "uiofcraft";

export const TOOLS = [
  {
    page: "og-preview",
    icon: LinkSimpleIcon,
    name: "Open Graph preview",
    summary: "See how a link looks on X, LinkedIn, Slack and Discord.",
  },
  {
    page: "security-headers",
    icon: ShieldCheckIcon,
    name: "Security headers",
    summary: "Check the Content-Security-Policy and headers of any page.",
  },
  {
    page: "agent-readability",
    icon: RobotIcon,
    name: "Agent readability",
    summary: "Check if AI agents and crawlers can read a page.",
  },
  {
    page: "favicon-checker",
    icon: AppWindowIcon,
    name: "Favicon checker",
    summary: "Check the favicon, apple-touch-icon and web manifest.",
  },
  {
    page: "ip-lookup",
    icon: GlobeIcon,
    name: "IP lookup",
    summary: "Country, city, network, VPN and bot checks for any IP.",
  },
];

export function Mark({ className, size }: { className: string; size: number }) {
  return (
    <picture>
      <source
        srcSet="/logos/mark-dark.svg"
        media="(prefers-color-scheme: dark)"
      />
      <img
        className={className}
        src="/logos/mark.svg"
        alt=""
        width={size}
        height={size}
      />
    </picture>
  );
}

export function Chip({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      className="align-baseline"
      variant="secondary"
      size="lg"
      render={<a href={href} />}
    >
      {icon && <img className="size-3.5" src={icon} alt="" />}
      {children}
    </Badge>
  );
}

export function OutboundChip({
  href,
  icon,
  name,
  page,
  className,
  children,
}: {
  href: string;
  icon?: string;
  name: string;
  page: string;
  className?: string;
  children: ReactNode;
}) {
  const newTab = href.startsWith("https://");
  return (
    <Badge
      className={cn("align-baseline", className)}
      variant="secondary"
      size="lg"
      render={
        <a
          href={href}
          data-umami-event="Outbound link"
          data-umami-event-target={name}
          data-umami-event-page={page}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener" : undefined}
        />
      }
    >
      {icon && <img className="size-3.5" src={icon} alt="" />}
      {children}
    </Badge>
  );
}

export function Page({
  page,
  wide = false,
  children,
}: {
  page: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh grid-rows-[1fr_auto] px-5 pt-12 pb-5">
      {children}
      <footer
        className={cn(
          "flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2 justify-self-center pt-12 text-muted-foreground text-sm max-sm:flex-col max-sm:items-center max-sm:gap-4 max-sm:text-center",
          wide ? "mt-24 max-w-6xl border-t" : "max-w-2xl",
        )}
      >
        <div className="space-y-1.5">
          <p>
            Founded by{" "}
            <OutboundChip
              href="https://vaibhavacharya.com"
              icon="/logos/vaibhavacharya.svg"
              name="vaibhavacharya"
              page={page}
            >
              Vaibhav Acharya
            </OutboundChip>
          </p>
          <p>&copy; 2026 Company of Craft</p>
        </div>
        <div className="space-y-1.5 text-right max-sm:order-first max-sm:text-center">
          <p>
            <OutboundChip
              href="https://x.com/CompanyofCraft"
              icon="/logos/x.svg"
              name="x"
              page={page}
            >
              @CompanyofCraft
            </OutboundChip>
          </p>
          <p>
            <OutboundChip
              href="mailto:hello@companyofcraft.com"
              name="email"
              page={page}
            >
              hello@companyofcraft.com
            </OutboundChip>
          </p>
        </div>
      </footer>
    </div>
  );
}

export function ToolPage({
  page,
  title,
  tagline,
  frame,
  note,
  tool,
  children,
}: {
  page: string;
  title: string;
  tagline: string;
  frame: string;
  note: string;
  tool: ReactNode;
  children: ReactNode;
}) {
  return (
    <Page page={page} wide>
      <main className="w-full max-w-6xl self-start justify-self-center">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="inline-flex items-center gap-2"
                href="/"
              >
                <Mark className="block size-5" size={20} />
                Company of Craft
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-[1fr_24rem] lg:items-end lg:gap-16">
          <h1 className="text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="text-lg text-muted-foreground lg:text-xl">{tagline}</p>
        </header>
        <CardFrame className="mt-10 lg:mt-14">
          <CardFrameHeader className="py-3">
            <CardFrameTitle className="whitespace-nowrap">
              {frame}
            </CardFrameTitle>
            <CardFrameAction>
              <span className="text-right text-muted-foreground text-xs">
                {note}
              </span>
            </CardFrameAction>
          </CardFrameHeader>
          <Card>
            <CardPanel className="p-5 sm:p-6">{tool}</CardPanel>
          </Card>
        </CardFrame>
        {children}
        <OtherTools page={page} />
      </main>
    </Page>
  );
}

export function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-16 grid gap-4 border-t pt-10 lg:mt-24 lg:grid-cols-[20rem_1fr] lg:gap-16">
      <h2 className="font-heading font-semibold text-2xl tracking-tight lg:text-3xl">
        {title}
      </h2>
      <div className={cn("min-w-0", className)}>{children}</div>
    </section>
  );
}

export function About({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Section
      title={title}
      className="max-w-2xl space-y-4 text-muted-foreground [&_p_a:not([data-slot])]:underline"
    >
      {children}
    </Section>
  );
}

function OtherTools({ page }: { page: string }) {
  return (
    <Section title="Other tools">
      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.filter((tool) => tool.page !== page).map(
          ({ page: other, icon: Icon, name, summary }) => [
            " ",
            <Card
              key={other}
              className="group p-4 transition-colors hover:bg-accent"
              render={<a href={`/${other}`} />}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-muted-foreground" />
                {name}
                <span className="sr-only">:</span>
                <ArrowRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>{" "}
              <span className="mt-1 text-muted-foreground text-sm">
                {summary}
              </span>
            </Card>,
          ],
        )}
      </div>
    </Section>
  );
}

export function AlsoBuilds({ page }: { page: string }) {
  return (
    <p>
      Company of Craft also builds{" "}
      <OutboundChip
        href="https://stateofpixel.com"
        icon="/logos/stateofpixel.svg"
        name="stateofpixel"
        page={page}
      >
        stateofpixel
      </OutboundChip>
      , which catches UI regressions before they merge.
    </p>
  );
}
