/**
 * Script de prueba para verificar la función isWithinBusinessHours
 * con zona horaria de Colombia
 */

const isWithinBusinessHours = () => {
  // Obtener fecha y hora en zona horaria de Colombia
  const nowInColombia = new Date().toLocaleString('en-US', {
    timeZone: 'America/Bogota',
    hour12: false
  });

  const colombiaDate = new Date(nowInColombia);
  const day = colombiaDate.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const hour = colombiaDate.getHours();
  const minutes = colombiaDate.getMinutes();
  const currentTime = hour + minutes / 60;

  console.log('=== INFORMACIÓN DE DEBUG ===');
  console.log('Hora en Colombia:', nowInColombia);
  console.log('Día de la semana:', day, ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day]);
  console.log('Hora:', hour);
  console.log('Minutos:', minutes);
  console.log('Tiempo decimal:', currentTime.toFixed(2));
  console.log('============================\n');

  // Domingo = cerrado
  if (day === 0) {
    return false;
  }

  // Lunes a viernes: 8:00 AM - 4:30 PM
  if (day >= 1 && day <= 5) {
    return currentTime >= 8 && currentTime < 16 + 30/60; // 16:30 = 4:30 PM
  }

  // Sábado: 8:00 AM - 12:40 PM
  if (day === 6) {
    return currentTime >= 8 && currentTime < 12 + 40/60; // 12:40 PM
  }

  return false;
};

// Ejecutar prueba
console.log('🧪 PRUEBA DE HORARIOS DE ATENCIÓN\n');

const isOpen = isWithinBusinessHours();

console.log('📅 Horarios configurados:');
console.log('  • Lunes a viernes: 8:00 AM - 4:30 PM');
console.log('  • Sábados: 8:00 AM - 12:40 PM');
console.log('  • Domingos: Cerrado\n');

console.log('✅ Resultado:', isOpen ? '🟢 ABIERTO - Dentro del horario de atención' : '🔴 CERRADO - Fuera del horario de atención');
