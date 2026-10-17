# CLAUDE.md — Static Site Template Rules

## Always Do First
1. **Check dependencies**: if `node_modules/` does not exist, run `npm install` before anything else.
   - If screenshot fails with a library error, system deps are missing — see `.devcontainer/install-deps.sh` (requires root; normally run automatically on container creation via `postCreateCommand`).
2. **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
3. **Determine the mode** (see below). If I haven't said, ask: "Mockup or production?"

## Modes
- **Mockup mode** — triggered when I say "mockup" or "pitch". Goal: impress a prospect fast.
  - May be a single page
  - May use Tailwind Play CDN and placehold.co images
  - Performance, SEO audit, and llms.txt rules do not apply
  - Never deployed to the client's production domain
- **Production mode** — the default for everything else. ALL rules in this file apply.

## Rule Precedence (when rules conflict)
1. Hard Rules and "Never Invent Facts"
2. Reference image (if provided)
3. Mobile Optimization and Accessibility
4. Performance Budget and SEO Audit Rules
5. Anti-Generic Guardrails (apply only when designing from scratch)

## Never Invent Facts
- Never fabricate testimonials, reviews, ratings, credentials, certifications, awards,
  statistics, years in business, prices, hours, or contact details
- Never make health, legal, or financial outcome claims the client hasn't provided
- Use clearly marked placeholders: `[CLIENT TO PROVIDE: hours]`
- At the end of every session, list every remaining placeholder

## Brand Assets
- Always check `brand_assets/` before designing
- If a logo exists, use it — never a placeholder
- If a color palette is defined, use those exact hex values — do not invent brand colors
- If `brand_assets/` is empty: ask whether to pull logo/colors from the client's existing
  site before inventing a palette
- Verify brand colors meet WCAG AA contrast for text; if they don't, use them for accents
  only and tell me

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly
- A reference overrides the Anti-Generic Guardrails
- If no reference: design from scratch using brand assets and guardrails below
- Screenshot your output, compare against reference, fix mismatches, re-screenshot
- Minimum 2 comparison rounds, maximum 5 — then report any remaining differences
  instead of continuing

## Site Data (single source of truth)
- All business facts live in `src/_data/site.json`: name, address, phone, email, hours,
  service area, services (name, slug, one-line summary), social links, canonical domain
- Footer, contact page, JSON-LD, sitemap, and llms.txt are ALL generated from site.json
- Never hardcode NAP (name/address/phone) or hours in page HTML
- NAP must match the client's Google Business Profile exactly

## Site Structure (production default: multi-page)
- Default page set: Home, About, Services, Contact, 404. Add a Privacy page if the site
  has forms or analytics. Confirm the page list with me before building; don't add pages
  beyond this set unless requested
- Clean URLs via folders: `src/about/index.html` → `/about/`
- All internal links are root-relative with trailing slash (`/about/`), never relative
  (`../about.html`) and never without the slash (`/about`)

```
src/
  _data/site.json     business facts (single source of truth), incl. nav and canonical url
  _partials/          layout.html, head.html, header.html, footer.html — shared, never duplicated
  _headers            response headers, copied to dist/ (noindex for workers.dev, asset caching)
  styles.css          Tailwind entry + brand tokens (@theme)
  index.html
  about/index.html
  services/index.html
  contact/index.html
  404.html
  assets/             images, fonts, favicon set, og-image.jpg
lib/site.mjs          generators shared by build.mjs and audit.mjs (JSON-LD, llms.txt, sitemap)
worker/index.js       Worker for /api/* only (form handlers)
dist/                 build output — gitignored, this is what gets deployed
```

- `node build.mjs` assembles pages from partials into `dist/`, compiles + minifies
  Tailwind, generates sitemap.xml, robots.txt, and llms.txt
- Never hand-edit files in `dist/`
- Header/footer/nav/head changes happen ONLY in `_partials/`
- Each page file is front matter + the `<main>` content. Titles/descriptions are set here,
  never in the head partial:
  ```
  ---
  title: Drain Cleaning in Austin | {{ site.name }}
  description: 110–155 characters…
  breadcrumb: Services        (optional; defaults to the nav label)
  noindex: true               (optional; 404.html is always noindex and out of the sitemap)
  ---
  ```
