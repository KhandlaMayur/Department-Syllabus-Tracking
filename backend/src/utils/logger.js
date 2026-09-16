/**
 * Minimal dependency-free logger with timestamps and levels.
 * Swap this out for winston/pino later without touching call sites,
 * since every module only imports { info, warn, error, debug } from here.
 */
const levels = {
  info: '\x1b[36mINFO\x1b[0m',
  warn: '\x1b[33mWARN\x1b[0m',
  error: '\x1b[31mERROR\x1b[0m',
  debug: '\x1b[90mDEBUG\x1b[0m',
};

function timestamp() {
  return new Date().toISOString();
}

function log(level, message) {
  const label = levels[level] || level;
  // eslint-disable-next-line no-console
  console.log(`[${timestamp()}] ${label} ${message}`);
}

module.exports = {
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
  debug: (msg) => {
    if (process.env.NODE_ENV !== 'production') log('debug', msg);
  },
};
