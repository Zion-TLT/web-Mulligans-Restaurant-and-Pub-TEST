// Pre-deploy audit of dist/. Run after `node build.mjs`; exits 1 on any error.
//
//   node audit.mjs            strict — required before production (CI runs this on main)
//   node audit.mjs --preview  placeholders, placehold.co, Play CDN/Google Fonts, and missing
//                             client assets become warnings so drafts can deploy to preview URLs
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, sep, extname } from 'path';
import { DIST, PLACEHOLDER, loadSite, llmsTxt, robotsTxt } from './lib/site.mjs';

const preview = process.argv.includes('--preview');
const site = loadSite();
const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`${where}: ${msg}`);
// Issues that are expected while a site is still a draft
const draft = (where, msg) => (preview ? warnings : errors).push(`${where}: ${msg}`);

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `node build.mjs` first');
  process.exit(1);
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = walk(DIST);
const relPath = (f) => relative(DIST, f).split(sep).join('/');
const routeOf = (rel) => (rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -10)}` : `/${rel}`);
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? decode(m[1] ?? m[2]) : null;
};
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

// --- Site config ---------------------------------------------------------------------------
if (!/^https:\/\/[^/]+$/.test(site.url)) error('site.json', `url must be https://host with no path (got "${site.url}")`);
if (/\/\/(www\.)?example\.com$/.test(site.url)) draft('site.json', 'url is still example.com — run setup.sh or set the canonical domain');
for (const n of site.nav || []) {
  if (!/^\/([\w-]+\/)*$/.test(n.href)) error('site.json', `nav href "${n.href}" must be root-relative with a trailing slash`);
}
const navRoutes = new Set((site.nav || []).map((n) => n.href));

// Resolve an internal path to a dist file without any redirect, or null
function resolveInternal(path) {
  if (path.endsWith('/')) {
    const f = join(DIST, path, 'index.html');
    return existsSync(f) ? f : null;
  }
  const f = join(DIST, path);
  return extname(path) && existsSync(f) && statSync(f).isFile() ? f : null;
}

// --- Pages ---------------------------------------------------------------------------------
const pages = files.filter((f) => f.endsWith('.html')).map((f) => {
  const rel = relPath(f);
  const html = readFileSync(f, 'utf8');
  return { rel, route: routeOf(rel), html, noindex: /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html) };
});
const indexable = pages.filter((p) => !p.noindex);
const seen = { title: new Map(), description: new Map() };
const missingAssets = new Map(); // asset path → pages referencing it

if (!existsSync(join(DIST, '404.html'))) error('dist', '404.html missing — not_found_handling would have nothing to serve');
if (!existsSync(join(DIST, '_headers'))) error('dist', '_headers missing');

