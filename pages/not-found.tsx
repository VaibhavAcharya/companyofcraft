import { Chip, Mark, Page } from "../lib/layout.tsx";

export default function NotFound() {
  return (
    <Page page="404">
      <main className="grid w-full max-w-2xl grid-cols-[auto_1fr] items-start gap-8 self-center justify-self-center text-lg sm:text-xl max-sm:grid-cols-1 max-sm:justify-items-center max-sm:gap-6 max-sm:text-center">
        <Mark className="block h-auto w-24" size={200} />
        <div>
          <h1 className="font-heading font-semibold text-2xl sm:text-3xl">
            <a className="hover:underline" href="/">
              Company of Craft
            </a>
          </h1>
          <p className="text-muted-foreground">This page does not exist.</p>
          <p className="mt-6">
            Go to the <Chip href="/">home page</Chip>.
          </p>
        </div>
      </main>
    </Page>
  );
}
