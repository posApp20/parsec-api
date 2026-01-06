/**
 * API Routes
 * Todas las rutas de la API
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Controladores
const { search } = require('../controllers/searchController');
const { validateEmail } = require('../controllers/emailController');
const { getEmailCheckPrice } = require('../controllers/priceController');
const { sendToTelegram } = require('../controllers/telegramController');
const { sendFileToProduction, downloadExport } = require('../controllers/exportController');
const { insertPerson, insertBatch } = require('../controllers/insertController');

// Rutas públicas
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas protegidas (requieren token JWT)
// POST /api/search - Búsqueda de personas
router.post('/search', verifyToken, search);

// POST /api/validate-email - Validar email
router.post('/validate-email', verifyToken, validateEmail);

// GET /api/email-check-price - Obtener precio de validación de email
router.get('/email-check-price', verifyToken, getEmailCheckPrice);

// POST /api/send-to-telegram - Enviar resultados a Telegram
router.post('/send-to-telegram', verifyToken, sendToTelegram);

// POST /api/send-file-to-production - Exportar archivo
router.post('/send-file-to-production', verifyToken, sendFileToProduction);

// GET /api/download-export/:fileId - Descargar archivo exportado
router.get('/download-export/:fileId', verifyToken, downloadExport);

// POST /api/insert-person - Insertar una persona
router.post('/insert-person', verifyToken, insertPerson);

// POST /api/insert-batch - Insertar múltiples personas en bulk
router.post('/insert-batch', verifyToken, insertBatch);

// Manejo de rutas no encontradas
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

module.exports = router;
