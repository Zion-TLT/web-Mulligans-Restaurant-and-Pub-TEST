# CLAUDE.md — Static Site Template Rules

## Always Do First
1. **Check dependencies**: if `node_modules/` does not exist, run `npm install` before anything else.
   - If screenshot fails with a library error, system deps are missing — see `.devcontainer/install-deps.sh` (requires root; normally run automatically on container creation via `postCreateCommand`).
2. **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Brand Assets
- Always check `brand_assets/` before designing
- If a logo exists, use it — never a placeholder
- If a color palette is defined, use those exact hex values — do not invent brand colors

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly
- If no reference: design from scratch using brand assets and guardrails below
- Screenshot your output, compare against reference, fix mismatches, re-screenshot
- Do at least 2 comparison rounds — stop only when no visible differences remain

## Local Server
- Always serve on localhost — never screenshot a `file:///` URL
- Start dev server: `node serve.mjs` (serves project root at http://localhost:3000)
- `serve.mjs` is in the project root — start it in the background before screenshotting
- Do not start a second instance if already running

## Screenshot Workflow
- Puppeteer installed in `node_modules/` — Chrome cached at `/config/.cache/puppeteer/`
- `--no-sandbox` flag is required and already set in `screenshot.mjs`
- Always screenshot from localhost: `node screenshot.mjs http://localhost:3000`
- Optional label: `node screenshot.mjs http://localhost:3000 label`
- Screenshots saved to `./temporary screenshots/screenshot-N.png` (auto-incremented)
- After screenshotting, read the PNG with the Read tool and analyze it directly
- Be specific when comparing: "heading is 32px but reference shows ~24px"

## Output Defaults
- Single `index.html` file, all styles inline, unless told otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.) — derive from brand
- **Shadows:** Never flat `shadow-md` — use layered, color-tinted shadows with low opacity
- **Typography:** Never the same font for headings and body — pair display/serif with clean sans
- **Gradients:** Layer multiple radial gradients — add grain/texture via SVG noise filter
- **Animations:** Only animate `transform` and `opacity` — never `transition-all`
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states
- **Images:** Add gradient overlay (`bg-gradient-to-t from-black/60`) and color treatment layer
- **Spacing:** Consistent tokens — prefer 4, 8, 12, 16, 24, 32, 48, 64, 96px rhythm
- **Depth:** Base → elevated → floating layering system — not everything at the same z-plane

## Mobile Optimization (Required)
- Optimize for mobile — layout must be consistent for mobile users
- Tap-to-call buttons for phone numbers
- Simple, thumb-friendly navigation
- Fast loading — minimize heavy assets
- Primary CTA above the fold on mobile

## Hard Rules
- Do not add sections, features, or content not requested
- Do not improve a reference design — match it exactly
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Always optimize for mobile

## Deploying
- Update `wrangler.jsonc` name before first deploy (or run `setup.sh`)
- Deploy: `npx wrangler deploy`
- Push to trigger CI: `git push origin main:dev` (then merge dev → main in Cloudflare/GitHub)

## Post-Deploy Performance Check
- After deploying, run `node pagespeed.mjs https://yourdomain.com` to get real-world Lighthouse/Core Web Vitals scores
- PageSpeed Insights requires a public URL — it cannot reach `localhost`, so this only runs after deploy
- For pre-deploy local performance debugging (render-blocking resources, layout shifts, caching) against `localhost:3000`, use the `web-perf` skill instead
- Unauthenticated PSI requests share a small global Google quota — set `PAGESPEED_API_KEY` in `.env` (see `.env.example`) if requests get rate-limited
