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

## The site

Plain HTML and CSS built with [Vite](https://vite.dev). The page ships no JavaScript.

| Path | What it is |
|---|---|
| `index.html` | The site |
| `404.html` | Served by Netlify for unknown paths |
| `styles/main.css` | All styles. IBM Plex Sans comes from `@fontsource-variable/ibm-plex-sans`, the same font as stateofpixel |
| `public/logos` | `mark.svg` (black on white, also the favicon), `mark-dark.svg` (white on black), PNG exports, logos of linked sites |
| `public` | `robots.txt`, `llms.txt`, `favicon.ico` and `.well-known/security.txt`, served from the site root |
| `scripts/postbuild.ts` | Writes the Open Graph image to `dist/og/index.png`, the X banner to `dist/og/x-banner.png` and `dist/sitemap.xml`, with `lastmod` from git |
| `vite.config.ts` | Build inputs and the page Content Security Policy |
| `netlify.toml` | Build settings and security headers |

## Development

```sh
pnpm install
pnpm dev      # Vite dev server on localhost:5173
pnpm build    # dist/, then the Open Graph image and sitemap
pnpm lint     # Biome
```

The Content Security Policy for pages is added to the built HTML as a `<meta>` tag by `vite.config.ts`, so it covers pages only and not files like `sitemap.xml`. `netlify.toml` sends `frame-ancestors`, which only works as a header. To check the built site with its headers, run `pnpm build` and then `netlify serve`.

## Maintenance

- `Expires` in `public/.well-known/security.txt` is 2027-10-12. Move it forward before then.
