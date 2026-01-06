/**
 * Test Insert Endpoints
 * Probar funcionalidad de inserción de personas
 */

const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJEaXJMaW51eHMiLCJpYXQiOjE3Njc3MDgxNTAsImV4cCI6MTc5OTI0NDE1MH0._dmC-905UmrxakaPVqSldja5-tZ8jj1pDRaKO7g8Hz4';

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Insert Tests\n');
  console.log('='.repeat(60) + '\n');

  try {
    // TEST 1: Insertar una persona simple
    console.log('📍 TEST 1: Insert Single Person');
    let result = await makeRequest('POST', '/insert-person', {
      query: {
        first_name: 'Carlos',
        last_name: 'García',
        address: '456 Oak Ave',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        phone: '(312) 555-0100',
        dob: '1990-05-15'
      }
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 2: Insertar con datos completos
    console.log('📍 TEST 2: Insert with Complete Data');
    result = await makeRequest('POST', '/insert-person', {
      query: {
        first_name: 'Maria',
        last_name: 'Rodriguez',
        middle_names: 'Elena',
        aka: 'Mary Rod',
        address: '789 Pine St',
        city: 'Los Angeles',
        state: 'CA',
        county: 'Los Angeles',
        zip: '90001',
        phone: '(213) 555-0200',
        dob: '1985-12-20',
        ssn: '987654321'
      }
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 3: Intentar insertar sin campos requeridos
    console.log('📍 TEST 3: Missing Required Fields (Error Expected)');
    result = await makeRequest('POST', '/insert-person', {
      query: {
        first_name: 'Juan',
        // last_name falta
        zip: '12345'
      }
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 4: ZIP code inválido
    console.log('📍 TEST 4: Invalid ZIP Code (Error Expected)');
    result = await makeRequest('POST', '/insert-person', {
      query: {
        first_name: 'Pedro',
        last_name: 'Lopez',
        zip: '123'  // Debe ser 5 dígitos
      }
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 5: Insertar batch con múltiples personas
    console.log('📍 TEST 5: Insert Batch (Multiple Persons)');
    result = await makeRequest('POST', '/insert-batch', {
      persons: [
        {
          first_name: 'Ana',
          last_name: 'Martinez',
          address: '321 Elm St',
          city: 'Houston',
          state: 'TX',
          zip: '77001',
          phone: '(713) 555-0300'
        },
        {
          first_name: 'Luis',
          last_name: 'Hernandez',
          address: '654 Maple Ave',
          city: 'Phoenix',
          state: 'AZ',
          zip: '85001',
          dob: '1992-08-10'
        },
        {
          first_name: 'Sofia',
          last_name: 'Diaz',
          address: '987 Cedar Ln',
          city: 'Philadelphia',
          state: 'PA',
          zip: '19101',
          phone: '(215) 555-0400'
        }
      ]
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 6: Insertar batch con skipIfExists
    console.log('📍 TEST 6: Insert Batch with Skip If Exists');
    result = await makeRequest('POST', '/insert-batch', {
      skipIfExists: true,
      persons: [
        {
          first_name: 'John',
          last_name: 'Doe',
          address: '123 Main St',
          city: 'Miami',
          state: 'FL',
          zip: '30305'  // Ya existe
        },
        {
          first_name: 'David',
          last_name: 'Wilson',
          address: '111 Oak Rd',
          city: 'Dallas',
          state: 'TX',
          zip: '75201'
        }
      ]
    });
    console.log(`Status: ${result.status}`);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    console.log();

    // TEST 7: Buscar las personas insertadas
    console.log('📍 TEST 7: Search Inserted Persons');
    result = await makeRequest('POST', '/search', {
      query: 'Carlos.García.60601'
    });
    console.log(`Status: ${result.status}`);
    if (result.data.success) {
      console.log(`Found ${result.data.count} result(s)`);
      if (result.data.results.length > 0) {
        console.log('First result:', result.data.results[0]);
      }
    } else {
      console.log('Response:', JSON.stringify(result.data, null, 2));
    }
    console.log();

    console.log('='.repeat(60));
    console.log('✅ Test suite completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runTests();
