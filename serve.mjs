import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.mjs':'application/javascript' };
createServer(async (req, res) => {
  let path = req.url === '/' ? '/index.html' : req.url;
  try {
    const data = await readFile(join(__dirname, path));
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(3000, () => console.log('Server running at http://localhost:3000'));
