import { Badge } from "uiofcraft";
import { Mark, OutboundChip, Page, TOOLS } from "../lib/layout.tsx";

export default function Home() {
  return (
    <Page page="home">
      <main className="grid w-full max-w-2xl grid-cols-[auto_1fr] items-start gap-8 self-center justify-self-center text-lg sm:text-xl max-sm:grid-cols-1 max-sm:justify-items-center max-sm:gap-6 max-sm:text-center">
        <Mark className="block h-auto w-24" size={200} />
        <div>
          <h1 className="font-heading font-semibold text-2xl sm:text-3xl">
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
              className="h-auto px-2 py-0.5 text-lg sm:h-auto sm:px-2 sm:text-xl [&_img]:size-4.5"
            >
              stateofpixel
            </OutboundChip>
            .
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm max-sm:justify-center">
            <span className="mr-1">Free tools</span>
            {TOOLS.map(({ page, icon: Icon, name }) => [
              " ",
              <Badge
                key={page}
                variant="outline"
                size="lg"
                render={<a href={`/${page}`} />}
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
