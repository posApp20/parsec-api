/**
 * Email Check Price Controller
 * GET /api/email-check-price
 * 
 * Obtiene el precio y límites para validación de emails
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Handler para obtener precio de validación de email
 */
async function getEmailCheckPrice(req, res) {
  try {
    const userId = req.user.id;

    logger.info(`[EMAIL_PRICE] User ${userId} checking email price`);

    // 1. Obtener información del usuario
    const userResult = await pool.query(
      'SELECT id, balance FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];
    const emailCheckCost = parseFloat(process.env.EMAIL_CHECK_COST || '0.10');
    const maxEmailsPerCheck = parseInt(process.env.MAX_EMAILS_PER_CHECK || '50');

    // 2. Retornar respuesta
    res.json({
      success: true,
      price: emailCheckCost.toFixed(2),
      currency: 'USD',
      userBalance: parseFloat(user.balance).toFixed(2),
      maxEmailsPerCheck: maxEmailsPerCheck,
      userID: user.id
    });

  } catch (error) {
    logger.error('[EMAIL_PRICE ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { getEmailCheckPrice };
