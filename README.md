# web-template

Static HTML + Cloudflare Workers site template. Includes local dev server, Puppeteer screenshot workflow, and Claude Code design guardrails.

---

## Starting a new site

### 1. Create repo from template

Go to [github.com/travislehmantech/web-template](https://github.com/travislehmantech/web-template) → **Use this template** → **Create a new repository** → name it `web-clientname`.

### 2. Open in VS Code (Docker)

Clone the new repo and open it in VS Code. When the devcontainer starts, it automatically runs `.devcontainer/install-deps.sh`, which:

- Installs all Chrome/Puppeteer system libraries (required for screenshotting)
- Runs `npm install` (Puppeteer + Wrangler)

No manual dependency setup needed — screenshotting works immediately after the container is ready.

### 3. Run setup script

```bash
chmod +x setup.sh
./setup.sh clientname
```

The script prompts for the domain, replaces all `yourdomain.com` placeholders in `index.html`, `robots.txt`, and `sitemap.xml`, and renames the Wrangler project to `web-clientname`.

### 4. Add brand assets

Drop the client's logo and color guide into `brand_assets/`. Claude will check this folder before designing and use whatever is there — never placeholders if assets exist.

### 5. Build

Start a Claude Code session. `CLAUDE.md` is picked up automatically — Claude will invoke the `frontend-design` skill, check `node_modules/`, start the local dev server, and use the screenshot workflow to iterate on the design.

### 6. Deploy

```bash
npx wrangler deploy
```

---

## Local development

Start the dev server (serves project root at port 3000):

```bash
node serve.mjs
```

Take a screenshot:

```bash
node screenshot.mjs http://localhost:3000
# optional label suffix:
node screenshot.mjs http://localhost:3000 mobile
```

Screenshots are saved to `temporary screenshots/screenshot-N.png`, auto-incremented, never overwritten.

---

## PageSpeed Insights

Check Core Web Vitals and Lighthouse scores for a **deployed, publicly reachable URL** (Google can't reach localhost):

```bash
node pagespeed.mjs https://yourdomain.com          # mobile + desktop
node pagespeed.mjs https://yourdomain.com mobile    # mobile only
node pagespeed.mjs https://yourdomain.com desktop   # desktop only
```

Prints performance/accessibility/best-practices/SEO scores plus LCP, CLS, TBT, FCP, and Speed Index.

Unauthenticated requests share a small Google-wide quota that's easy to exhaust. Get a free key at [developers.google.com/speed/docs/insights/v5/get-started](https://developers.google.com/speed/docs/insights/v5/get-started), copy `.env.example` to `.env`, and set `PAGESPEED_API_KEY`.

For local, pre-deploy performance debugging (render-blocking resources, layout shifts, caching) use the `web-perf` Claude Code skill against `localhost:3000` instead — PageSpeed Insights only works once the site is live.

---

## Checklist for each new site

- [ ] Repo created from template, opened in VS Code — devcontainer ran and deps installed
- [ ] `./setup.sh clientname` run — domain replaced, Wrangler project renamed
- [ ] Logo + color guide added to `brand_assets/`
- [ ] `robots.txt` and `sitemap.xml` domain confirmed
- [ ] `npx wrangler deploy` run
