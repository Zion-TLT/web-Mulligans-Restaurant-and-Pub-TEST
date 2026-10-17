// Shared helpers for build.mjs and audit.mjs. Everything derived from site.json lives here
// so the build output and the audit's expectations can never drift apart.
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = join(ROOT, 'src');
export const DIST = join(ROOT, 'dist');
export const PLACEHOLDER = '[CLIENT TO PROVIDE';

export function loadSite() {
  const site = JSON.parse(readFileSync(join(SRC, '_data', 'site.json'), 'utf8'));
  site.url = site.url.replace(/\/+$/, '');
  return site;
}

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// "(555) 123-4567" → "+15551234567". Assumes NANP for 10-digit numbers; anything already
// starting with "+" is kept as-is. Non-numeric placeholders pass through so the audit flags them.
export function telHref(phone) {
  const trimmed = String(phone).trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && digits.length >= 8) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  return `tel:${trimmed}`;
}

// "08:00" → "8:00 AM"
export function formatTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m) return t || '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function hoursLines(site) {
  return (site.hours || []).map((h) =>
    h.closed ? `${h.label}: Closed`
      : h.opens && h.closes ? `${h.label}: ${formatTime(h.opens)} – ${formatTime(h.closes)}`
        : h.label);
}

export function addressLine(site) {
  const a = site.address || {};
  return [a.street, a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// Route "/about/" → absolute canonical URL
export const absUrl = (site, route) => site.url + route;

export function businessJsonLd(site) {
  const a = site.address || {};
  const ld = {
    '@context': 'https://schema.org',
    '@type': site.businessType || 'LocalBusiness',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: `${site.url}/`,
    telephone: telHref(site.phone).slice(4),
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: a.city,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.country,
    },
  };
  if (site.serviceArea?.length) ld.areaServed = site.serviceArea;
  const hours = (site.hours || []).filter((h) => h.days?.length && h.opens && h.closes && !h.closed);
  if (hours.length) {
    ld.openingHoursSpecification = hours.map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes,
    }));
  }
  if (site.logo) ld.logo = absUrl(site, site.logo);
  if (site.ogImage) ld.image = absUrl(site, site.ogImage);
  const sameAs = (site.social || []).map((s) => s.url).filter(Boolean);
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}

export function breadcrumbJsonLd(site, route, name) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absUrl(site, '/') },
      { '@type': 'ListItem', position: 2, name, item: absUrl(site, route) },
    ],
  };
}

// llmstxt.org format, generated purely from site.json
export function llmsTxt(site) {
  const lines = [`# ${site.name}`, '', `> ${site.summary}`, ''];
  lines.push('## Services', '');
  for (const s of site.services || []) {
    lines.push(`- [${s.name}](${absUrl(site, `/services/#${s.slug}`)}): ${s.summary}`);
  }
  lines.push('', '## Service Area', '');
  for (const area of site.serviceArea || []) lines.push(`- ${area}`);
  lines.push('', '## Hours', '');
  for (const h of hoursLines(site)) lines.push(`- ${h}`);
  lines.push('', '## Contact', '');
  lines.push(`- Phone: ${site.phone}`, `- Email: ${site.email}`, `- Address: ${addressLine(site)}`);
  lines.push('', '## Key Pages', '');
  for (const item of site.nav || []) lines.push(`- [${item.label}](${absUrl(site, item.href)})`);
  return lines.join('\n') + '\n';
}

export function robotsTxt(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`;
}

export function sitemapXml(site, routes) {
  const urls = routes.map((r) => `  <url><loc>${escapeHtml(absUrl(site, r))}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
