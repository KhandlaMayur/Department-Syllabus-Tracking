const app = require('./app');
const config = require('./config/env');
const { testConnection } = require('./config/db');
const logger = require('./utils/logger');

async function start() {
  await testConnection(); // logs a warning but doesn't block startup

  const server = app.listen(config.port, () => {
    logger.info(`Syllabus Tracker API listening on http://localhost:${config.port}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Health check: http://localhost:${config.port}/api/${config.apiVersion}/health`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}

start();
