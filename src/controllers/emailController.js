/**
 * Email Validation Controller
 * POST /api/validate-email
 * 
 * Valida direcciones de correo electrónico
 * Primero checa cache de 90 días
 * Si no está en cache, simula validación externa
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Simular validación de email (en producción sería una API externa)
 * Basado en patrones observados en parsec.js
 */
function simulateEmailValidation(email) {
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', '10minutemail.com',
    'guerrillamail.com', 'mailinator.com', 'temp-mail.org'
  ];
  
  const roleBases = [
    'admin@', 'info@', 'support@', 'help@', 'sales@',
    'contact@', 'hello@', 'noreply@', 'no-reply@'
  ];

  const domain = email.split('@')[1]?.toLowerCase() || '';
  const localPart = email.split('@')[0]?.toLowerCase() || '';
  
  // Validación básica
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      status: 'Invalid',
      reason: 'Invalid email format',
      catchAll: false,
      disposable: false,
      roleBased: false,
      freeDomain: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)
    };
  }

  // Detectar rol-based
  let isRoleBased = false;
  for (const prefix of roleBases) {
    if (localPart.startsWith(prefix.split('@')[0])) {
      isRoleBased = true;
      break;
    }
  }

  // Detectar disposable
  const isDisposable = disposableDomains.includes(domain);
  
  // Detectar free domain
  const isFreeDomain = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 
                        'yandex.com', 'mail.com'].includes(domain);

  // Simular validación (en la vida real sería con una API)
  // Para este ejemplo, considerar válido si cumple formato
  const valid = !isDisposable && !isRoleBased;
  
  const status = isDisposable ? 'Disposable' : 
                 isRoleBased ? 'Role Based' :
                 valid ? 'Valid' : 'Unknown';

  return {
    valid: valid,
    status: status,
    reason: valid ? 'Email is valid' : `Email is ${status}`,
    catchAll: Math.random() > 0.8, // Simular catch-all aleatorio
    disposable: isDisposable,
    roleBased: isRoleBased,
    freeDomain: isFreeDomain
  };
}

/**
 * Handler para validación de email
 */
async function validateEmail(req, res) {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    logger.info(`[EMAIL_VALIDATION] User ${userId} validating: ${email}`);

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid email parameter'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // 1. Buscar en cache
    const cacheResult = await pool.query(
      `SELECT * FROM email_cache 
       WHERE email = $1 AND expires_at > NOW()`,
      [normalizedEmail]
    );

    if (cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];
      logger.info(`[EMAIL_VALIDATION] Cache hit for ${email}`);
      
      return res.json({
        success: true,
        email: normalizedEmail,
        valid: cached.is_valid,
        status: cached.status,
        reason: cached.status,
        catchAll: cached.catch_all,
        disposable: cached.disposable,
        roleBased: cached.role_based,
        freeDomain: cached.free_domain,
        cached: true
      });
    }

    // 2. Obtener usuario y validar balance
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
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

    // 3. Validar saldo
    if (parseFloat(user.balance) < emailCheckCost) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient balance for email validation',
        cost: emailCheckCost,
        balance: user.balance
      });
    }

    // 4. Realizar validación (simulada)
    const validation = simulateEmailValidation(normalizedEmail);

    // 5. Descontar crédito
    const newBalance = parseFloat(user.balance) - emailCheckCost;
    await pool.query(
      'UPDATE users SET balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // 6. Guardar en cache (90 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await pool.query(
      `INSERT INTO email_cache 
       (email, is_valid, status, catch_all, disposable, role_based, free_domain, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        normalizedEmail,
        validation.valid,
        validation.status,
        validation.catchAll,
        validation.disposable,
        validation.roleBased,
        validation.freeDomain,
        expiresAt
      ]
    );

    logger.info(`[EMAIL_VALIDATION] Validated ${email}. Cost: ${emailCheckCost}. Balance: ${newBalance}`);

    // 7. Retornar respuesta
    res.json({
      success: true,
      email: normalizedEmail,
      valid: validation.valid,
      status: validation.status,
      reason: validation.reason,
      catchAll: validation.catchAll,
      disposable: validation.disposable,
      roleBased: validation.roleBased,
      freeDomain: validation.freeDomain,
      cached: false,
      remainingBalance: newBalance.toFixed(2)
    });

  } catch (error) {
    logger.error('[EMAIL_VALIDATION ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { validateEmail };
