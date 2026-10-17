#!/bin/bash
# Usage: ./setup.sh my-client-site
# Sets up a new site from this template — run once after cloning

set -e

SITE=${1:-SITENAME}

echo "→ Setting up site: web-$SITE"

# Rename the Wrangler project
sed -i "s/web-SITENAME/web-$SITE/" wrangler.jsonc

# Update placeholder domain references
read -p "  Domain (e.g. myclientsite.com): " DOMAIN
sed -i "s/yourdomain.com/$DOMAIN/g" index.html robots.txt sitemap.xml

# Install all dependencies — Chrome system libs + npm packages.
# Handles root, sudo (via SUDO_PASS in .env), and no-root fallback automatically.
echo "→ Installing dependencies..."
bash .devcontainer/install-deps.sh

echo ""
echo "✓ Done. Next steps:"
echo "  1. Add logo/colors to brand_assets/"
echo "  2. Build out index.html"
echo "  3. npx wrangler deploy"
