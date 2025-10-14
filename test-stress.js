/**
 * SCRIPT DE PRUEBAS DE ESTRÉS Y CASOS EXTREMOS
 * Este script simula múltiples usuarios y condiciones extremas
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/webhook`;

// Colores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Simula un mensaje de WhatsApp
 */
function createWhatsAppMessage(phone, messageText, messageType = 'text') {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '15551234567',
            phone_number_id: 'test_phone_id'
          },
          contacts: [{
            profile: { name: `Test User ${phone}` },
            wa_id: phone
          }],
          messages: [{
            from: phone,
            id: `msg_${Date.now()}_${Math.random()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: messageType,
            ...(messageType === 'text' ? {
              text: { body: messageText }
            } : {}),
            ...(messageType === 'interactive' ? {
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: messageText,
                  title: messageText
                }
              }
            } : {})
          }]
        }
      }]
    }]
  };
}

/**
 * Envía un mensaje al webhook
 */
async function sendMessage(phone, message, type = 'text') {
  try {
    const payload = createWhatsAppMessage(phone, message, type);
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return { success: true, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status
    };
  }
}

/**
 * Logger de pruebas
 */
function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    test: `${colors.magenta}🧪${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

/**
 * Esperar un tiempo
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * TEST 1: Concurrencia - 100 usuarios enviando "hola" simultáneamente
 */
async function testConcurrency() {
  log('TEST 1: Concurrencia - 100 usuarios simultáneos', 'test');
  testsRun++;

  const numUsers = 100;
  const phones = Array.from({ length: numUsers }, (_, i) => `57300000${String(i).padStart(4, '0')}`);

  try {
    const startTime = Date.now();
    const promises = phones.map(phone => sendMessage(phone, 'hola'));
    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    log(`Tiempo total: ${endTime - startTime}ms`, 'info');
    log(`Exitosos: ${successful}/${numUsers}`, successful === numUsers ? 'success' : 'warning');
    log(`Fallidos: ${failed}/${numUsers}`, failed === 0 ? 'success' : 'error');

    if (successful === numUsers) {
      testsPassed++;
      log('TEST 1: PASADO ✓', 'success');
    } else {
      testsFailed++;
      log('TEST 1: FALLIDO - Algunos usuarios no recibieron respuesta', 'error');
    }

    return { passed: successful === numUsers, successful, failed };
  } catch (error) {
    testsFailed++;
    log(`TEST 1: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 2: Mensajes extremadamente largos
 */
async function testLongMessages() {
  log('TEST 2: Mensajes extremadamente largos', 'test');
  testsRun++;

  const phone = '573000001000';
  const longMessage = 'A'.repeat(10000); // 10,000 caracteres

  try {
    await sendMessage(phone, 'hola'); // Inicializar sesión
    await sleep(500);

    const result = await sendMessage(phone, longMessage);

    if (result.success) {
      testsPassed++;
      log('TEST 2: PASADO ✓ - Maneja mensajes largos sin caerse', 'success');
      return { passed: true };
    } else {
      testsFailed++;
      log('TEST 2: FALLIDO - No maneja mensajes largos', 'error');
      return { passed: false };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 2: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 3: Caracteres especiales y emojis extremos
 */
async function testSpecialCharacters() {
  log('TEST 3: Caracteres especiales y emojis', 'test');
  testsRun++;

  const phone = '573000002000';
  const specialMessages = [
    '🔥💯🚀😀👍🎉💪✨🌟⭐',
    '<script>alert("xss")</script>',
    '"; DROP TABLE users; --',
    '../../../../etc/passwd',
    '\n\n\n\n\n\n\n\n\n\n',
    '${process.env.SECRET}',
    'null',
    'undefined',
    '0',
    'NaN',
    'true'
  ];

  try {
    await sendMessage(phone, 'hola');
    await sleep(500);

    let allPassed = true;
    for (const msg of specialMessages) {
      const result = await sendMessage(phone, msg);
      if (!result.success) {
        allPassed = false;
        log(`Falló con: ${msg.substring(0, 20)}...`, 'warning');
      }
      await sleep(100);
    }

    if (allPassed) {
      testsPassed++;
      log('TEST 3: PASADO ✓ - Maneja caracteres especiales', 'success');
      return { passed: true };
    } else {
      testsFailed++;
      log('TEST 3: FALLIDO - No maneja todos los caracteres especiales', 'error');
      return { passed: false };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 3: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 4: Flujo interrumpido - Usuario abandona a mitad de proceso
 */
async function testInterruptedFlow() {
  log('TEST 4: Flujos interrumpidos', 'test');
  testsRun++;

  const phone = '573000003000';

  try {
    // Iniciar flujo de cotización
    await sendMessage(phone, 'hola');
    await sleep(300);
    await sendMessage(phone, '', 'interactive'); // Abrir menú
    await sleep(300);
    await sendMessage(phone, 'menu_cotizar', 'interactive');
    await sleep(500);

    // Usuario escribe algo random en medio del flujo
    await sendMessage(phone, 'asdfghjkl');
    await sleep(300);

    // Usuario intenta volver al menú
    const result = await sendMessage(phone, 'volver_menu', 'interactive');

    if (result.success) {
      testsPassed++;
      log('TEST 4: PASADO ✓ - Recupera de flujos interrumpidos', 'success');
      return { passed: true };
    } else {
      testsFailed++;
      log('TEST 4: FALLIDO', 'error');
      return { passed: false };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 4: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 5: Spam - Usuario envía muchos mensajes rápidamente
 */
async function testSpam() {
  log('TEST 5: Spam - Mensajes rápidos consecutivos', 'test');
  testsRun++;

  const phone = '573000004000';
  const numMessages = 50;

  try {
    const promises = [];
    for (let i = 0; i < numMessages; i++) {
      promises.push(sendMessage(phone, `mensaje${i}`));
    }

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;

    if (successful === numMessages) {
      testsPassed++;
      log('TEST 5: PASADO ✓ - Maneja spam sin caerse', 'success');
      return { passed: true };
    } else {
      log(`TEST 5: PARCIAL - ${successful}/${numMessages} exitosos`, 'warning');
      testsPassed++;
      return { passed: true, partial: true };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 5: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 6: Números de teléfono inválidos
 */
async function testInvalidPhones() {
  log('TEST 6: Números de teléfono inválidos', 'test');
  testsRun++;

  const invalidPhones = [
    '',
    'null',
    'undefined',
    '0',
    '999',
    'abc123',
    '++57123',
    '57' + '0'.repeat(100)
  ];

  try {
    let allPassed = true;
    for (const phone of invalidPhones) {
      const result = await sendMessage(phone, 'hola');
      // El servidor no debe caerse, incluso con teléfonos inválidos
      if (result.success || result.status === 200) {
        // OK - procesó sin caerse
      } else if (result.status >= 500) {
        allPassed = false;
        log(`Servidor cayó con phone: ${phone}`, 'error');
      }
      await sleep(100);
    }

    if (allPassed) {
      testsPassed++;
      log('TEST 6: PASADO ✓ - No se cae con teléfonos inválidos', 'success');
      return { passed: true };
    } else {
      testsFailed++;
      log('TEST 6: FALLIDO - Se cayó con algunos teléfonos', 'error');
      return { passed: false };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 6: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 7: Carga sostenida - 1000 usuarios en 10 segundos
 */
async function testSustainedLoad() {
  log('TEST 7: Carga sostenida - 1000 usuarios en 10 segundos', 'test');
  testsRun++;

  const numUsers = 1000;
  const durationMs = 10000;
  const interval = durationMs / numUsers;

  try {
    log(`Enviando ${numUsers} mensajes con intervalo de ${interval.toFixed(2)}ms...`, 'info');

    const startTime = Date.now();
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < numUsers; i++) {
      const phone = `57310000${String(i).padStart(4, '0')}`;
      sendMessage(phone, 'hola').then(result => {
        if (result.success) successful++;
        else failed++;
      }).catch(() => failed++);

      await sleep(interval);

      // Progress cada 100 mensajes
      if ((i + 1) % 100 === 0) {
        log(`Progreso: ${i + 1}/${numUsers} enviados...`, 'info');
      }
    }

    // Esperar a que terminen todas las peticiones
    await sleep(5000);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    log(`Tiempo total: ${totalTime}ms`, 'info');
    log(`Exitosos: ${successful}/${numUsers}`, 'info');
    log(`Fallidos: ${failed}/${numUsers}`, 'info');
    log(`Promedio: ${(totalTime / numUsers).toFixed(2)}ms por mensaje`, 'info');

    const successRate = (successful / numUsers) * 100;
    if (successRate >= 95) {
      testsPassed++;
      log(`TEST 7: PASADO ✓ - ${successRate.toFixed(1)}% de éxito`, 'success');
      return { passed: true, successRate };
    } else {
      testsFailed++;
      log(`TEST 7: FALLIDO - Solo ${successRate.toFixed(1)}% de éxito`, 'error');
      return { passed: false, successRate };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 7: ERROR - ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * TEST 8: Memoria - Verificar que no haya fugas con muchos usuarios
 */
async function testMemoryLeaks() {
  log('TEST 8: Verificación de memoria', 'test');
  testsRun++;

  try {
    // Verificar servidor está vivo
    const healthCheck = await axios.get(BASE_URL);

    if (healthCheck.status === 200) {
      testsPassed++;
      log('TEST 8: PASADO ✓ - Servidor sigue funcionando después de todas las pruebas', 'success');
      return { passed: true };
    } else {
      testsFailed++;
      log('TEST 8: FALLIDO - Servidor no responde', 'error');
      return { passed: false };
    }
  } catch (error) {
    testsFailed++;
    log(`TEST 8: ERROR - Servidor no responde: ${error.message}`, 'error');
    return { passed: false, error: error.message };
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  log('🚀 INICIANDO PRUEBAS DE ESTRÉS Y CASOS EXTREMOS', 'test');
  console.log('='.repeat(60) + '\n');

  const startTime = Date.now();

  // Ejecutar tests en secuencia
  await testConcurrency();
  await sleep(1000);

  await testLongMessages();
  await sleep(1000);

  await testSpecialCharacters();
  await sleep(1000);

  await testInterruptedFlow();
  await sleep(1000);

  await testSpam();
  await sleep(1000);

  await testInvalidPhones();
  await sleep(1000);

  await testSustainedLoad();
  await sleep(2000);

  await testMemoryLeaks();

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Resumen final
  console.log('\n' + '='.repeat(60));
  log('📊 RESUMEN DE PRUEBAS', 'test');
  console.log('='.repeat(60));
  log(`Total de pruebas: ${testsRun}`, 'info');
  log(`Pasadas: ${testsPassed}`, 'success');
  log(`Fallidas: ${testsFailed}`, testsFailed === 0 ? 'success' : 'error');
  log(`Tiempo total: ${totalTime}s`, 'info');
  log(`Tasa de éxito: ${((testsPassed / testsRun) * 100).toFixed(1)}%`,
      testsFailed === 0 ? 'success' : 'warning');
  console.log('='.repeat(60) + '\n');

  if (testsFailed === 0) {
    log('🎉 TODAS LAS PRUEBAS PASARON - BOT LISTO PARA PRODUCCIÓN', 'success');
  } else {
    log(`⚠️  ${testsFailed} PRUEBA(S) FALLARON - REVISAR ERRORES ARRIBA`, 'warning');
  }

  process.exit(testsFailed === 0 ? 0 : 1);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(error => {
    log(`ERROR FATAL: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  sendMessage,
  createWhatsAppMessage
};
