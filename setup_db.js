/**
 * Setup Script - Prepara BD, crea tablas, inserta datos y genera token válido
 */

const pool = require('./src/config/database');
const { generateToken } = require('./src/middleware/auth');
const crypto = require('crypto');

async function setupDatabase() {
  try {
    console.log('🔧 INICIANDO SETUP DE BASE DE DATOS...\n');

    // 1. CREAR TABLAS
    console.log('📍 Paso 1: Creando tablas...');
    
    // Tabla usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        token VARCHAR(512) UNIQUE NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 100.00,
        free_searches INT DEFAULT 211,
        max_emails_per_check INT DEFAULT 15,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
      CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
    `);
    console.log('   ✅ Tabla users creada');

    // Tabla people_data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS people_data (
        id BIGSERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        middle_names VARCHAR(200),
        aka VARCHAR(200),
        dob DATE,
        address VARCHAR(255),
        city VARCHAR(100),
        county VARCHAR(100),
        state CHAR(2),
        zip CHAR(5),
        phone VARCHAR(20),
        ssn VARCHAR(11),
        source VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_people_first_name ON people_data(first_name);
      CREATE INDEX IF NOT EXISTS idx_people_last_name ON people_data(last_name);
      CREATE INDEX IF NOT EXISTS idx_people_zip ON people_data(zip);
    `);
    console.log('   ✅ Tabla people_data creada');

    // Tabla search_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        query TEXT NOT NULL,
        result_count INT DEFAULT 0,
        used_paid_balance BOOLEAN DEFAULT false,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
    `);
    console.log('   ✅ Tabla search_logs creada');

    // Tabla email_cache
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_cache (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        is_valid BOOLEAN,
        status VARCHAR(50),
        catch_all BOOLEAN DEFAULT false,
        disposable BOOLEAN DEFAULT false,
        role_based BOOLEAN DEFAULT false,
        free_domain BOOLEAN DEFAULT false,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_email_cache_email ON email_cache(email);
      CREATE INDEX IF NOT EXISTS idx_email_cache_expires_at ON email_cache(expires_at);
    `);
    console.log('   ✅ Tabla email_cache creada');

    // Tabla exports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exports (
        id BIGSERIAL PRIMARY KEY,
        file_id VARCHAR(100) UNIQUE NOT NULL,
        user_id BIGINT NOT NULL,
        query TEXT,
        result_count INT DEFAULT 0,
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);
      CREATE INDEX IF NOT EXISTS idx_exports_file_id ON exports(file_id);
    `);
    console.log('   ✅ Tabla exports creada');

    // Tabla system_config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
    `);
    console.log('   ✅ Tabla system_config creada');

    // 2. LIMPIAR DATOS EXISTENTES (para testing)
    console.log('\n📍 Paso 2: Limpiando datos previos...');
    await pool.query('DELETE FROM search_logs');
    await pool.query('DELETE FROM exports');
    await pool.query('DELETE FROM email_cache');
    await pool.query('DELETE FROM people_data');
    await pool.query('DELETE FROM users');
    console.log('   ✅ Datos anteriores eliminados');

    // 3. CREAR USUARIO DE PRUEBA
    console.log('\n📍 Paso 3: Creando usuario de prueba...');
    
    const username = 'DirLinuxs';
    const userId = '7839310406';
    const token = generateToken({ id: 1, username });
    
    const userResult = await pool.query(
      `INSERT INTO users (username, user_id, token, balance, free_searches, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, token, balance, free_searches`,
      [username, userId, token, 100.00, 211, true]
    );

    const user = userResult.rows[0];
    console.log(`   ✅ Usuario creado:`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Username: ${user.username}`);
    console.log(`      Token: ${user.token}`);
    console.log(`      Balance: $${user.balance}`);
    console.log(`      Búsquedas gratuitas: ${user.free_searches}`);

    // 4. INSERTAR DATOS DE PRUEBA
    console.log('\n📍 Paso 4: Insertando datos de prueba...');
    
    const testData = [
      {
        first_name: 'John',
        last_name: 'Doe',
        middle_names: 'Michael',
        aka: '',
        dob: '1985-03-15',
        address: '123 Main St',
        city: 'Miami',
        county: 'Dade',
        state: 'FL',
        zip: '30305',
        phone: '5551234567',
        ssn: '123456789'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        middle_names: 'Elizabeth',
        aka: '',
        dob: '1990-07-22',
        address: '456 Oak Ave',
        city: 'Atlanta',
        county: 'Fulton',
        state: 'GA',
        zip: '30303',
        phone: '4045551234',
        ssn: '987654321'
      },
      {
        first_name: 'Johnny',
        last_name: 'Doer',
        middle_names: '',
        aka: 'Johnny D',
        dob: '1988-04-10',
        address: '789 Pine Rd',
        city: 'New York',
        county: 'New York',
        state: 'NY',
        zip: '10001',
        phone: '2125551234',
        ssn: '456789123'
      },
      {
        first_name: 'Robert',
        last_name: 'Johnson',
        middle_names: 'Charles',
        aka: '',
        dob: '1975-11-30',
        address: '321 Elm St',
        city: 'Los Angeles',
        county: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        phone: '3105551234',
        ssn: '789123456'
      },
      {
        first_name: 'Maria',
        last_name: 'Garcia',
        middle_names: 'Rosa',
        aka: '',
        dob: '1992-02-14',
        address: '654 Cedar Ln',
        city: 'Houston',
        county: 'Harris',
        state: 'TX',
        zip: '77001',
        phone: '7135551234',
        ssn: '321654987'
      }
    ];

    for (const person of testData) {
      const id = crypto.randomBytes(4).readUInt32BE(0);
      await pool.query(
        `INSERT INTO people_data 
         (id, first_name, last_name, middle_names, aka, dob, address, city, county, state, zip, phone, ssn, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          id,
          person.first_name,
          person.last_name,
          person.middle_names,
          person.aka,
          person.dob,
          person.address,
          person.city,
          person.county,
          person.state,
          person.zip,
          person.phone,
          person.ssn,
          'test_data'
        ]
      );
    }

    console.log(`   ✅ ${testData.length} registros de prueba insertados`);

    // 5. VERIFICAR DATOS
    console.log('\n📍 Paso 5: Verificando datos...');
    
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const peopleCount = await pool.query('SELECT COUNT(*) FROM people_data');
    
    console.log(`   ✅ Usuarios: ${userCount.rows[0].count}`);
    console.log(`   ✅ Personas: ${peopleCount.rows[0].count}`);

    // 6. MOSTRAR INFORMACIÓN DE CONEXIÓN
    console.log('\n' + '='.repeat(70));
    console.log('✅ SETUP COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(70));
    console.log('\n📋 INFORMACIÓN DE CONEXIÓN:\n');
    console.log('Token de Prueba:');
    console.log(`  ${token}\n`);
    console.log('Credenciales:');
    console.log(`  Username: DirLinuxs`);
    console.log(`  User ID: 7839310406`);
    console.log(`  Balance: $100.00`);
    console.log(`  Búsquedas gratuitas: 211\n`);
    console.log('Base de Datos:');
    console.log(`  URL: postgresql://postgres@localhost:5432/parsec_db`);
    console.log(`  Usuarios: ${userCount.rows[0].count}`);
    console.log(`  Personas: ${peopleCount.rows[0].count}\n`);
    console.log('API:');
    console.log('  http://localhost:3000\n');
    console.log('='.repeat(70));
    console.log('⚠️  COPIA EL TOKEN Y GUÁRDALO EN test_endpoints.js\n');

    await pool.end();

  } catch (error) {
    console.error('❌ Error durante setup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupDatabase();
