require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.execute('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map(r => r.version));

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace('.sql', '');
    if (applied.has(version)) {
      console.log(`SKIP: ${version}`);
      continue;
    }
    console.log(`RUN: ${version}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await connection.execute(sql);
    await connection.execute('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
    console.log(`DONE: ${version}`);
  }

  await connection.end();
  console.log('All migrations complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});