for (const p of pages) {
  const { rel, html } = p;
  const body = stripComments(html);

  if (!/<html[^>]*\slang="[^"]+"/i.test(html)) error(rel, '<html> has no lang attribute');

  // Title + description
  const title = decode((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1]?.trim() || '');
  const descTag = tags(html, 'meta').find((t) => attr(t, 'name') === 'description');
  const description = descTag ? attr(descTag, 'content') : '';
  if (!title) error(rel, 'missing <title>');
  if (!description) error(rel, 'missing meta description');
  if (!p.noindex) {
    for (const [key, value, min, max] of [['title', title, 30, 60], ['description', description, 110, 155]]) {
      if (!value) continue;
      const len = [...value].length;
      if (len < min || len > max) {
        (value.includes(PLACEHOLDER) ? draft : error)(rel, `${key} is ${len} chars (want ${min}–${max}): "${value}"`);
      }
      if (seen[key].has(value)) error(rel, `duplicate ${key} (also on ${seen[key].get(value)})`);
      else seen[key].set(value, rel);
    }
  }

  // Canonical
  const canonical = tags(html, 'link').find((t) => attr(t, 'rel') === 'canonical');
  if (!p.noindex) {
    const expected = site.url + p.route;
    if (!canonical) error(rel, 'missing canonical link');
    else if (attr(canonical, 'href') !== expected) error(rel, `canonical is "${attr(canonical, 'href')}", expected "${expected}"`);
    const ogUrl = tags(html, 'meta').find((t) => attr(t, 'property') === 'og:url');
    if (!ogUrl || attr(ogUrl, 'content') !== expected) error(rel, `og:url must be "${expected}"`);
  }
  for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
    if (!p.noindex && !tags(html, 'meta').some((t) => attr(t, 'property') === prop)) error(rel, `missing ${prop}`);
  }

  // Headings
  const h1s = (body.match(/<h1\b/gi) || []).length;
  if (h1s !== 1) error(rel, `has ${h1s} <h1> elements (want exactly 1)`);
  let prev = 0;
  for (const m of body.matchAll(/<h([1-6])\b/gi)) {
    const level = Number(m[1]);
    if (prev && level > prev + 1) error(rel, `heading level skips from h${prev} to h${level}`);
    prev = level;
  }

  // Landmarks + nav state
  for (const landmark of ['header', 'nav', 'main', 'footer']) {
    if (!new RegExp(`<${landmark}\\b`, 'i').test(body)) error(rel, `missing <${landmark}> landmark`);
  }
  if (!/href="#main"/.test(body)) error(rel, 'missing skip-to-content link');
  if (navRoutes.has(p.route) && !/aria-current="page"/.test(body)) error(rel, 'current page not marked with aria-current="page"');

  // Images
  for (const img of tags(body, 'img')) {
    if (attr(img, 'alt') === null) error(rel, `<img> without alt: ${img.slice(0, 80)}`);
    if (/placehold\.co/.test(img)) draft(rel, 'placehold.co image');
  }

  // Links
  for (const a of tags(body, 'a')) {
    const href = attr(a, 'href');
    if (href === null || href === '' || href.startsWith('#') || /^(mailto|tel|sms):/i.test(href)) {
      if (href === '') error(rel, 'empty href');
      continue;
    }
    if (/^http:\/\//i.test(href)) { error(rel, `non-HTTPS link: ${href}`); continue; }
    let path = href;
    if (href.startsWith(site.url + '/')) path = href.slice(site.url.length);
    else if (/^https:\/\//i.test(href) || href.startsWith('//')) continue; // external
    path = path.split(/[?#]/)[0];
    if (!path.startsWith('/')) { error(rel, `relative link "${href}" — use root-relative with trailing slash`); continue; }
    if (path.startsWith('/api/')) continue; // Worker routes, not static pages
    if (!extname(path) && !path.endsWith('/')) { error(rel, `link "${href}" missing trailing slash (would redirect)`); continue; }
    if (!resolveInternal(path)) error(rel, `broken internal link: ${href}`);
  }

  // Local asset references (favicons, images, stylesheets, scripts, OG image)
  const refs = [];
  for (const t of [...tags(body, 'img'), ...tags(body, 'script'), ...tags(body, 'source'), ...tags(body, 'link')]) {
    if (/^<link/i.test(t) && attr(t, 'rel') === 'canonical') continue;
    const src = attr(t, 'src') ?? attr(t, 'href');
    if (src) refs.push(src);
    for (const part of (attr(t, 'srcset') || '').split(',')) if (part.trim()) refs.push(part.trim().split(/\s+/)[0]);
  }
  const og = tags(html, 'meta').find((t) => attr(t, 'property') === 'og:image');
  if (og) {
    const content = attr(og, 'content');
    if (!/^https:\/\//.test(content)) error(rel, 'og:image must be an absolute https URL');
    else if (content.startsWith(site.url + '/')) refs.push(content.slice(site.url.length));
  }
  for (const ref of refs) {
    if (!ref.startsWith('/') || ref.startsWith('//')) continue;
    if (!resolveInternal(ref.split(/[?#]/)[0])) missingAssets.set(ref, [...(missingAssets.get(ref) || []), rel]);
  }

  // JSON-LD
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) error(rel, 'no JSON-LD');
  const types = [];
  for (const [, json] of blocks) {
    try { types.push(JSON.parse(json)['@type']); } catch (e) { error(rel, `JSON-LD does not parse: ${e.message}`); }
  }
  if (!types.some((t) => t && t !== 'BreadcrumbList')) error(rel, 'no LocalBusiness (or subtype) JSON-LD');
  if (p.route !== '/' && !p.noindex && !types.includes('BreadcrumbList')) error(rel, 'inner page missing BreadcrumbList JSON-LD');

  // Production-only rules
  if (/cdn\.tailwindcss\.com/.test(html)) draft(rel, 'Tailwind Play CDN (mockup only)');
  if (/fonts\.(googleapis|gstatic)\.com/.test(html)) draft(rel, 'Google Fonts CDN — self-host WOFF2 instead');
  if (/\btransition-all\b/.test(body)) error(rel, 'uses transition-all');
}

for (const [ref, on] of missingAssets) {
  draft(ref, `missing asset, referenced by ${on.length === pages.length ? 'every page' : on.join(', ')}`);
}

// --- Generated files -----------------------------------------------------------------------
const read = (name) => (existsSync(join(DIST, name)) ? readFileSync(join(DIST, name), 'utf8') : null);

const sitemap = read('sitemap.xml');
if (!sitemap) error('sitemap.xml', 'missing');
else {
  if (!/^<\?xml[^>]*\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(sitemap)) {
    error('sitemap.xml', 'not a valid <urlset> document');
  }
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  const expected = new Set(indexable.map((p) => site.url + p.route));
  for (const loc of locs) {
    if (!expected.has(loc)) error('sitemap.xml', `contains ${loc}, which is not an indexable page`);
  }
  for (const url of expected) if (!locs.includes(url)) error('sitemap.xml', `missing ${url}`);
}

const robots = read('robots.txt');
if (robots !== robotsTxt(site)) error('robots.txt', 'missing or does not match the generator — rebuild');
else if (/^Disallow:\s*\/\s*$/m.test(robots)) error('robots.txt', 'blocks all crawlers');

const llms = read('llms.txt');
if (llms === null) error('llms.txt', 'missing');
else if (llms !== llmsTxt(site)) error('llms.txt', 'does not match site.json — rebuild');

// --- Placeholders anywhere in the output -------------------------------------------------------
for (const f of files.filter((f) => /\.(html|txt|xml|json)$/.test(f))) {
  const count = readFileSync(f, 'utf8').split(PLACEHOLDER).length - 1;
  if (count) draft(relPath(f), `${count} "${PLACEHOLDER}]" marker(s)`);
}

// --- Report --------------------------------------------------------------------------------
for (const w of warnings) console.warn(`warn   ${w}`);
for (const e of errors) console.error(`error  ${e}`);
console.log(`\naudit${preview ? ' --preview' : ''}: ${errors.length} error(s), ${warnings.length} warning(s) across ${pages.length} page(s)`);
process.exit(errors.length ? 1 : 0);
