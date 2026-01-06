#!/bin/bash

# ============ PARSEC API DEPLOYMENT SCRIPT ============
# Script para desplegar la API Parsec en Ubuntu/Linux

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      PARSEC API - Ubuntu/Linux Deployment Script          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Detectar versión de Ubuntu
echo "📋 Detecting Ubuntu version..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME=$NAME
  OS_VERSION=$VERSION_ID
  echo "✓ OS: $OS_NAME $OS_VERSION"
else
  echo "❌ Unable to detect OS version"
  exit 1
fi

# 2. Actualizar sistema
echo ""
echo "🔄 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# 3. Instalar Node.js (v20.x)
echo ""
echo "📦 Installing Node.js v20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "✓ Node.js installed"
else
  echo "✓ Node.js already installed: $(node -v)"
fi

# 4. Instalar PostgreSQL
echo ""
echo "🗄️  Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
  sudo apt-get install -y postgresql postgresql-contrib
  echo "✓ PostgreSQL installed"
else
  echo "✓ PostgreSQL already installed"
fi

# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 5. Instalar Git
echo ""
echo "📚 Installing Git..."
sudo apt-get install -y git

# 6. Crear directorio del proyecto
echo ""
echo "📁 Creating project directory..."
PROJECT_DIR="/home/$(whoami)/parsec-api"
if [ ! -d "$PROJECT_DIR" ]; then
  mkdir -p "$PROJECT_DIR"
  echo "✓ Directory created: $PROJECT_DIR"
else
  echo "✓ Directory already exists: $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 7. Clonar o descargar archivos del proyecto
echo ""
echo "📥 Setting up project files..."
echo "Please copy your project files to: $PROJECT_DIR"
echo ""
echo "Or use git:"
echo "  cd $PROJECT_DIR"
echo "  git clone <your-repo-url> ."
echo ""

# 8. Instalar dependencias de Node
echo ""
echo "📦 Installing Node dependencies..."
if [ -f "package.json" ]; then
  npm install
  echo "✓ Dependencies installed"
else
  echo "⚠️  package.json not found - please copy project files first"
  exit 1
fi

# 9. Configurar PostgreSQL
echo ""
echo "🔐 Configuring PostgreSQL..."

# Crear usuario y base de datos
sudo -u postgres psql << EOF
CREATE USER parsec WITH PASSWORD 'parsec_secure_password_change_this';
CREATE DATABASE parsec_db OWNER parsec;
GRANT ALL PRIVILEGES ON DATABASE parsec_db TO parsec;
EOF

echo "✓ PostgreSQL user and database created"

# 10. Crear archivo .env
echo ""
echo "⚙️  Creating .env configuration..."
cat > .env << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parsec_db
DB_USER=parsec
DB_PASSWORD=parsec_secure_password_change_this

# JWT Configuration
JWT_SECRET=your_secret_key_here_change_this_in_production
JWT_EXPIRY=30d

# Email Validation
MYEMAILVERIFIER_API_KEY=your_api_key_here

# Search Configuration
SEARCH_COST=0.50

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
EOF

echo "✓ .env file created (CONFIGURE IT WITH YOUR SETTINGS)"
echo "⚠️  IMPORTANT: Edit .env and change passwords and secrets!"

# 11. Crear estructura de directorios
echo ""
echo "📂 Creating directory structure..."
mkdir -p logs exports

# 12. Inicializar base de datos
echo ""
echo "🗄️  Initializing database..."
if [ -f "db/init_database.sql" ]; then
  PGPASSWORD='parsec_secure_password_change_this' psql -h localhost -U parsec -d parsec_db -f db/init_database.sql
  echo "✓ Database initialized"
else
  echo "⚠️  db/init_database.sql not found"
fi

# 13. Crear servicio systemd
echo ""
echo "🚀 Creating systemd service..."
sudo tee /etc/systemd/system/parsec-api.service > /dev/null << EOF
[Unit]
Description=Parsec API Service
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
echo "✓ Systemd service created"

# 14. Configurar firewall (si está disponible)
echo ""
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
  sudo ufw allow 22/tcp
  sudo ufw allow 3000/tcp
  sudo ufw --force enable
  echo "✓ Firewall configured"
else
  echo "ℹ️  UFW not found - configure firewall manually if needed"
fi

# 15. Información de post-instalación
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETE                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1️⃣  Configure .env file:"
echo "   nano $PROJECT_DIR/.env"
echo ""
echo "2️⃣  Set secure passwords:"
echo "   - DB_PASSWORD"
echo "   - JWT_SECRET"
echo ""
echo "3️⃣  Copy project files to: $PROJECT_DIR"
echo ""
echo "4️⃣  Install Node dependencies:"
echo "   cd $PROJECT_DIR"
echo "   npm install"
echo ""
echo "5️⃣  Initialize database:"
echo "   PGPASSWORD='your_password' psql -h localhost -U parsec -d parsec_db -f db/init_database.sql"
echo ""
echo "6️⃣  Start the API service:"
echo "   sudo systemctl start parsec-api"
echo "   sudo systemctl enable parsec-api"
echo ""
echo "7️⃣  Check service status:"
echo "   sudo systemctl status parsec-api"
echo ""
echo "8️⃣  View logs:"
echo "   sudo journalctl -u parsec-api -f"
echo ""
echo "📌 API URL: http://148.230.90.211:3000"
echo ""
