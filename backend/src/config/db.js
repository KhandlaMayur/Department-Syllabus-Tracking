const mysql = require('mysql2/promise');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * Shared MySQL connection pool.
 * Import `pool` anywhere a query is needed — never open ad-hoc connections.
 */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: true,
});

/**
 * Verifies the database is reachable. Called once at server startup so we
 * fail fast with a clear message instead of erroring on the first request.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info(`Connected to MySQL database "${config.db.database}" at ${config.db.host}:${config.db.port}`);
    return true;
  } catch (err) {
    logger.error(`Failed to connect to MySQL: ${err.message}`);
    return false;
  }
}

module.exports = { pool, testConnection };
