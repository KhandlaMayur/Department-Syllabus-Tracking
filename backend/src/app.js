const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const v1Routes = require('./routes/v1');

const app = express();

// --- Security & parsing ---
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
  config.clientUrl?.replace(/\/$/, ''),
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Logging ---
app.use(requestLogger);

// --- Root ---
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Syllabus Tracker API',
      version: config.apiVersion,
      status: 'running',
    },
  });
});

// --- Versioned API ---
app.use(`/api/${config.apiVersion}`, v1Routes);

// --- 404 + error handling (always last) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
