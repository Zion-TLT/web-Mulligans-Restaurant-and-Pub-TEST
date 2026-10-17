// Local static server for dist/ — mirrors Workers static-asset routing closely enough for
// screenshots: /about/ → about/index.html, /about → 307 /about/, unknown paths → 404.html
// with a 404 status. It does NOT run the Worker; use `npx wrangler dev` to test /api/* routes.
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

if (!existsSync(root)) {
  console.error('dist/ not found — run `node build.mjs` first');
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;
const isFile = (p) => stat(p).then((s) => s.isFile(), () => false);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) {
    res.writeHead(501, { 'Content-Type': 'text/plain' });
    return res.end('API routes run in the Worker — use `npx wrangler dev` to test them.');
  }
  const file = normalize(join(root, decodeURIComponent(pathname)));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }

  let target = pathname.endsWith('/') ? join(file, 'index.html') : file;
  if (!pathname.endsWith('/') && !extname(pathname) && await isFile(join(file, 'index.html'))) {
    res.writeHead(307, { Location: `${pathname}/` });
    return res.end();
  }
  let status = 200;
  if (!await isFile(target)) { target = join(root, '404.html'); status = 404; }
  try {
    const data = await readFile(target);
    res.writeHead(status, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}`));