- Template syntax: `{{> partial }}`, `{{ escaped }}`, `{{{ raw_html }}}`. Unknown variables
  fail the build. Use the generated values for business facts in page bodies — `{{ site.phone }}`,
  `{{ site.telHref }}`, `{{{ phoneLink }}}`, `{{{ emailLink }}}`, `{{{ addressHtml }}}`,
  `{{{ hoursHtml }}}`, `{{{ serviceAreaHtml }}}`, `{{{ servicesHtml }}}` — never typed-out NAP
- site.json hours format: `{ "label": "Mon–Fri", "days": ["Monday", …], "opens": "08:00",
  "closes": "17:00" }`; `businessType` is the most specific schema.org LocalBusiness subtype

## Per-Page Requirements
- Unique `<title>` and meta description per page (page variables, not hardcoded in the head partial)
- Canonical URL per page
- Current page marked in nav with `aria-current="page"` and a visible active style
- Exactly one `<h1>`; heading levels never skip
- Primary CTA (call/contact) reachable without scrolling on mobile

## Navigation
- Desktop: horizontal nav, max 5–6 top-level items
- Mobile: accessible menu toggle — `<button>` with `aria-expanded` and `aria-controls`,
  closes on Escape and on link tap
- Tap-to-call visible in the mobile header bar itself, not hidden inside the menu

## Local Server
- Always serve on localhost — never screenshot a `file:///` URL
- Run `node build.mjs` before serving
- Start dev server: `node serve.mjs` (serves `dist/` at http://localhost:3000;
  resolves `/about/` → `about/index.html`, 307s `/about` → `/about/`, unknown paths → 404.html
  with a 404 status). If port 3000 belongs to another project, use `PORT=3001 node serve.mjs`
- `serve.mjs` does not run the Worker. To test `/api/*` (forms), use `npx wrangler dev`
- Start it in the background before screenshotting
- Do not start a second instance if already running

## Screenshot Workflow
- Puppeteer installed in `node_modules/` — Chrome cached at `/config/.cache/puppeteer/`
- `--no-sandbox` flag is required and already set in `screenshot.mjs`
- Always screenshot from localhost: `node screenshot.mjs http://localhost:3000/about/ label`
- Screenshot EVERY page at desktop AND 375px mobile width each comparison round:
  `node screenshot.mjs http://localhost:3000/about/ about --both` (one run, both widths).
  `--mobile` = 375px only, `--width=N` = custom desktop width, `--full` = full scrolling page
- Screenshots saved to `./temporary screenshots/screenshot-N.png` (auto-incremented)
- After screenshotting, read the PNG with the Read tool and analyze it directly
- Be specific when comparing: "heading is 32px but reference shows ~24px"

## Styling
- Production: Tailwind compiled + minified at build (never the Play CDN)
- Mockup mode only: Tailwind Play CDN `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images (mockup mode only): `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Anti-Generic Guardrails (from-scratch designs only)
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.) — derive from brand
- **Shadows:** Never flat `shadow-md` — use layered, color-tinted shadows with low opacity
- **Typography:** Never the same font for headings and body — pair display/serif with clean sans
- **Gradients:** Consider layered radial gradients for hero sections; for grain/texture, use a
  small pre-rendered tiled noise image at low opacity (not a live SVG `feTurbulence` filter
  over large areas — too expensive to paint on mobile)
- **Animations:** Only animate `transform` and `opacity` — never `transition-all`
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states
- **Images:** Gradient overlay (`bg-gradient-to-t from-black/60`) and color treatment ONLY on
  images with text over them (heroes, banners) — never on logos, headshots, product photos,
  or before/after images
- **Spacing:** Consistent tokens — prefer 4, 8, 12, 16, 24, 32, 48, 64, 96px rhythm
- **Depth:** Base → elevated → floating layering system — not everything at the same z-plane

## Mobile Optimization (Required — always in scope)
- Layout must be consistent for mobile users
- Tap-to-call (`tel:`) links for all phone numbers
- Simple, thumb-friendly navigation; tap targets at least 44x44px
- Fast loading — see Performance Budget
- Primary CTA above the fold on mobile

