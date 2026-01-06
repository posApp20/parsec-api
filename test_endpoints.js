/**
 * Test Suite para la API Parsec
 * Prueba todos los endpoints implementados
 */

const http = require('http');

const API_URL = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJEaXJMaW51eHMiLCJpYXQiOjE3Njc3MDgxNTAsImV4cCI6MTc5OTI0NDE1MH0._dmC-905UmrxakaPVqSldja5-tZ8jj1pDRaKO7g8Hz4';

/**
 * Hacer request HTTP genérico
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
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

    if (body) {
      const json = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(json);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Tests
 */
async function runTests() {
  console.log('🧪 Starting API Tests\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Health check
    console.log('\n📍 TEST 1: Health Check');
    let response = await makeRequest('GET', '/health');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.body);

    // Test 2: API Status
    console.log('\n📍 TEST 2: API Status');
    response = await makeRequest('GET', '/api/status');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.body);

    // Test 3: Email Check Price
    console.log('\n📍 TEST 3: Get Email Check Price');
    response = await makeRequest('GET', '/api/email-check-price');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 4: Search (Búsqueda simple)
    console.log('\n📍 TEST 4: Search - Simple Query');
    response = await makeRequest('POST', '/api/search', {
      query: 'John.Doe.30305'
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 5: Search (Búsqueda múltiple)
    console.log('\n📍 TEST 5: Search - Multiple Names');
    response = await makeRequest('POST', '/api/search', {
      query: 'John,Johnny.Doe,Doer.30305'
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 6: Search (Búsqueda sin query)
    console.log('\n📍 TEST 6: Search - Empty Query (Error Expected)');
    response = await makeRequest('POST', '/api/search', {
      query: ''
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.body);

    // Test 7: Validate Email
    console.log('\n📍 TEST 7: Validate Email');
    response = await makeRequest('POST', '/api/validate-email', {
      email: 'john.doe@gmail.com'
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 8: Validate Email (Cache)
    console.log('\n📍 TEST 8: Validate Email (Should be Cached)');
    response = await makeRequest('POST', '/api/validate-email', {
      email: 'john.doe@gmail.com'
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 9: Send to Telegram (Sin datos)
    console.log('\n📍 TEST 9: Send to Telegram - Empty Results (Error Expected)');
    response = await makeRequest('POST', '/api/send-to-telegram', {
      results: [],
      query: 'test'
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.body);

    // Test 10: Send File to Production
    console.log('\n📍 TEST 10: Send File to Production');
    const mockResults = [
      ['1', 'John', 'Doe', '', '', '19850315', '123 Main St', 'Miami', 'Dade', 'FL', '30305', '', '', '', '', '', '', '', '', '123456789'],
      ['2', 'Jane', 'Smith', '', '', '19900722', '456 Oak Ave', 'Atlanta', 'Fulton', 'GA', '30303', '', '', '', '', '', '', '', '', '987654321']
    ];
    response = await makeRequest('POST', '/api/send-file-to-production', {
      results: mockResults,
      query: 'John.Doe.30305',
      count: 2
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.body, null, 2));

    // Test 11: Invalid endpoint
    console.log('\n📍 TEST 11: Invalid Endpoint (404 Expected)');
    response = await makeRequest('GET', '/api/invalid-endpoint');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.body);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test suite completed!\n');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Ejecutar tests
runTests();
