const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * HTTP access logging. Pipes morgan's output through our own logger so
 * every log line (app + access) shares the same format and timestamp.
 */
const stream = {
  write: (message) => logger.info(message.trim()),
};

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

module.exports = morgan(format, { stream });
