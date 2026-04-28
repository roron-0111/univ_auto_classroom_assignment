import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

const port = Number(process.env.PORT || 4173);
const rootDir = join(process.cwd(), 'dist');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const send = (res, statusCode, body, contentType = 'text/plain; charset=utf-8') => {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(rootDir, pathname));

    if (!filePath.startsWith(rootDir)) {
      send(res, 403, 'Forbidden');
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        const indexPath = join(filePath, 'index.html');
        const html = await readFile(indexPath);
        send(res, 200, html, 'text/html; charset=utf-8');
        return;
      }
      const data = await readFile(filePath);
      send(res, 200, data, mimeTypes[extname(filePath)] || 'application/octet-stream');
      return;
    } catch {
      const html = await readFile(join(rootDir, 'index.html'));
      send(res, 200, html, 'text/html; charset=utf-8');
    }
  } catch (error) {
    send(res, 500, `Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Static server listening on http://127.0.0.1:${port}`);
});
