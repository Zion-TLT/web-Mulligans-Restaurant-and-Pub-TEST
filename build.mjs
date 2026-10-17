// Assembles src/ into dist/: renders pages through the shared partials, compiles Tailwind,
// copies static files, and generates sitemap.xml, robots.txt, and llms.txt from site.json.
//
// Page files are an optional front-matter block followed by the <main> content:
//   ---
//   title: About Us | {{ site.name }}
//   description: 110–155 characters…
//   breadcrumb: About          (optional, defaults to the nav label)
//   noindex: true              (optional, 404.html is always noindex)
//   ogImage: /assets/about.jpg (optional, defaults to site.ogImage)
//   ---
// Template syntax: {{> partial }}, {{ escaped.value }}, {{{ raw.html }}}
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  ROOT, SRC, DIST, loadSite, escapeHtml, telHref, hoursLines, absUrl,
  businessJsonLd, breadcrumbJsonLd, llmsTxt, robotsTxt, sitemapXml,
} from './lib/site.mjs';

const INLINE_CSS_LIMIT = 20 * 1024;
const site = loadSite();
site.telHref = telHref(site.phone);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    data[kv[1]] = kv[2] === 'true' ? true : kv[2] === 'false' ? false : kv[2];
  }
  return { data, body: text.slice(m[0].length) };
}

const lookup = (ctx, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);

function render(template, ctx, file, depth = 0, { escape = true } = {}) {
  if (depth > 10) throw new Error(`${file}: partials nested too deep`);
  return template
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      const p = join(SRC, '_partials', `${name}.html`);
      if (!existsSync(p)) throw new Error(`${file}: unknown partial "${name}"`);
      return render(readFileSync(p, 'utf8'), ctx, `_partials/${name}.html`, depth + 1);
    })
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (_, raw, esc) => {
      const value = lookup(ctx, raw || esc);
      if (value === undefined) throw new Error(`${file}: unknown variable "${raw || esc}"`);
      return raw || !escape ? String(value) : escapeHtml(value);
    });
}

const routeFor = (file) => {
  const rel = relative(SRC, file).split(sep).join('/');
  return rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -10)}` : `/${rel}`;
};

function compileCss() {
  const bin = join(ROOT, 'node_modules', '.bin', 'tailwindcss');
  const css = execFileSync(bin, ['-i', join(SRC, 'styles.css'), '--minify'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (Buffer.byteLength(css) <= INLINE_CSS_LIMIT) return `<style>${css}</style>`;
  const name = `styles.${createHash('sha256').update(css).digest('hex').slice(0, 10)}.css`;
  mkdirSync(join(DIST, 'assets'), { recursive: true });
  writeFileSync(join(DIST, 'assets', name), css);
  return `<link rel="stylesheet" href="/assets/${name}">`;
}

function navHtml(route, { current }) {
  return site.nav.map((item) => {
    const active = current && item.href === route ? ' aria-current="page"' : '';
    return `<li><a href="${escapeHtml(item.href)}"${active}>${escapeHtml(item.label)}</a></li>`;
  }).join('');
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const css = compileCss();
const sourceFiles = walk(SRC).filter((f) => {
  const rel = relative(SRC, f).split(sep);
  return !rel.some((part) => part.startsWith('_') || part.startsWith('.')) || ['_headers', '_redirects'].includes(rel.join('/'));
});

const layout = readFileSync(join(SRC, '_partials', 'layout.html'), 'utf8');
const shared = {
  site,
  css,
  year: new Date().getFullYear(),
  phoneLink: `<a href="${escapeHtml(site.telHref)}">${escapeHtml(site.phone)}</a>`,
  emailLink: `<a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a>`,
  addressHtml: [site.address.street, [site.address.city, site.address.region].filter(Boolean).join(', ') + ' ' + (site.address.postalCode || '')]
    .filter((s) => s && s.trim()).map((s) => escapeHtml(s.trim())).join('<br>'),
  hoursHtml: `<ul>${hoursLines(site).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`,
  serviceAreaHtml: `<ul>${(site.serviceArea || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`,
  servicesHtml: (site.services || []).map((s) =>
    `<section id="${escapeHtml(s.slug)}" aria-labelledby="${escapeHtml(s.slug)}-heading"><h2 id="${escapeHtml(s.slug)}-heading">${escapeHtml(s.name)}</h2><p>${escapeHtml(s.summary)}</p></section>`).join(''),
  socialHtml: (site.social || []).length
    ? `<ul>${site.social.map((s) => `<li><a href="${escapeHtml(s.url)}" rel="noopener">${escapeHtml(s.name)}</a></li>`).join('')}</ul>`
    : '',
};

const indexable = [];
for (const file of sourceFiles) {
  const rel = relative(SRC, file);
  if (rel === 'styles.css') continue;
  const out = join(DIST, rel);
  mkdirSync(dirname(out), { recursive: true });
  if (!file.endsWith('.html')) { copyFileSync(file, out); continue; }

  const route = routeFor(file);
  const { data, body } = parseFrontMatter(readFileSync(file, 'utf8'));
  const page = { route, ...data };
  for (const key of ['title', 'description', 'breadcrumb']) {
    if (typeof page[key] === 'string') page[key] = render(page[key], { site }, rel, 0, { escape: false });
  }
  if (!page.title || !page.description) throw new Error(`${rel}: front matter needs title and description`);
  if (route === '/404.html') page.noindex = true;

  const navItem = site.nav.find((n) => n.href === route);
  const ldBlocks = [businessJsonLd(site)];
  if (route !== '/' && !page.noindex) ldBlocks.push(breadcrumbJsonLd(site, route, page.breadcrumb || navItem?.label || page.title));

  const ctx = {
    ...shared,
    page: { ...page, url: absUrl(site, route), ogImage: absUrl(site, page.ogImage || site.ogImage) },
    navLinks: navHtml(route, { current: true }),
    footerLinks: navHtml(route, { current: false }),
    canonicalTag: page.noindex ? '' : `<link rel="canonical" href="${escapeHtml(absUrl(site, route))}">`,
    robotsTag: page.noindex ? '<meta name="robots" content="noindex">' : '',
    jsonLd: ldBlocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`).join('\n'),
  };
  ctx.content = render(body, ctx, rel);
  writeFileSync(out, render(layout, ctx, rel));
  if (!page.noindex) indexable.push(route);
}

indexable.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml(site, indexable));
writeFileSync(join(DIST, 'robots.txt'), robotsTxt(site));
writeFileSync(join(DIST, 'llms.txt'), llmsTxt(site));

console.log(`Built ${indexable.length} indexable page(s) + 404 → dist/ (CSS ${css.startsWith('<style>') ? 'inlined' : 'linked'})`);
