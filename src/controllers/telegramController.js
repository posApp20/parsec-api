/**
 * Telegram Export Controller
 * POST /api/send-to-telegram
 * 
 * Envía resultados de búsqueda a Telegram
 */

const pool = require('../config/database');
const logger = require('../utils/logger');
const https = require('https');

/**
 * Enviar mensaje a Telegram usando Bot API
 */
function sendToTelegram(message) {
  return new Promise((resolve, reject) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      logger.warn('[TELEGRAM] Bot token or chat ID not configured');
      resolve({ success: false, message: 'Telegram not configured' });
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const postData = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.ok) {
            resolve({
              success: true,
              messageId: response.result.message_id
            });
          } else {
            reject(new Error(response.description));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Formatear resultados para mensaje Telegram
 */
function formatResultsForTelegram(results, query, count) {
  let message = `<b>📊 Search Results</b>\n`;
  message += `<b>Query:</b> ${query}\n`;
  message += `<b>Results Found:</b> ${count}\n\n`;

  if (results.length === 0) {
    message += 'No results found.';
  } else {
    // Mostrar primeros 5 resultados (máximo)
    const limit = Math.min(results.length, 5);
    for (let i = 0; i < limit; i++) {
      const r = results[i];
      message += `<b>${i + 1}.</b> ${r[1] || ''} ${r[2] || ''}\n`;
      if (r[6]) message += `   📍 ${r[6]}\n`;
      if (r[7] && r[9]) message += `   🏙 ${r[7]}, ${r[9]} ${r[10] || ''}\n`;
      message += '\n';
    }
    
    if (results.length > 5) {
      message += `... and ${results.length - 5} more results\n`;
    }
  }

  message += `<i>Sent at ${new Date().toISOString()}</i>`;
  return message;
}

/**
 * Handler para enviar a Telegram
 */
async function sendToTelegram_Handler(req, res) {
  try {
    const { results, query, count } = req.body;
    const userId = req.user.id;

    logger.info(`[TELEGRAM] User ${userId} sending ${count || 0} results to Telegram`);

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

    // 1. Formatear mensaje
    const message = formatResultsForTelegram(results, query, count || results.length);

    // 2. Enviar a Telegram
    let telegramResponse;
    try {
      telegramResponse = await sendToTelegram(message);
    } catch (error) {
      logger.error('[TELEGRAM SEND ERROR]', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send to Telegram',
        details: error.message
      });
    }

    if (!telegramResponse.success) {
      return res.status(500).json({
        success: false,
        error: 'Telegram service not configured'
      });
    }

    // 3. Registrar en BD
    try {
      await pool.query(
        `INSERT INTO exports (file_id, user_id, query, result_count, location)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `telegram_${Date.now()}`,
          userId,
          query,
          results.length,
          'telegram'
        ]
      );
    } catch (dbError) {
      logger.warn('[TELEGRAM DB INSERT]', dbError);
      // Continuar aunque no se registre
    }

    logger.info(`[TELEGRAM] Successfully sent to Telegram. Message ID: ${telegramResponse.messageId}`);

    // 4. Retornar respuesta
    res.json({
      success: true,
      message: 'Results sent to Telegram successfully',
      messageId: telegramResponse.messageId,
      resultCount: results.length,
      query: query
    });

  } catch (error) {
    logger.error('[TELEGRAM ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { sendToTelegram: sendToTelegram_Handler };
