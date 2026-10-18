<p align="center">
  <a href="https://companyofcraft.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/logos/mark-dark.svg">
      <img alt="Company of Craft" src="public/logos/mark.svg" height="120">
    </picture>
  </a>
</p>

<h1 align="center">Company of Craft</h1>

<p align="center">Well-made software.</p>

<p align="center">
  <a href="https://companyofcraft.com">Website</a> |
  <a href="https://stateofpixel.com">stateofpixel</a> |
  <a href="mailto:hello@companyofcraft.com">hello@companyofcraft.com</a> |
  <a href="https://x.com/CompanyofCraft">@CompanyofCraft</a>
</p>

<p align="center">
  <a href="https://app.netlify.com/projects/companyofcraft/deploys"><img alt="Netlify status" src="https://api.netlify.com/api/v1/badges/7d15c80e-ba14-4b43-abda-a96b8a994603/deploy-status"></a>
</p>

Company of Craft builds [stateofpixel](https://stateofpixel.com). Founded by [Vaibhav Acharya](https://vaibhavacharya.com). This repository is the website at [companyofcraft.com](https://companyofcraft.com), served from Netlify.

## Products

| | Product | What it does |
|---|---|---|
| <img src="public/logos/stateofpixel.svg" alt="" width="24"> | [stateofpixel](https://stateofpixel.com) | Catches UI regressions before they merge. [Source](https://github.com/VaibhavAcharya/stateofpixel) |

## Small free tools

| Tool | What it does |
|---|---|
| [Open Graph preview](https://companyofcraft.com/og-preview/) | Shows how a link looks on X, LinkedIn, Slack and Discord, and checks its Open Graph and Twitter tags |

## The site

Plain HTML and CSS built with [Vite](https://vite.dev). The home page ships no JavaScript. The Open Graph preview page loads one script.

| Path | What it is |
|---|---|
| `index.html` | The site |
| `404.html` | Served by Netlify for unknown paths |
| `og-preview/index.html`, `og-preview/main.ts`, `styles/og-preview.css` | The Open Graph preview tool. The script reads `?url=` and calls `/api/og-preview` |
| `netlify/functions/og-preview.ts` | Public API at `/api/og-preview?url=` that fetches a page and returns its tags, the preview fields and the checks. It refuses private addresses, follows up to 5 redirects and is rate limited to 30 requests a minute per IP |
| `styles/main.css` | All styles. IBM Plex Sans comes from `@fontsource-variable/ibm-plex-sans`, the same font as stateofpixel |
| `public/logos` | `mark.svg` (black on white, also the favicon), `mark-dark.svg` (white on black), PNG exports, logos of linked sites |
| `public` | `robots.txt`, `llms.txt`, `favicon.ico` and `.well-known/security.txt`, served from the site root |
| `scripts/postbuild.ts` | Writes an Open Graph image per page to `dist/og/`, the X banner to `dist/og/x-banner.png`, a Markdown copy of each page (`dist/index.md`, `dist/og-preview.md`) and `dist/sitemap.xml`, with `lastmod` from git |
| `scripts/markdown.ts` | Turns the `<main>` of a page into Markdown. Used by the build and by `pnpm dev`, which serves the same `.md` paths |
| `vite.config.ts` | Build inputs and the page Content Security Policy |
| `netlify.toml` | Build settings and security headers |
| `netlify/functions/notify.ts` | Private API at `/api/notify` that sends Telegram notifications |
| `visual/home.visual.ts`, `playwright.config.ts` | Screenshots of the page, light and dark at 1280px and 375px, for [stateofpixel](https://stateofpixel.com) |
| `.github/workflows/visual.yml` | Takes the screenshots on pushes to `main` and on pull requests, and uploads them to stateofpixel |

## Notify API

Projects call `POST /api/notify` to send a Telegram message. Requests need `Authorization: Bearer $NOTIFY_API_KEY`.

```sh
curl -X POST https://companyofcraft.com/api/notify \
  -H "Authorization: Bearer $NOTIFY_API_KEY" \
  -d '{"project":"stateofpixel","title":"New signup","message":"someone@example.com","link":"https://stateofpixel.com"}'
```

`project` and `message` are required. `title` and `link` are optional. The same message from the same project is dropped for 10 minutes (`deduped`), and each project can send 30 messages per hour (`429`). `GET /api/notify?limit=50` returns the latest sent notifications, newest first. State lives in the `notify` Netlify Blobs store.

Environment variables: `NOTIFY_API_KEY`, `TELEGRAM_BOT_TOKEN` (from @BotFather) and `TELEGRAM_CHAT_ID` (your chat with the bot).

## Development

```sh
pnpm install
pnpm dev      # Vite dev server on localhost:5173
pnpm build    # dist/, then the Open Graph image and sitemap
pnpm lint     # Biome
pnpm visual   # Screenshots to stateofpixel-screenshots/, uploaded on CI only
```

The Content Security Policy for pages is added to the built HTML as a `<meta>` tag by `vite.config.ts`, so it covers pages only and not files like `sitemap.xml`. `netlify.toml` sends `frame-ancestors`, which only works as a header. To check the built site with its headers, run `pnpm build` and then `netlify serve`.

## Maintenance

- `Expires` in `public/.well-known/security.txt` is 2027-10-12. Move it forward before then.
