/**
 * Express Application Setup
 * Configures middleware chain: CORS, Helmet, JSON parsing, API routes, and error handling.
 */

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { toWIBISOString } from './utils/wibDate.js';

// Enforce Asia/Jakarta in process environment
process.env.TZ = 'Asia/Jakarta';

const app = express();

// Security & Parsing Middlewares
app.use(cors({
  origin: [
    env.clientUrl,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Safe helmet import
try {
  const helmetModule = await import('helmet');
  const helmet = helmetModule.default || helmetModule;
  if (typeof helmet === 'function') {
    app.use(helmet({
      crossOriginResourcePolicy: false
    }));
  }
} catch {
  // Helmet optional in fallback environments
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in dev
if (env.devMode) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// Mount Central API Router
app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'TataDana API',
    tagline: 'Manajemen Keuangan Pribadi Multimodal Berbasis Telegram & Web',
    version: '1.0.0',
    status: 'online',
    timestamp: toWIBISOString(),
    docs: '/api/health'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
      timestamp: toWIBISOString()
    }
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
