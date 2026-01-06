/**
 * Search Controller
 * POST /api/search
 * 
 * Búsqueda principal de personas en la base de datos
 * Parsea query formato: "John.Doe.30305" o "John,Johnny.Doe,Doer.30305,30306"
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Parsear query en columnas
 * Formato: "firstName.lastName.zip" o "firstName1,firstName2.lastName1,lastName2.zip1,zip2"
 */
function parseQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query format');
  }

  const parts = query.split('.');
  
  // col1 = nombres (separados por comas)
  const col1 = parts[0] ? parts[0].split(',').map(n => n.trim().toUpperCase()).filter(n => n) : [];
  
  // col2 = apellidos (separados por comas)
  const col2 = parts[1] ? parts[1].split(',').map(n => n.trim().toUpperCase()).filter(n => n) : [];
  
  // col10 = ZIP codes (separados por comas)
  const col10 = parts[2] ? parts[2].split(',').map(z => z.trim()).filter(z => /^\d{5}$/.test(z)) : [];

  return {
    col1,
    col2,
    col10,
    raw: query
  };
}

/**
 * Construir query SQL dinámicamente
 */
function buildSearchQuery(parsed) {
  const params = [];
  const whereConditions = [];

  // Búsqueda por nombres (col1)
  if (parsed.col1.length > 0) {
    const nameOrConditions = [];
    for (const name of parsed.col1) {
      params.push(`${name}%`);
      nameOrConditions.push(`first_name ILIKE $${params.length}`);
    }
    whereConditions.push(`(${nameOrConditions.join(' OR ')})`);
  }

  // Búsqueda por apellidos (col2)
  if (parsed.col2.length > 0) {
    const lastNameOrConditions = [];
    for (const name of parsed.col2) {
      params.push(`${name}%`);
      lastNameOrConditions.push(`last_name ILIKE $${params.length}`);
    }
    whereConditions.push(`(${lastNameOrConditions.join(' OR ')})`);
  }

  // Búsqueda por ZIP (col10)
  if (parsed.col10.length > 0) {
    const zipOrConditions = [];
    for (const zip of parsed.col10) {
      params.push(zip);
      zipOrConditions.push(`zip = $${params.length}`);
    }
    whereConditions.push(`(${zipOrConditions.join(' OR ')})`);
  }

  let sqlQuery = 'SELECT * FROM people_data WHERE 1=1';
  
  if (whereConditions.length > 0) {
    sqlQuery += ' AND ' + whereConditions.join(' AND ');
  }

  sqlQuery += ' LIMIT 100';

  return { query: sqlQuery, params };
}

/**
 * Convertir resultado de BD al formato de API (array de 20 elementos)
 */
function formatResult(row) {
  let dobFormatted = '';
  if (row.dob) {
    if (typeof row.dob === 'string') {
      dobFormatted = row.dob.replace(/-/g, '');
    } else if (row.dob instanceof Date) {
      dobFormatted = row.dob.toISOString().split('T')[0].replace(/-/g, '');
    }
  }

  return [
    row.id.toString(),                              // [0] ID
    row.first_name || '',                           // [1] Nombre
    row.last_name || '',                            // [2] Apellido
    row.middle_names || '',                         // [3] Otros nombres
    row.aka || '',                                  // [4] Alias
    dobFormatted,                                   // [5] DOB (yyyymmdd)
    row.address || '',                              // [6] Dirección
    row.city || '',                                 // [7] Ciudad
    row.county || '',                               // [8] Condado
    row.state || '',                                // [9] Estado
    row.zip || '',                                  // [10] ZIP
    '',                                             // [11] Reservado
    '',                                             // [12] Reservado
    '',                                             // [13] Reservado
    '',                                             // [14] Reservado
    '',                                             // [15] Reservado
    '',                                             // [16] Reservado
    '',                                             // [17] Reservado
    '',                                             // [18] Reservado
    row.ssn || ''                                   // [19] SSN
  ];
}

/**
 * Handler principal para búsqueda
 */
async function search(req, res) {
  try {
    const { query } = req.body;
    const userId = req.user.id;
    
    logger.info(`[SEARCH] User ${userId} querying: ${query}`);

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameter'
      });
    }

    // 1. Parsear query
    let parsed;
    try {
      parsed = parseQuery(query);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query format. Expected: "FirstName.LastName.ZIP"'
      });
    }

    // 2. Validar que haya al menos un criterio de búsqueda
    if (parsed.col1.length === 0 && parsed.col2.length === 0 && parsed.col10.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one search criterion required (name, lastname, or zip)'
      });
    }

    // 3. Obtener usuario y validar saldo
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
    let usedPaid = false;
    let newBalance = parseFloat(user.balance);
    let newFreeSearches = user.free_searches;

    // 4. Descontar búsqueda (gratuita o pagada)
    if (user.free_searches > 0) {
      // Usar búsqueda gratuita
      newFreeSearches--;
      await pool.query(
        'UPDATE users SET free_searches = $1 WHERE id = $2',
        [newFreeSearches, userId]
      );
      logger.info(`[SEARCH] Used free search. Remaining: ${newFreeSearches}`);
    } else if (user.balance >= parseFloat(process.env.SEARCH_COST || '0.50')) {
      // Usar créditos pagados
      const cost = parseFloat(process.env.SEARCH_COST || '0.50');
      newBalance -= cost;
      usedPaid = true;
      await pool.query(
        'UPDATE users SET balance = $1 WHERE id = $2',
        [newBalance, userId]
      );
      logger.info(`[SEARCH] Used paid search. Cost: ${cost}. Balance: ${newBalance}`);
    } else {
      return res.status(402).json({
        success: false,
        error: 'Insufficient balance for search',
        remainingBalance: user.balance,
        remainingFreeSearches: user.free_searches
      });
    }

    // 5. Ejecutar búsqueda en BD
    const { query: sqlQuery, params } = buildSearchQuery(parsed);
    const searchResult = await pool.query(sqlQuery, params);
    const rows = searchResult.rows;

    // 6. Formatear resultados al formato de API original
    const formattedResults = rows.map(formatResult);
    const isTruncated = rows.length >= 100;

    // 7. Registrar búsqueda en logs
    await pool.query(
      `INSERT INTO search_logs (user_id, query, result_count, used_paid_balance, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        query,
        formattedResults.length,
        usedPaid,
        req.ip,
        req.get('user-agent') || ''
      ]
    );

    // 8. Retornar respuesta en formato de API original
    res.json({
      success: true,
      count: formattedResults.length,
      results: formattedResults,
      truncated: isTruncated,
      query: query,
      parsed: {
        col1: parsed.col1,
        col2: parsed.col2,
        col10: parsed.col10
      },
      usedPaidBalance: usedPaid,
      remainingPaidBalance: newBalance.toFixed(2),
      remainingFreeSearches: newFreeSearches
    });

  } catch (error) {
    logger.error('[SEARCH ERROR]', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { search };
