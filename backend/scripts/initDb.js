/**
 * Runs every .sql file in /migrations then /seeds, in filename order.
 * Usage: npm run db:init
 *
 * This connects WITHOUT selecting a database first (since migration 001
 * creates it), using the same credentials as the app's .env file.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

async function runSqlFile(connection, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  process.stdout.write(`  -> ${path.basename(filePath)} ... `);
  await connection.query(sql);
  console.log('done');
}

async function runDirectory(connection, dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await runSqlFile(connection, path.join(dirPath, file));
  }
}

async function main() {
  console.log(`Connecting to MySQL at ${config.host}:${config.port} as ${config.user} ...`);
  const connection = await mysql.createConnection(config);

  try {
    console.log('Running migrations:');
    await runDirectory(connection, path.join(__dirname, '..', 'migrations'));

    console.log('Running seeds:');
    await runDirectory(connection, path.join(__dirname, '..', 'seeds'));

    console.log('\nDatabase initialized successfully.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('\nDatabase initialization failed:');
  console.error(err.message);
  process.exit(1);
});