## Accessibility (target: WCAG 2.1 AA)
- Text contrast at least 4.5:1 (3:1 for large text and UI components)
- Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`; `<address>` for contact info
- Every `<img>` has alt text (`alt=""` only for purely decorative images)
- Visible focus styles on every interactive element
- Respect `prefers-reduced-motion`: disable non-essential animation
- Form fields have associated `<label>`s and clear error messages
- Skip-to-content link as the first focusable element

## Performance Budget (target: PageSpeed 100 mobile, all 4 categories)
- CSS: if under ~20KB, inline in `<head>`; otherwise one linked stylesheet with long cache
- JavaScript: none by default. Mobile menu toggle is inline and under 1KB. Any other script
  must be `defer` and justified. No jQuery, sliders/carousels, or animation libraries
- Fonts: self-hosted WOFF2 only (no Google Fonts CDN), max 2 families / 4 files total, subset
  to Latin, `font-display: swap`, preload the heading font. Define fallback fonts with
  `size-adjust` / `ascent-override` so the swap causes no layout shift
- LCP image (usually the hero): AVIF/WebP, responsive `srcset` + `sizes`,
  `fetchpriority="high"`, preloaded, NEVER `loading="lazy"`
- All other images: `loading="lazy"`, `decoding="async"`, explicit width/height, served no
  larger than 2x display size
- Above-the-fold content must never start at `opacity: 0` or depend on JS to appear.
  Scroll-reveal animations apply only below the fold
- Third-party embeds use facades: Google Maps → static image linking to Maps;
  YouTube → thumbnail that loads the iframe on click
- Analytics: none unless I request it; if requested, Cloudflare Web Analytics only. Its beacon
  is the one allowed third-party script (`defer`), and it requires the Privacy page
- `src/_headers`: immutable long-cache for `/assets/*`; HTML keeps the platform default
  (`max-age=0, must-revalidate`). Because assets are immutable, rename a file whenever its
  content changes (the build already content-hashes the stylesheet when it's linked)

## SEO Audit Rules (target: Ahrefs Health Score 100, zero errors)
- Canonical domain: apex OR www (per site.json); the other 301s to it via Cloudflare redirect
  rule. Canonicals, sitemap, internal links, and OG URLs all use the canonical form
- Zero internal links may resolve via redirect (trailing slash on every page URL)
- Titles: unique, 30–60 characters, format "Primary Keyword | Business Name"
- Meta descriptions: unique, 110–155 characters
- Open Graph: og:title, og:description, og:image (1200x630, absolute URL), og:url, og:type
- Favicon set: SVG + 32px PNG + 180px apple-touch-icon
- Every page linked from nav or footer — no orphan pages
- Sitemap contains only 200-status, indexable, canonical URLs; 404 page excluded
- 404 page returns a real 404 status
- robots.txt allows all crawlers and references the sitemap
- JSON-LD on every page: LocalBusiness (most specific subtype, e.g. `Chiropractor`,
  `AutoRepair`) site-wide, plus BreadcrumbList on inner pages. Must validate with zero errors
- No mixed content, broken links, or links to non-HTTPS URLs
- Service pages: minimum ~300 words of real, client-provided or client-approved content

## Agent Readability (llms.txt)
- Generate `/llms.txt` at build from site.json, following llmstxt.org format:
  H1 business name, blockquote one-sentence summary, then sections for Services
  (link + one line each), Service Area, Hours, Contact, Key Pages
- Plain factual language — no marketing fluff, no claims not in site.json
- Phone, email, and address marked up in both visible HTML and JSON-LD
- Do not add AI-crawler blocks to robots.txt
- Remind me to check the Cloudflare zone's AI crawler / managed robots.txt settings

## Forms
- Static pages can't process forms: POST to a route in `worker/index.js` under `/api/`
  (e.g. `/api/contact`). Only `/api/*` invokes the Worker (`run_worker_first` in wrangler.jsonc);
  every page and asset is served without it
- Spam protection: Cloudflare Turnstile, verified server-side in the Worker
  (`verifyTurnstile`); the Turnstile script is loaded ONLY on pages with a form
- Secrets (Turnstile secret, email API keys): `npx wrangler secret put NAME` for production;
  `.dev.vars` (git-ignored) for local `npx wrangler dev`. Never in wrangler.jsonc or the repo
- Never use `action=""`, `mailto:` forms, or third-party form services unless I request it
- Show success and error states without a page reload
- `/api/*` links are exempt from the audit's trailing-slash check and never appear in the sitemap

## Pre-Deploy Audit
- Run `node audit.mjs` after every build. It must pass before pushing to main.
  `node audit.mjs --preview` downgrades draft-stage issues (placeholders, placehold.co,
  missing client assets, Play CDN) to warnings — CI uses it for preview branches. It checks:
  title/description lengths, single h1, alt text, internal links resolve without redirect,
  trailing slashes, sitemap validity, JSON-LD parses, no placehold.co URLs,
  no `[CLIENT TO PROVIDE]` markers, llms.txt exists and matches site.json — plus canonical/OG
  tags, heading order, landmarks, skip link, `aria-current`, referenced assets exist, no
  `http://` links, no `transition-all`, no Google Fonts CDN

## Deploying (Cloudflare Workers static assets — not Pages)
- `wrangler.jsonc`: `main` = `worker/index.js`; `assets.directory` = `./dist`,
  `not_found_handling` = `"404-page"`, `html_handling` = `"auto-trailing-slash"`,
  `run_worker_first` = `["/api/*"]`. Run `setup.sh` to set the Worker name
- CI is `.github/workflows/deploy.yml` (`node build.mjs` → audit → deploy):
  - push to `main` → strict `node audit.mjs` → `wrangler deploy` (production)
  - push to any other branch → `node audit.mjs --preview` → `wrangler versions upload
    --preview-alias <branch>` → `https://<branch>-<worker>.<subdomain>.workers.dev`.
    Use these for client review
  - A failing audit fails the workflow — never bypass or weaken it to get a deploy through
- Requires `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template) and
  `CLOUDFLARE_ACCOUNT_ID` as repo secrets once per site repo (see README's Deploying section)
- A brand-new Worker must be created once with a local `npx wrangler deploy` before preview
  uploads work. It lands only on workers.dev (noindexed) until a custom domain is attached
- Manual `npx wrangler deploy` is otherwise only a local fallback for pre-CI sanity checks
- **Never push or merge to `main` without my explicit confirmation.** Work on a branch;
  use preview deployments for client review

## Duplicate Content Protection
- `src/_headers` sends `X-Robots-Tag: noindex` on every `*.workers.dev` host (production and
  previews). Never remove that rule; `_headers` does not cover Worker (`/api/*`) responses, so
  the Worker sets the header itself
- Custom domain: attach both apex and www to the Worker (Custom Domains); the non-canonical one
  301s to the canonical form in site.json via a Cloudflare redirect rule. Remind me to set this
  up for every new site

## Secrets
- Never commit `.env`, `.dev.vars`, API tokens, `SERPAPI_API_KEY`, or `PAGESPEED_API_KEY`
- Confirm `.gitignore` covers `.env`, `.dev.vars`, `dist/`, `node_modules/`, and `temporary screenshots/`

## SEO & Content Research
- `playwright` and `serpapi` MCP servers are pre-configured in `.mcp.json` — use them for site
  crawling and real Google search/keyword data when asked for SEO or content strategy work
- `serpapi` requires `SERPAPI_API_KEY` exported in the shell before the session starts
  (see `.env.example` and README)

## Post-Deploy Performance Check
- After deploying, run `node pagespeed.mjs https://yourdomain.com` — reports the median of 3
  mobile runs across all 4 categories (Performance, Accessibility, Best Practices, SEO)
- Run it for every page, not just the homepage
- PageSpeed Insights requires a public URL — it cannot reach `localhost`
- For pre-deploy local performance debugging against `localhost:3000`, use the `web-perf` skill
- Unauthenticated PSI requests share a small global Google quota — set `PAGESPEED_API_KEY` in
  `.env` (see `.env.example`) if requests get rate-limited
- Then run an Ahrefs Site Audit crawl (free via Ahrefs Webmaster Tools on verified sites)

## Hard Rules
- Do not add sections, features, pages, or content not requested
- Do not improve a reference design — match it exactly
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Do not fabricate facts (see "Never Invent Facts")
- Do not push to `main` without confirmation
- Always optimize for mobile

## Definition of Done (production, before any push to main)
- [ ] `node audit.mjs` passes
- [ ] Every page screenshotted at desktop + 375px and reviewed
- [ ] No placehold.co URLs or `[CLIENT TO PROVIDE]` markers remain
- [ ] All text passes WCAG AA contrast
- [ ] Phone numbers use `tel:` links; NAP matches Google Business Profile
- [ ] Forms tested end-to-end (submission arrives, Turnstile works)
- [ ] 404 page returns 404 status
- [ ] llms.txt, sitemap.xml, robots.txt present in `dist/`
- [ ] Remaining placeholders listed for me