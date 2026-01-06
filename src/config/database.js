const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'parsec_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Test de conexión
pool.on('connect', () => {
  console.log('[DB] Nueva conexión establecida');
});

pool.on('error', (err) => {
  console.error('[DB ERROR]', err);
});

// Verificar conexión al iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[ERROR] Database connection failed:', err);
    process.exit(1);
  } else {
    console.log('[OK] Database connected at', res.rows[0].now);
  }
});

module.exports = pool;
