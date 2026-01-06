const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./src/utils/logger');
const pool = require('./src/config/database');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============

// Seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: '*',  // En producción, especificar dominios
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsear JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ============ RUTAS ============

// Rutas públicas
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Parsec API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Todas las rutas de API
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found',
    path: req.path
  });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============ INICIAR SERVIDOR ============

const server = app.listen(PORT, () => {
  logger.info(`[SERVER] API running on http://localhost:${PORT}`);
  logger.info(`[SERVER] Environment: ${process.env.NODE_ENV}`);
  logger.info(`[SERVER] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[SERVER] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('[SERVER] HTTP server closed');
    pool.end(() => {
      logger.info('[DB] Connection pool closed');
      process.exit(0);
    });
  });
});

module.exports = app;
