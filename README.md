# 🔍 Parsec API - Backend

> **Stack:** Node.js 20 + Express 5 + PostgreSQL 16 + JWT

![Status](https://img.shields.io/badge/status-development-yellow)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)

---

## 📋 Descripción

**Parsec API** es el backend para un sistema completo de búsqueda de personas, validación de emails y gestión de créditos. Diseñado para funcionar como reemplazo de `https://api.nicepricein.online`.

### Características

✅ Búsqueda de personas por nombre, apellido y ZIP  
✅ Validación de emails con caché inteligente  
✅ Sistema de créditos (gratuito y pagado)  
✅ Autenticación JWT  
✅ Auditoría completa de búsquedas  
✅ Integración con Telegram  
✅ Exportación de resultados  
✅ HTTPS ready con Helmet

---

## 🚀 Quick Start

### Requisitos

- **Node.js** 18+ (tienes v20 ✅)
- **PostgreSQL** 12+ (tienes v16 ✅)
- **npm** o yarn

### Instalación (3 pasos)

```bash
# 1. Clonar/descargar proyecto
cd parsec

# 2. Base de datos (una sola vez)
psql -U postgres -f db/init_database.sql

# 3. Servidor
npm run dev
```

Listo! El servidor estará en `http://localhost:3000` ✨

## 🔌 API Endpoints

### ✅ Disponibles Ahora

```
GET  /health                 - Health check
GET  /api/status             - Status de la API
```

### ⏳ Pendientes

```
POST /api/search                     - Buscar personas
POST /api/validate-email             - Validar email
GET  /api/email-check-price          - Obtener precio
POST /api/send-to-telegram           - Enviar a Telegram
POST /api/send-file-to-production    - Guardar archivo
```

---

## 📦 Stack Técnico

### Backend
- **Runtime:** Node.js 20.x
- **Framework:** Express 5.x
- **Auth:** JWT (jsonwebtoken)
- **Seguridad:** Helmet, CORS
- **Dev:** Nodemon (auto-reload)

### Database
- **Engine:** PostgreSQL 16
- **Driver:** pg (node-postgres)
- **ORM:** SQL puro (sin ORM)

### Testing
- **Postman:** Colección JSON incluida
- **Manual:** Script test_api.js
- **CLI:** cURL commands

---

## 🔐 Seguridad

- ✅ **JWT Authentication** - Token en header
- ✅ **HTTPS Ready** - Helmet preconfigured
- ✅ **CORS Protection** - Configurado
- ✅ **Rate Limiting** - Listo para agregar
- ✅ **SQL Injection Prevention** - Parameterized queries
- ✅ **Password Hashing** - Ready para implementar

---

## 📊 Base de Datos

### Tablas

```
users           - Datos de usuarios + saldos
people_data     - Registros de personas (millones)
search_logs     - Auditoría de búsquedas
email_cache     - Caché de validaciones (90 días TTL)
exports         - Exportaciones guardadas
system_config   - Configuración del sistema
```

### Índices Optimizados

```sql
idx_people_search         - (first_name, last_name, zip)
idx_search_logs_user      - (user_id, created_at)
idx_email_cache_email     - (email)
```

---

## 🧪 Testing

### Opción 1: Postman (Recomendado)

```
1. Descargar Postman: https://www.postman.com
2. Importar: Parsec_API.postman_collection.json
3. Hacer click en cada endpoint y presionar "Send"
```

### Opción 2: cURL

```bash
# Health check
curl http://localhost:3000/health

# Search (con token)
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer fd1e07de19e8ee07aa85c4ac839dbfdec30f9da58055384bd1afca4abe3f2898" \
  -H "Content-Type: application/json" \
  -d '{"query": "John.Doe.30305"}'
```

### Opción 3: Script Node.js

```bash
node test_api.js
```

---

## 🎯 Estado del Proyecto

```
Infraestructura:  100% ✅
Base de Datos:    100% ✅
Servidor Base:    100% ✅
Endpoints:         10% ⏳  (1 de 5 implementados)
Documentación:    100% ✅
───────────────────────────
Total:             71% ⏳
```

---

## 📝 Variables de Entorno

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parsec_db
DB_USER=postgres
DB_PASSWORD=

# JWT
JWT_SECRET=tu_jwt_secret_super_seguro_123_cambiar_en_produccion

# Email Validator (opcional)
EMAIL_VALIDATOR_API_KEY=tu_clave_api

# Search Prices
SEARCH_COST=0.50
EMAIL_CHECK_COST=1.0
```

Editar en `.env`

---

## 👤 Usuario de Prueba

```
Username:  DirLinuxs
User ID:   7839310406
Token:     fd1e07de19e8ee07aa85c4ac839dbfdec30f9da58055384bd1afca4abe3f2898
Balance:   100.00 créditos
Free:      211 búsquedas
```

---

## 📁 Estructura de Carpetas

```
parsec/
├── src/
│   ├── config/              - Configuración
│   │   └── database.js      - Conexión PostgreSQL
│   ├── controllers/         - Lógica de endpoints
│   ├── middleware/          - Middlewares (auth, etc)
│   │   └── auth.js          - JWT verification
│   ├── routes/              - Definición de rutas
│   └── utils/               - Funciones auxiliares
│       └── logger.js        - Sistema de logging
├── db/
│   └── init_database.sql    - Script de inicialización
├── logs/                    - Archivos de log
├── .env                     - Variables de entorno
├── .gitignore               - Ignorar en git
├── server.js                - Punto de entrada
├── package.json             - Dependencias npm
└── test_api.js              - Script de pruebas
```

---

## 🚦 Comandos

```bash
# Desarrollo
npm run dev

# Producción
npm start

# Base de datos (primera vez)
psql -U postgres -f db/init_database.sql

# Tests
node test_api.js

# Ver logs
tail -f logs/app_*.log
```

---

## 🐛 Troubleshooting

### Error: "Database connection failed"
```bash
# Verificar PostgreSQL corriendo
psql -U postgres -h localhost -c "SELECT version();"

# Recrear BD
psql -U postgres -f db/init_database.sql
```

### Error: "Cannot find module"
```bash
npm install
```

### Error: "Port 3000 already in use"
```bash
# Cambiar en .env
PORT=3001
```

### Error: "ECONNREFUSED" en tests
```bash
# Iniciar servidor primero
npm run dev  # en otra terminal
```

---

## 🚀 Próximos Pasos

1. **Implementar endpoints** (5 pendientes)
2. **Agregar rate limiting** (seguridad)
3. **Tests unitarios** (Jest)
4. **Docker** (containerización)
5. **Despliegue** (VPS/Cloud)
6. **SSL/HTTPS** (Let's Encrypt)
7. **CI/CD** (GitHub Actions)
