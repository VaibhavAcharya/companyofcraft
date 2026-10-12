# companyofcraft

Website for Company of Craft, the software company behind [stateofpixel](https://stateofpixel.com). Served at [companyofcraft.com](https://companyofcraft.com) from Netlify.

Plain HTML and CSS built with [Vite](https://vite.dev). The page ships no JavaScript.

| Path | What it is |
|---|---|
| `index.html` | The site |
| `404.html` | Served by Netlify for unknown paths |
| `styles/main.css` | All styles. IBM Plex Sans comes from `@fontsource-variable/ibm-plex-sans`, the same font as stateofpixel |
| `public/logos` | `mark.svg` (black on white, also the favicon), `mark-dark.svg` (white on black), PNG exports, logos of linked sites |
| `public` | `robots.txt`, `llms.txt`, `favicon.ico` and `.well-known/security.txt`, served from the site root |
| `scripts/postbuild.ts` | Writes the Open Graph image to `dist/og/index.png` and `dist/sitemap.xml`, with `lastmod` from git |
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
