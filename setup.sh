#!/bin/bash
# Usage: ./setup.sh my-client-site
# Sets up a new site from this template — run once after cloning

set -e

SITE=$(echo "${1:-sitename}" | tr '[:upper:]' '[:lower:]')

echo "→ Setting up site: web-$SITE"

# Rename the Worker
sed -i "s/\"web-sitename\"/\"web-$SITE\"/" wrangler.jsonc

# Canonical domain → site.json (sitemap, robots.txt, llms.txt, canonicals, and JSON-LD all read it)
read -p "  Canonical domain, exactly as it should appear (e.g. www.myclientsite.com or myclientsite.com): " DOMAIN
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN#http://}
DOMAIN=${DOMAIN%/}
SITE_URL="https://$DOMAIN" node -e '
  const fs = require("fs");
  const p = "src/_data/site.json";
  const site = JSON.parse(fs.readFileSync(p, "utf8"));
  site.url = process.env.SITE_URL;
  fs.writeFileSync(p, JSON.stringify(site, null, 2) + "\n");
'

# Git identity — fresh containers have none, so the first commit fails without it
if [ -z "$(git config user.name)" ]; then
  read -p "  Git user.name for commits (e.g. Jane Doe): " GIT_NAME
  git config --global user.name "$GIT_NAME"
fi
if [ -z "$(git config user.email)" ]; then
  read -p "  Git user.email for commits: " GIT_EMAIL
  git config --global user.email "$GIT_EMAIL"
fi

# Install all dependencies — Chrome system libs + npm packages.
# Handles root, sudo (via SUDO_PASS in .env), and no-root fallback automatically.
echo "→ Installing dependencies..."
bash .devcontainer/install-deps.sh

echo ""
echo "✓ Done. Next steps:"
echo "  1. Fill in src/_data/site.json (NAP must match the Google Business Profile exactly)"
echo "  2. Add logo/colors to brand_assets/"
echo "  3. node build.mjs && node audit.mjs --preview"
echo "  4. Cloudflare → Workers & Pages → Create application → import this repo as web-$SITE (README → Deploying)"
