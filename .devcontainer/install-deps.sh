#!/bin/bash
# Installs Chrome system libraries and node_modules.
# Priority order:
#   1. Root — apt-get install directly (e.g. during Docker image build)
#   2. Sudo — uses SUDO_PASSWORD env var (set automatically by linuxserver/code-server)
#             or SUDO_PASS from a local .env file
#   3. No-root fallback — downloads and extracts libs to .chrome-libs/ locally
set -e

CHROME_LIBS="libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
  libcairo2 libcups2t64 libdbus-1-3 libgbm1 libglib2.0-0t64 libgtk-3-0t64 \
  libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── 1. root ────────────────────────────────────────────────────────────────
if [ "$(id -u)" -eq 0 ]; then
  echo "→ Installing Chrome system libs (root)..."
  apt-get update -qq
  # shellcheck disable=SC2086
  apt-get install -y --no-install-recommends $CHROME_LIBS 2>&1 | tail -3
  echo "→ Installing npm dependencies..."
  npm install --prefix "$PROJECT_DIR"
  echo "✓ Done"
  exit 0
fi

# ── 2. sudo ────────────────────────────────────────────────────────────────
# Load .env if present (SUDO_PASS can override)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a  # shellcheck disable=SC1090
fi

# Prefer explicit SUDO_PASS; fall back to linuxserver/code-server's SUDO_PASSWORD
SUDO_PASS="${SUDO_PASS:-$SUDO_PASSWORD}"

if [ -n "$SUDO_PASS" ]; then
  echo "→ Installing Chrome system libs (sudo)..."
  echo "$SUDO_PASS" | sudo -S apt-get update -qq
  # shellcheck disable=SC2086
  echo "$SUDO_PASS" | sudo -S apt-get install -y --no-install-recommends $CHROME_LIBS 2>&1 | tail -3
  echo "→ Installing npm dependencies..."
  cd "$PROJECT_DIR" && npm install
  echo "✓ Done"
  exit 0
fi

# ── 3. no-root fallback ────────────────────────────────────────────────────
MARKER="$PROJECT_DIR/.chrome-libs/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0"
if [ -f "$MARKER" ]; then
  echo "✓ Chrome libs already in .chrome-libs/ — skipping download"
else
  echo "→ No root/sudo — downloading Chrome libs to .chrome-libs/..."
  TMPSTATE=$(mktemp -d)
  APT_OPTS="-o Dir::Cache=$TMPSTATE/cache -o Dir::State=$TMPSTATE/state \
    -o Dir::Etc::SourceList=/etc/apt/sources.list \
    -o Dir::Etc::SourceParts=/etc/apt/sources.list.d"

  # shellcheck disable=SC2086
  apt-get $APT_OPTS update -qq 2>/dev/null || true

  EXTRA_LIBS="libpixman-1-0 libxcb-render0 libxcb-shm0 libxrender1 libdrm2 libdrm-common \
    libfreetype6 libfontconfig1 libharfbuzz0b libpng16-16t64 libxml2 libgraphite2-3 \
    libfribidi0 libdatrie1 libthai0 libicu74 libavahi-common3 libavahi-client3 \
    libxi6 libxtst6 fonts-dejavu-core"

  # shellcheck disable=SC2086
  apt-get $APT_OPTS download $CHROME_LIBS $EXTRA_LIBS 2>&1 | grep -v "^WARNING" || true

  mkdir -p "$PROJECT_DIR/.chrome-libs"
  for deb in *.deb; do
    [ -f "$deb" ] && dpkg-deb --extract "$deb" "$PROJECT_DIR/.chrome-libs" && rm "$deb"
  done
  rm -rf "$TMPSTATE"
  echo "✓ Chrome libs extracted to .chrome-libs/"
fi

echo "→ Installing npm dependencies..."
cd "$PROJECT_DIR" && npm install
echo "✓ Done"
