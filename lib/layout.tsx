import type { ReactNode } from "react";
import { Badge, cn } from "uiofcraft";

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
  children,
}: {
  href: string;
  icon?: string;
  name: string;
  page: string;
  children: ReactNode;
}) {
  const newTab = href.startsWith("https://");
  return (
    <Badge
      className="align-baseline"
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
  children,
}: {
  page: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh grid-rows-[1fr_auto] px-5 pt-12 pb-5">
      {children}
      <footer className="flex w-full max-w-2xl flex-wrap items-end justify-between gap-x-6 gap-y-2 justify-self-center pt-12 text-muted-foreground text-sm max-sm:flex-col max-sm:items-center max-sm:gap-4 max-sm:text-center">
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
  children,
}: {
  page: string;
  title: string;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <Page page={page}>
      <main className="w-full max-w-2xl self-start justify-self-center">
        <header>
          <nav>
            <a
              className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
              href="/"
            >
              <Mark className="block size-6" size={24} />
              Company of Craft
            </a>
          </nav>
          <h1 className="mt-8 font-heading font-semibold text-2xl">{title}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{tagline}</p>
        </header>
        {children}
      </main>
    </Page>
  );
}

export function About({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "mt-12 space-y-3 text-muted-foreground text-sm [&_p_a:not([data-slot])]:underline",
        className,
      )}
    >
      <h2 className="font-semibold text-base text-foreground">{title}</h2>
      {children}
    </section>
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
