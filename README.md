# web-template

Static multi-page site template deployed on Cloudflare Workers (static assets). Pages are assembled from shared partials and a single `site.json` by `build.mjs`, checked by `audit.mjs`, and deployed by GitHub Actions — with preview URLs per branch. Includes a local dev server, Puppeteer screenshot workflow, and Claude Code design guardrails.

---

## Starting a new site

Whoever is doing this doesn't need to be the org owner — any team member with access to the GitHub org and the Cloudflare account can spin up a new site from this template.

### 1. Create repo from template

Go to the [web-template repo](https://github.com/Travis-Lehman-Tech/web-template) on GitHub → **Use this template** → **Create a new repository** → name it `web-clientname`, owned by your org.

### 2. Open in VS Code (Docker)

Clone the new repo and open it in VS Code. The devcontainer sets everything up automatically:

- The image build (`.devcontainer/Dockerfile`) installs the Chrome/Puppeteer system libraries required for screenshotting
- `postCreateCommand` runs `npm install` (Puppeteer + Chrome, Wrangler, Tailwind CLI)

No manual dependency setup needed — screenshotting works immediately after the container is ready. Outside the devcontainer (or if a screenshot fails with a missing-library error), run `bash .devcontainer/install-deps.sh`; it handles root, sudo, and no-root setups.

See [Connecting to GitHub](#connecting-to-github) below before your first push — this repo does not use tokens embedded in the remote URL, and every contributor sets up their own key, not a shared one.

### 3. Run setup script

```bash
chmod +x setup.sh
./setup.sh clientname
```

The script prompts for the canonical domain (apex or www — whichever the site should live on), writes it to `src/_data/site.json`, and renames the Worker to `web-clientname`. The sitemap, robots.txt, llms.txt, canonicals, and JSON-LD are all generated from `site.json` at build time.

Then fill in the rest of `src/_data/site.json` — name, phone, email, address, hours, services. Name/address/phone must match the client's Google Business Profile exactly.

### 4. Add brand assets

Drop the client's logo and color guide into `brand_assets/`. Claude will check this folder before designing and use whatever is there — never placeholders if assets exist.

### 5. Build

Start a Claude Code session. `CLAUDE.md` is picked up automatically. Claude will:

- Ask **"Mockup or production?"** unless you've said. Say "mockup" or "pitch" for a fast prospect demo: it can be a single page and use the Tailwind Play CDN and placeholder images, it skips the performance, SEO, and llms.txt rules, and it never deploys to the client's domain. Everything else is production, where every rule applies.
- Confirm the page list with you (default: Home, About, Services, Contact, 404, plus Privacy if the site has forms or analytics).
- Invoke the `frontend-design` skill, check `node_modules/`, build, start the local dev server, and screenshot every page at desktop and 375px mobile to iterate on the design.
- Never invent business facts. Anything missing becomes a `[CLIENT TO PROVIDE: …]` placeholder, and Claude lists every remaining placeholder at the end of each session.

### 6. Enable automatic deploys (one-time, per new repo)

See [Deploying](#deploying) below — add two repo secrets, then run `npx wrangler deploy` once from your machine to create the Worker. After that, every branch push gets a preview URL and pushes to `main` deploy to production.

The new repo's first workflow run (triggered when GitHub creates it from the template) fails — that's expected. It has no secrets yet, and the strict audit on `main` fails until `site.json` and the client assets are filled in.

---

## Connecting to GitHub

**Standard: SSH with a personal deploy key generated and stored in Bitwarden, exposed to `ssh`/`git` via Bitwarden's SSH agent and a host alias in `~/.ssh/config`. Never a raw private key file on disk, and never a token embedded in the remote URL.**

This is per-*person*, not per-repo or per-org — everyone who clones a site built from this template sets this up once for themselves, using their own GitHub account and their own Bitwarden-stored key. Don't reuse someone else's key or share vault items across people.

A token pasted into `origin`'s URL (`https://ghp_xxx@github.com/...`) sits in plaintext in `.git/config`, shows up in `git remote -v`, and gets copied wherever that file goes. If one ever ends up there, treat it as compromised — revoke it on GitHub ([Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)) and switch to the method below.

Throughout this section, replace:
- `YOUR-GITHUB-USERNAME` — your own GitHub username (not the org's)
- `ORG-NAME` — the GitHub org/owner the site repo lives under (e.g. `Travis-Lehman-Tech`)
- `REPO-NAME` — the specific site repo, e.g. `web-clientname`

### One-time setup (per dev machine, per person)

Generate the key inside Bitwarden rather than as a plaintext file on disk — the private key stays encrypted in your vault, and Bitwarden's SSH agent serves it to `ssh`/`git` on demand instead of it ever sitting in `~/.ssh/`.

1. **Generate the key in Bitwarden:**
   - Open the **Bitwarden desktop app** (the browser extension alone can't do this — you need the desktop app, v2025.1.2+; on macOS use the `.dmg` build, on Linux use the `snap`/`deb`/AppImage build, not Flatpak).
   - **Settings → Enable SSH agent**, and set "Ask for authorization when using SSH agent" to **Always** so nothing signs with your key silently.
   - **New item (+) → SSH key** — Bitwarden generates an Ed25519 key pair for you. Name it clearly (e.g. `github-YOUR-GITHUB-USERNAME`) and **Save**.
   - Open the saved item and copy the **public key**.
2. Add the public key to your GitHub account: [github.com/settings/keys](https://github.com/settings/keys) → **New SSH key** → paste it.
3. **Add the key to VS Code's terminal** by pointing SSH at Bitwarden's agent socket for this host, in `~/.ssh/config`:
   ```
   Host github.com-YOUR-GITHUB-USERNAME
     HostName github.com
     User git
     IdentityAgent ~/.bitwarden-ssh-agent.sock
   ```
   No `IdentityFile` and no `IdentitiesOnly` — there's no key file on disk to point at; Bitwarden's agent supplies the key live and will pop up an authorization prompt the first time each session uses it (per the "Always" setting above).
4. Restart VS Code (or at least reopen its integrated terminal) after enabling the SSH agent so the terminal's environment picks up Bitwarden's socket.
5. Verify from the VS Code integrated terminal:
   ```bash
   ssh-add -L
   # → lists the public key(s) Bitwarden is currently serving
   ssh -T git@github.com-YOUR-GITHUB-USERNAME
   # → "Hi YOUR-GITHUB-USERNAME! You've successfully authenticated..."
   ```

### Per-repo setup (after cloning)

Point the remote at your alias instead of the default `github.com` host:

```bash
git remote set-url origin git@github.com-YOUR-GITHUB-USERNAME:ORG-NAME/REPO-NAME.git
```

Confirm it's clean — no credentials in the URL:

```bash
git remote -v
# origin  git@github.com-YOUR-GITHUB-USERNAME:ORG-NAME/REPO-NAME.git (fetch)
# origin  git@github.com-YOUR-GITHUB-USERNAME:ORG-NAME/REPO-NAME.git (push)
```

You'll need write access to `ORG-NAME` on GitHub for pushes to succeed — ask an org owner to add you if you don't have it yet.

This keeps credentials out of the repo's git config entirely, and out of the filesystem too — the private key lives encrypted in your Bitwarden vault, never as a file on disk, so a compromised clone, `~/.ssh/` backup, or config file leaks nothing.

### In VS Code

VS Code's built-in Source Control panel and integrated terminal both shell out to your system `git`, so once the SSH alias above is working, VS Code just works — no separate sign-in, no VS Code-stored credentials. A few things worth doing on top of that:

- Install the **GitHub Pull Requests and Issues** extension to review/create PRs without leaving the editor, authenticated via `gh`/browser OAuth — not a PAT typed into a settings field.
- Enable commit signing (`git config --global commit.gpgsign true` with a GPG key, or `git config --global gpg.format ssh` to sign with the same SSH key) so commits show as **Verified** on GitHub.
- Never accept VS Code's prompt to "sign in with GitHub" using a manually-pasted classic token when it offers the browser-based OAuth flow instead — OAuth tokens are scoped and revocable per-device; pasted PATs are broad and easy to leave lying around.

---

## Deploying

**Standard: push → GitHub Actions builds, audits, and deploys.** No one runs `npx wrangler deploy` from their laptop for a real deploy.

| Push to | Audit | Result |
|---|---|---|
| `main` | `node audit.mjs` (strict — any placeholder, missing asset, or SEO error fails) | `wrangler deploy` → production |
| any other branch | `node audit.mjs --preview` (placeholders and missing client assets are warnings) | `wrangler versions upload --preview-alias <branch>` → `https://<branch>-<worker>.<subdomain>.workers.dev` |

Use preview URLs for client review. All `*.workers.dev` hosts send `X-Robots-Tag: noindex` (see `src/_headers`), so neither previews nor the production workers.dev URL compete with the real domain in search.

The workflow lives at [.github/workflows/deploy.yml](.github/workflows/deploy.yml). It needs two repo secrets, set once per new site repo:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **Edit Cloudflare Workers** template, scoped to your account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar of any domain/account overview page |

Set them with the `gh` CLI (fastest — run from the repo root):

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

Or in the GitHub UI: repo → **Settings → Secrets and variables → Actions → New repository secret**.

### First deploy (once per site)

Cloudflare can't upload a preview version of a Worker that doesn't exist yet, so create it once from your machine (after `./setup.sh`):

```bash
npx wrangler login     # if you haven't already
node build.mjs
npx wrangler deploy
```

This only publishes to the noindexed workers.dev URL — nothing reaches the client's domain until you attach it.

### Going live on the client's domain

1. Merge to `main` once `node audit.mjs` passes locally (strict mode).
2. Cloudflare dashboard → the Worker → **Settings → Domains & Routes → Add → Custom Domain**: add both the apex and `www`.
3. Add a redirect rule on the zone so the non-canonical host 301s to the canonical one in `site.json` (e.g. `example.com/*` → `https://www.example.com/${1}`).
4. Check the zone's **AI crawl control / managed robots.txt** settings so Cloudflare doesn't override the generated `robots.txt`.
5. Run `node pagespeed.mjs` against every page.
6. Run an Ahrefs Site Audit crawl (free via [Ahrefs Webmaster Tools](https://ahrefs.com/webmaster-tools) once the domain is verified) — target Health Score 100, zero errors.

### Analytics

None by default. If a client wants it, use Cloudflare Web Analytics only — no other analytics or tag managers. Its beacon is the one third-party script allowed, and enabling it means the site needs a Privacy page.

### Forms and secrets

Form endpoints live in [worker/index.js](worker/index.js) under `/api/` — only those paths invoke the Worker; every page and asset is served without it. Set secrets per site:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY   # production
```

For local testing, put the same keys in `.dev.vars` (git-ignored) and run `npx wrangler dev` — `serve.mjs` doesn't run the Worker.

Trigger a deploy without pushing via **Actions → Deploy → Run workflow**.

---

## Local development

Build, audit, and serve the built site at port 3000:

```bash
node build.mjs          # src/ → dist/ (partials, Tailwind, sitemap/robots/llms.txt)
node audit.mjs --preview # or without --preview for the strict pre-production check
node serve.mjs          # PORT=3001 node serve.mjs if 3000 is taken
```

Edit `src/` only — `dist/` is regenerated on every build. To test form endpoints, use `npx wrangler dev` instead of `serve.mjs`.

Take a screenshot:

```bash
node screenshot.mjs http://localhost:3000/              # desktop, 1440px
node screenshot.mjs http://localhost:3000/about/ about --both   # desktop + 375px mobile
node screenshot.mjs http://localhost:3000/ home --mobile --full  # 375px, full scrolling page
node screenshot.mjs http://localhost:3000/ wide --width=1920     # custom desktop width
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

## SEO & content research (Playwright + SerpApi MCP)

Two MCP servers are pre-configured in `.mcp.json` for Claude Code to use when doing SEO/content work — crawling the live site and pulling real Google search data:

- **playwright** — browser automation (`@playwright/mcp`), no setup required. Claude uses it to crawl pages, read rendered content, and follow links.
- **serpapi** — real Google search results, autocomplete, and competitor rankings via [serpapi.com](https://serpapi.com/manage-api-key).

To enable serpapi, get a free API key and export it in your shell **before** starting Claude Code (MCP env-var expansion reads the process environment, not `.env`):

```bash
export SERPAPI_API_KEY=your-key-here
```

Then just ask Claude Code to crawl the site, research keywords, and propose a content strategy — it will use both tools automatically.

---

## Checklist for each new site

- [ ] Repo created from template, opened in VS Code — devcontainer ran and deps installed
- [ ] Remote set to your own SSH deploy-key alias (see [Connecting to GitHub](#connecting-to-github)) — no token in `git remote -v`
- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets set (see [Deploying](#deploying))
- [ ] `./setup.sh clientname` run — canonical domain in `site.json`, Worker renamed
- [ ] `npx wrangler deploy` run once to create the Worker — branch pushes now get preview URLs
- [ ] `src/_data/site.json` filled in; NAP matches the Google Business Profile
- [ ] Logo + color guide added to `brand_assets/`; favicon set and `og-image.jpg` in `src/assets/`
- [ ] `node audit.mjs` passes (strict) before the first merge to `main`
- [ ] Custom domain attached (apex + www), non-canonical host redirects, AI crawler settings checked
