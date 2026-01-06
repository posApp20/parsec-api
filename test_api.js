/**
 * Script de prueba para Parsec API
 * Ejecutar: node test_api.js
 */

const http = require('http');

// Configuración
const API_URL = 'http://localhost:3000';
const TOKEN = 'fd1e07de19e8ee07aa85c4ac839dbfdec30f9da58055384bd1afca4abe3f2898';

// Función para hacer requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Tests
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DE PARSEC API\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health Check
    console.log('\n✅ TEST 1: Health Check');
    console.log('GET /health');
    const health = await makeRequest('GET', '/health');
    console.log('Status:', health.status);
    console.log('Response:', JSON.stringify(health.data, null, 2));

    // Test 2: API Status
    console.log('\n✅ TEST 2: API Status');
    console.log('GET /api/status');
    const status = await makeRequest('GET', '/api/status');
    console.log('Status:', status.status);
    console.log('Response:', JSON.stringify(status.data, null, 2));

    // Test 3: Search (sin implementar aún)
    console.log('\n✅ TEST 3: Search Endpoint');
    console.log('POST /api/search');
    console.log('Data: { "query": "John.Doe.30305" }');
    const search = await makeRequest('POST', '/api/search', { query: 'John.Doe.30305' });
    console.log('Status:', search.status);
    console.log('Response:', JSON.stringify(search.data, null, 2));

    // Test 4: Email Check Price
    console.log('\n✅ TEST 4: Email Check Price');
    console.log('GET /api/email-check-price');
    const price = await makeRequest('GET', '/api/email-check-price');
    console.log('Status:', price.status);
    console.log('Response:', JSON.stringify(price.data, null, 2));

    // Test 5: Validate Email (sin implementar aún)
    console.log('\n✅ TEST 5: Validate Email');
    console.log('POST /api/validate-email');
    console.log('Data: { "email": "test@example.com" }');
    const validate = await makeRequest('POST', '/api/validate-email', { email: 'test@example.com' });
    console.log('Status:', validate.status);
    console.log('Response:', JSON.stringify(validate.data, null, 2));

    // Test 6: Sin autenticación
    console.log('\n✅ TEST 6: Request sin Token (debe retornar 401)');
    console.log('GET /api/email-check-price (sin token)');
    
    const noAuthReq = new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/email-check-price',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
          // Sin Authorization header
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', () => resolve({ status: 'error', data: 'Connection failed' }));
      req.end();
    });

    const noAuth = await noAuthReq;
    console.log('Status:', noAuth.status);
    console.log('Response:', JSON.stringify(noAuth.data, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ TODAS LAS PRUEBAS COMPLETADAS\n');

  } catch (error) {
    console.error('❌ ERROR EN LAS PRUEBAS:', error);
  }
}

// Ejecutar tests
runTests();
