/**
 * Insert Controller
 * POST /api/insert-person
 * 
 * Insertar nuevos registros de personas en la base de datos
 * Usado por el script Parsec para poblar datos desde websites de búsqueda
 */

const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Validar datos requeridos
 */
function validatePersonData(data) {
  const errors = [];

  // Validaciones básicas
  if (!data.first_name || typeof data.first_name !== 'string' || data.first_name.trim().length === 0) {
    errors.push('first_name is required');
  }

  if (!data.last_name || typeof data.last_name !== 'string' || data.last_name.trim().length === 0) {
    errors.push('last_name is required');
  }

  if (!data.zip || typeof data.zip !== 'string' || !/^\d{5}$/.test(data.zip.trim())) {
    errors.push('zip must be a valid 5-digit ZIP code');
  }

  // Validaciones opcionales con formato
  if (data.dob && typeof data.dob === 'string') {
    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob.trim())) {
      errors.push('dob must be in format YYYY-MM-DD');
    }
  }

  if (data.phone && typeof data.phone !== 'string') {
    errors.push('phone must be a string');
  }

  if (data.address && typeof data.address !== 'string') {
    errors.push('address must be a string');
  }

  if (data.city && typeof data.city !== 'string') {
    errors.push('city must be a string');
  }

  if (data.state && typeof data.state !== 'string') {
    errors.push('state must be a string');
  }

  if (data.ssn && typeof data.ssn !== 'string') {
    errors.push('ssn must be a string');
  }

  return errors;
}

/**
 * Normalizar datos antes de insertar
 */
function normalizePersonData(data) {
  return {
    first_name: (data.first_name || '').trim().toUpperCase(),
    last_name: (data.last_name || '').trim().toUpperCase(),
    middle_names: (data.middle_names || '').trim().toUpperCase() || null,
    aka: (data.aka || '').trim().toUpperCase() || null,
    dob: (data.dob || '').trim() || null,
    address: (data.address || '').trim() || null,
    city: (data.city || '').trim() || null,
    county: (data.county || '').trim() || null,
    state: (data.state || '').trim().toUpperCase() || null,
    zip: (data.zip || '').trim(),
    phone: (data.phone || '').trim() || null,
    ssn: (data.ssn || '').trim() || null,
    source: (data.source || 'parsec').trim()
  };
}

/**
 * Verificar si la persona ya existe (basado en nombre + ZIP)
 */
async function personExists(firstName, lastName, zip) {
  try {
    const result = await pool.query(
      'SELECT id FROM people_data WHERE UPPER(first_name) = $1 AND UPPER(last_name) = $2 AND zip = $3',
      [firstName.toUpperCase(), lastName.toUpperCase(), zip]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('[INSERT] Error checking if person exists:', error);
    throw error;
  }
}

/**
 * Insertar una persona
 */
async function insertSinglePerson(personData) {
  try {
    const result = await pool.query(
      `INSERT INTO people_data 
       (first_name, last_name, middle_names, aka, dob, address, city, county, state, zip, phone, ssn, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING id`,
      [
        personData.first_name,
        personData.last_name,
        personData.middle_names,
        personData.aka,
        personData.dob,
        personData.address,
        personData.city,
        personData.county,
        personData.state,
        personData.zip,
        personData.phone,
        personData.ssn,
        personData.source
      ]
    );
    return result.rows[0].id;
  } catch (error) {
    logger.error('[INSERT] Error inserting person:', error);
    throw error;
  }
}

/**
 * Handler para insertar una persona
 */
async function insertPerson(req, res) {
  try {
    const { query, skipIfExists } = req.body;
    const userId = req.user.id;

    logger.info(`[INSERT] User ${userId} inserting person data`);

    // Validar que query esté presente
    if (!query || typeof query !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameter'
      });
    }

    // Validar datos
    const validationErrors = validatePersonData(query);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Normalizar datos
    const normalizedData = normalizePersonData(query);

    // Verificar si existe
    if (skipIfExists) {
      const exists = await personExists(
        normalizedData.first_name,
        normalizedData.last_name,
        normalizedData.zip
      );

      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Person already exists in database',
          skipped: true,
          firstName: normalizedData.first_name,
          lastName: normalizedData.last_name,
          zip: normalizedData.zip
        });
      }
    }

    // Insertar
    const personId = await insertSinglePerson(normalizedData);

    logger.info(`[INSERT] Person inserted successfully. ID: ${personId}`, {
      firstName: normalizedData.first_name,
      lastName: normalizedData.last_name,
      zip: normalizedData.zip
    });

    res.json({
      success: true,
      message: 'Person inserted successfully',
      personId: personId,
      data: {
        firstName: normalizedData.first_name,
        lastName: normalizedData.last_name,
        zip: normalizedData.zip,
        city: normalizedData.city,
        state: normalizedData.state
      }
    });

  } catch (error) {
    logger.error('[INSERT ERROR]', {
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

/**
 * Handler para insertar múltiples personas en bulk
 */
async function insertBatch(req, res) {
  try {
    const { persons, skipIfExists } = req.body;
    const userId = req.user.id;

    logger.info(`[INSERT BATCH] User ${userId} inserting ${persons?.length || 0} persons`);

    if (!Array.isArray(persons) || persons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid persons array'
      });
    }

    if (persons.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Batch size cannot exceed 1000 persons'
      });
    }

    const results = {
      inserted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      insertedIds: []
    };

    // Procesar cada persona
    for (let i = 0; i < persons.length; i++) {
      try {
        const personData = persons[i];

        // Validar
        const validationErrors = validatePersonData(personData);
        if (validationErrors.length > 0) {
          results.failed++;
          results.errors.push({
            index: i,
            error: 'Validation failed',
            details: validationErrors
          });
          continue;
        }

        // Normalizar
        const normalizedData = normalizePersonData(personData);

        // Verificar si existe
        if (skipIfExists) {
          const exists = await personExists(
            normalizedData.first_name,
            normalizedData.last_name,
            normalizedData.zip
          );

          if (exists) {
            results.skipped++;
            continue;
          }
        }

        // Insertar
        const personId = await insertSinglePerson(normalizedData);
        results.inserted++;
        results.insertedIds.push(personId);

      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error.message
        });
      }
    }

    logger.info(`[INSERT BATCH] Completed - Inserted: ${results.inserted}, Skipped: ${results.skipped}, Failed: ${results.failed}`);

    res.json({
      success: true,
      message: `Batch insert completed`,
      stats: {
        total: persons.length,
        inserted: results.inserted,
        skipped: results.skipped,
        failed: results.failed
      },
      insertedIds: results.insertedIds,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    logger.error('[INSERT BATCH ERROR]', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

module.exports = { insertPerson, insertBatch };
