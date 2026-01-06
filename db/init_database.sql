-- ============ CREAR BASE DE DATOS ============
-- Ejecutar como superusuario (postgres)

CREATE DATABASE parsec_db
  WITH
  ENCODING = 'UTF8'
  LOCALE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- ============ CONECTAR A LA BASE DE DATOS ============
-- \c parsec_db

-- ============ TABLA 1: USUARIOS ============
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  token VARCHAR(512) UNIQUE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0,
  free_searches INT DEFAULT 211,
  max_emails_per_check INT DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_token ON users(token);
CREATE INDEX idx_users_user_id ON users(user_id);

-- ============ TABLA 2: DATOS DE PERSONAS ============
CREATE TABLE IF NOT EXISTS people_data (
  id BIGINT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_names VARCHAR(200),
  aka VARCHAR(200),
  dob DATE,
  address VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  state CHAR(2),
  zip CHAR(5) NOT NULL,
  phone VARCHAR(20),
  ssn VARCHAR(11),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_people_first_name ON people_data(first_name);
CREATE INDEX idx_people_last_name ON people_data(last_name);
CREATE INDEX idx_people_zip ON people_data(zip);
CREATE INDEX idx_people_state ON people_data(state);
CREATE INDEX idx_people_search ON people_data(first_name, last_name, zip);

-- ============ TABLA 3: REGISTRO DE BÚSQUEDAS ============
CREATE TABLE IF NOT EXISTS search_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  query VARCHAR(500),
  result_count INT,
  used_paid_balance BOOLEAN DEFAULT false,
  cost DECIMAL(5, 2) DEFAULT 0,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON search_logs(user_id, created_at);
CREATE INDEX idx_search_logs_created ON search_logs(created_at);

-- ============ TABLA 4: CACHÉ DE EMAILS VALIDADOS ============
CREATE TABLE IF NOT EXISTS email_cache (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_valid BOOLEAN,
  status VARCHAR(50),
  disposable BOOLEAN DEFAULT false,
  catch_all BOOLEAN DEFAULT false,
  role_based BOOLEAN DEFAULT false,
  free_domain BOOLEAN DEFAULT false,
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_cache_email ON email_cache(email);
CREATE INDEX idx_email_cache_expires ON email_cache(expires_at);

-- ============ TABLA 5: EXPORTACIONES ============
CREATE TABLE IF NOT EXISTS exports (
  id SERIAL PRIMARY KEY,
  file_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  query VARCHAR(500),
  result_count INT,
  location VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_exports_user ON exports(user_id);
CREATE INDEX idx_exports_file_id ON exports(file_id);

-- ============ TABLA 6: CONFIGURACIÓN DEL SISTEMA ============
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ INSERTAR USUARIO POR DEFECTO ============
INSERT INTO users (username, user_id, token, balance, free_searches, is_active)
VALUES (
  'DirLinuxs',
  '7839310406',
  'fd1e07de19e8ee07aa85c4ac839dbfdec30f9da58055384bd1afca4abe3f2898',
  100.00,
  211,
  true
)
ON CONFLICT (user_id) DO NOTHING;

-- ============ INSERTAR DATOS DE PRUEBA ============
INSERT INTO people_data (
  id, first_name, last_name, address, city, state, zip, ssn
) VALUES
  (986119173, 'JOHN', 'DOE', '1 NOSTREET', 'ATLANTA', 'GA', '30305', '082788452'),
  (986119174, 'JANE', 'SMITH', '2 MAIN ST', 'BOSTON', 'MA', '02101', '123456789'),
  (986119175, 'JOHN', 'SMITH', '3 OAK AVE', 'CHICAGO', 'IL', '60601', '111222333'),
  (986119176, 'ROBERT', 'JOHNSON', '4 PINE RD', 'DENVER', 'CO', '80202', '444555666'),
  (986119177, 'MICHAEL', 'WILLIAMS', '5 ELM ST', 'MIAMI', 'FL', '33101', '777888999')
ON CONFLICT (id) DO NOTHING;

-- ============ INSERTAR CONFIGURACIÓN ============
INSERT INTO system_config (key, value, description)
VALUES
  ('search_cost', '0.50', 'Costo de búsqueda pagada en créditos'),
  ('email_check_cost', '1.0', 'Costo de validación de email en créditos'),
  ('free_searches_initial', '211', 'Búsquedas gratuitas iniciales por usuario'),
  ('email_cache_ttl_days', '90', 'Días de TTL para caché de emails')
ON CONFLICT (key) DO NOTHING;

-- ============ VERIFICAR TABLAS ============
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- ============ VERIFICAR DATOS ============
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as people_count FROM people_data;
