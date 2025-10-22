/**
 * Script de prueba para verificar el timeout de inactividad de 20 minutos
 */

require('dotenv').config();

// Leer la configuración del timeout (igual que en menuService.js)
const INACTIVITY_TIMEOUT = parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES || '20') * 60 * 1000;

console.log('='.repeat(60));
console.log('🧪 PRUEBA DE TIMEOUT DE INACTIVIDAD');
console.log('='.repeat(60));
console.log('');

// Mostrar configuración
console.log('📋 CONFIGURACIÓN:');
console.log(`   INACTIVITY_TIMEOUT_MINUTES (env): ${process.env.INACTIVITY_TIMEOUT_MINUTES || 'no configurado (usando default)'}`);
console.log(`   Timeout en minutos: ${INACTIVITY_TIMEOUT / 60000} minutos`);
console.log(`   Timeout en milisegundos: ${INACTIVITY_TIMEOUT} ms`);
console.log('');

// Simular sesión
const userSessions = {};
const testPhone = '573173745021';

console.log('📝 SIMULACIÓN DE SESIÓN:');
console.log('');

// Crear sesión
console.log('1️⃣ Creando sesión de usuario...');
userSessions[testPhone] = {
  state: 'MAIN_MENU',
  lastActivity: Date.now()
};
console.log(`   ✅ Sesión creada para ${testPhone}`);
console.log(`   ⏰ lastActivity: ${new Date(userSessions[testPhone].lastActivity).toLocaleString()}`);
console.log('');

// Función de prueba (igual que en menuService.js)
const isSessionExpired = (userPhone) => {
  if (!userSessions[userPhone]) {
    return true;
  }

  const session = userSessions[userPhone];
  if (!session.lastActivity) {
    return false;
  }

  const now = Date.now();
  const timeSinceLastActivity = now - session.lastActivity;

  if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
    return true;
  }

  return false;
};

// Prueba 1: Sesión recién creada (NO debe expirar)
console.log('2️⃣ Probando sesión recién creada...');
const expired1 = isSessionExpired(testPhone);
const elapsed1 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed1 / 1000)} segundos`);
console.log(`   ¿Expiró? ${expired1 ? '❌ SÍ (ERROR!)' : '✅ NO (correcto)'}`);
console.log('');

// Prueba 2: Simular 10 minutos de inactividad (NO debe expirar)
console.log('3️⃣ Simulando 10 minutos de inactividad...');
userSessions[testPhone].lastActivity = Date.now() - (10 * 60 * 1000);
const expired2 = isSessionExpired(testPhone);
const elapsed2 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed2 / 60000)} minutos`);
console.log(`   ¿Expiró? ${expired2 ? '❌ SÍ (ERROR!)' : '✅ NO (correcto)'}`);
console.log('');

// Prueba 3: Simular 19 minutos de inactividad (NO debe expirar)
console.log('4️⃣ Simulando 19 minutos de inactividad...');
userSessions[testPhone].lastActivity = Date.now() - (19 * 60 * 1000);
const expired3 = isSessionExpired(testPhone);
const elapsed3 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed3 / 60000)} minutos`);
console.log(`   ¿Expiró? ${expired3 ? '❌ SÍ (ERROR!)' : '✅ NO (correcto)'}`);
console.log('');

// Prueba 4: Simular 20 minutos de inactividad (NO debe expirar aún, justo en el límite)
console.log('5️⃣ Simulando exactamente 20 minutos de inactividad...');
userSessions[testPhone].lastActivity = Date.now() - (20 * 60 * 1000);
const expired4 = isSessionExpired(testPhone);
const elapsed4 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed4 / 60000)} minutos`);
console.log(`   ¿Expiró? ${expired4 ? '❌ SÍ (justo en el límite)' : '✅ NO (correcto)'}`);
console.log('');

// Prueba 5: Simular 21 minutos de inactividad (SÍ debe expirar)
console.log('6️⃣ Simulando 21 minutos de inactividad...');
userSessions[testPhone].lastActivity = Date.now() - (21 * 60 * 1000);
const expired5 = isSessionExpired(testPhone);
const elapsed5 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed5 / 60000)} minutos`);
console.log(`   ¿Expiró? ${expired5 ? '✅ SÍ (correcto)' : '❌ NO (ERROR!)'}`);
console.log('');

// Prueba 6: Simular 30 minutos de inactividad (SÍ debe expirar)
console.log('7️⃣ Simulando 30 minutos de inactividad...');
userSessions[testPhone].lastActivity = Date.now() - (30 * 60 * 1000);
const expired6 = isSessionExpired(testPhone);
const elapsed6 = Date.now() - userSessions[testPhone].lastActivity;
console.log(`   Tiempo transcurrido: ${Math.round(elapsed6 / 60000)} minutos`);
console.log(`   ¿Expiró? ${expired6 ? '✅ SÍ (correcto)' : '❌ NO (ERROR!)'}`);
console.log('');

// Resumen
console.log('='.repeat(60));
console.log('📊 RESUMEN DE PRUEBAS:');
console.log('='.repeat(60));

const allPassed = !expired1 && !expired2 && !expired3 && expired5 && expired6;

if (allPassed) {
  console.log('✅ TODAS LAS PRUEBAS PASARON CORRECTAMENTE');
  console.log('');
  console.log('El timeout de 20 minutos está funcionando correctamente:');
  console.log('  • Sesiones con < 20 minutos de inactividad NO expiran');
  console.log('  • Sesiones con > 20 minutos de inactividad SÍ expiran');
} else {
  console.log('❌ ALGUNAS PRUEBAS FALLARON');
  console.log('');
  console.log('Verifica la configuración del timeout.');
}

console.log('');
console.log('='.repeat(60));
