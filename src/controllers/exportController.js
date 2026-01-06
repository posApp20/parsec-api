/**
 * File Export Controller
 * POST /api/send-file-to-production
 * 
 * Procesa exportación de datos a archivo
 */

const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Handler para enviar archivo a producción
 */
async function sendFileToProduction(req, res) {
  try {
    const { results, query, count } = req.body;
    const userId = req.user.id;

    logger.info(`[FILE_EXPORT] User ${userId} exporting ${count || 0} results`);

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No results provided'
      });
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query required'
      });
    }

    // 1. Generar ID único para el archivo
    const fileId = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const processedAt = new Date().toISOString();

    // 2. Determinar ubicación de almacenamiento (simulado)
    // En producción sería S3, servidor local, etc.
    const location = `/exports/${fileId}.json`;

    // 3. Registrar en BD
    try {
      await pool.query(
        `INSERT INTO exports (file_id, user_id, query, result_count, location, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          fileId,
          userId,
          query,
          results.length,
          location
        ]
      );
      logger.info(`[FILE_EXPORT] Registered export ${fileId}`);
    } catch (dbError) {
      logger.error('[FILE_EXPORT DB ERROR]', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to register export'
      });
    }

    // 4. Preparar datos para exportación
    const exportData = {
      fileId: fileId,
      query: query,
      resultCount: results.length,
      processedAt: processedAt,
      results: results.map(r => ({
        id: r[0],
        firstName: r[1],
        lastName: r[2],
        middleNames: r[3],
        aka: r[4],
        dob: r[5],
        address: r[6],
        city: r[7],
        county: r[8],
        state: r[9],
        zip: r[10],
        ssn: r[19]
      }))
    };

    logger.info(`[FILE_EXPORT] Successfully created export ${fileId}`);

    // 5. Retornar respuesta
    res.json({
      success: true,
      fileId: fileId,
      location: location,
      resultCount: results.length,
      query: query,
      processedAt: processedAt,
      downloadUrl: `/api/download-export/${fileId}`
    });

  } catch (error) {
    logger.error('[FILE_EXPORT ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Handler para descargar archivo exportado
 */
async function downloadExport(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    logger.info(`[FILE_DOWNLOAD] User ${userId} downloading ${fileId}`);

    // 1. Verificar que el archivo existe y pertenece al usuario
    const result = await pool.query(
      'SELECT * FROM exports WHERE file_id = $1 AND user_id = $2',
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export not found or access denied'
      });
    }

    const exportRecord = result.rows[0];

    // 2. Preparar datos para descarga
    const downloadData = {
      fileId: exportRecord.file_id,
      query: exportRecord.query,
      resultCount: exportRecord.result_count,
      location: exportRecord.location,
      createdAt: exportRecord.created_at
    };

    // 3. Retornar como JSON descargable
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileId}.json"`);
    res.json(downloadData);

  } catch (error) {
    logger.error('[FILE_DOWNLOAD ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { sendFileToProduction, downloadExport };
