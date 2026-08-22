const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('./db/node_modules/mysql2/promise');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT || '3306'),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    return;
  }

  if (req.method === 'POST' && req.url === '/submit') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const params = new URLSearchParams(body);
        const name = (params.get('name') || '').trim();
        const description = (params.get('description') || '').trim();
        if (!name || !description) throw new Error('Name and description are required.');
        await pool.execute(
          'INSERT INTO items (name, description) VALUES (?, ?)',
          [name.slice(0, 255), description]
        );
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Saved!');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(3000, () => console.log('Running at http://localhost:3000'));
