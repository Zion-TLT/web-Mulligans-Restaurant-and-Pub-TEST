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

# Install all dependencies — Chrome system libs + npm packages.
# Handles root, sudo (via SUDO_PASS in .env), and no-root fallback automatically.
echo "→ Installing dependencies..."
bash .devcontainer/install-deps.sh

echo ""
echo "✓ Done. Next steps:"
echo "  1. Fill in src/_data/site.json (NAP must match the Google Business Profile exactly)"
echo "  2. Add logo/colors to brand_assets/"
echo "  3. node build.mjs && node audit.mjs --preview"
echo "  4. Once, to create the Worker so previews work: npx wrangler deploy (see README → Deploying)"
