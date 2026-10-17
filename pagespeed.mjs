import { existsSync } from 'fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node pagespeed.mjs <public-url> [mobile|desktop|both]');
  console.error('Note: url must be publicly reachable — Google cannot fetch localhost.');
  process.exit(1);
}
const strategyArg = process.argv[3] || 'both';
const strategies = strategyArg === 'both' ? ['mobile', 'desktop'] : [strategyArg];

const apiKey = process.env.PAGESPEED_API_KEY;
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

function bar(score) {
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? '\x1b[32m' : pct >= 50 ? '\x1b[33m' : '\x1b[31m';
  return `${color}${pct}\x1b[0m`;
}

function ms(v) {
  return v == null ? 'n/a' : v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(2)}s`;
}

async function run(strategy) {
  const params = new URLSearchParams({ url, strategy });
  for (const c of categories) params.append('category', c);
  if (apiKey) params.set('key', apiKey);

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  const res = await fetch(endpoint);
  const data = await res.json();

  if (!res.ok) {
    console.error(`[${strategy}] Error:`, data.error?.message || res.statusText);
    return;
  }

  const lr = data.lighthouseResult;
  const scores = categories
    .map((c) => `${c}: ${bar(lr.categories[c].score)}`)
    .join('  ');

  const audits = lr.audits;
  const vitals = [
    `LCP ${ms(audits['largest-contentful-paint']?.numericValue)}`,
    `CLS ${audits['cumulative-layout-shift']?.displayValue ?? 'n/a'}`,
    `TBT ${ms(audits['total-blocking-time']?.numericValue)}`,
    `FCP ${ms(audits['first-contentful-paint']?.numericValue)}`,
    `Speed Index ${ms(audits['speed-index']?.numericValue)}`,
  ].join('  ');

  console.log(`\n${strategy.toUpperCase()} — ${url}`);
  console.log(scores);
  console.log(vitals);
}

for (const strategy of strategies) {
  await run(strategy);
}
