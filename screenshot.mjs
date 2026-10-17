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

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';
const dir = './temporary screenshots';
if (!existsSync(dir)) mkdirSync(dir);
const existing = readdirSync(dir).filter(f => f.endsWith('.png')).length;
const outFile = join(dir, `screenshot-${existing + 1}${label}.png`);
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await page.screenshot({ path: outFile, fullPage: false });
await browser.close();
console.log('Saved:', outFile);
