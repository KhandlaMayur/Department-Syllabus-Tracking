const { pool } = require('../config/db');
const catchAsync = require('../utils/catchAsync');

/**
 * GET /api/v1/health
 * Lightweight liveness + DB connectivity check for uptime monitoring
 * and for the frontend to confirm the API is reachable.
 */
const healthCheck = catchAsync(async (req, res) => {
  let dbStatus = 'down';
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dbStatus = 'up';
  } catch (err) {
    dbStatus = 'down';
  }

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbStatus,
    },
  });
});

module.exports = { healthCheck };
