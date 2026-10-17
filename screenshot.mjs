// Usage: node screenshot.mjs <url> [label] [--mobile | --both] [--width=N] [--full]
//   (default)  desktop, 1440×900
//   --mobile   375×812 phone viewport (2x, touch, mobile viewport handling)
//   --both     desktop + mobile in one run — what each comparison round needs
//   --width=N  custom viewport width (overrides the desktop width)
//   --full     capture the full scrolling page instead of just the viewport
import puppeteer from 'puppeteer';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// Inject locally-extracted Chrome system libs when they exist (no-root fallback)
const localLibs = join(__dirname, '.chrome-libs/usr/lib/x86_64-linux-gnu');
if (existsSync(localLibs)) {
  process.env.LD_LIBRARY_PATH = [localLibs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
}

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')).map(a => a.split('=')[0]));
const [url = 'http://localhost:3000', labelArg] = args.filter(a => !a.startsWith('--'));
const widthArg = Number((args.find(a => a.startsWith('--width=')) || '').split('=')[1]) || null;

const DESKTOP = { name: 'desktop', width: widthArg || 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const viewports = flags.has('--both') ? [DESKTOP, MOBILE] : flags.has('--mobile') ? [MOBILE] : [DESKTOP];

const dir = './temporary screenshots';
if (!existsSync(dir)) mkdirSync(dir);

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
for (const { name, ...viewport } of viewports) {
  // Suffix the viewport name whenever it isn't the plain default, so files are self-describing
  const suffix = [labelArg, viewports.length > 1 || viewport.isMobile ? name : null].filter(Boolean).join('-');
  const existing = readdirSync(dir).filter(f => f.endsWith('.png')).length;
  const outFile = join(dir, `screenshot-${existing + 1}${suffix ? `-${suffix}` : ''}.png`);
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: outFile, fullPage: flags.has('--full') });
  await page.close();
  console.log(`Saved: ${outFile} (${viewport.width}px)`);
}
await browser.close();
