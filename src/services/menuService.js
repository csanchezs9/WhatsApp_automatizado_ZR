const { sendTextMessage, sendInteractiveButtons, sendInteractiveList } = require('./whatsappService');
const { getCategories, getSubCategories, getProducts } = require('./ecommerceService');

// Almacenamiento temporal de sesiones de usuario (en producción usa Redis o DB)
const userSessions = {};

// Usuarios que están hablando con un asesor
const usersWithAdvisor = new Map(); // { userPhone: { startTime: Date, lastAdvisorMessage: Date } }

const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573173745021';
const ADVISOR_CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
const INACTIVITY_TIMEOUT = parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES || '7') * 60 * 1000; // 7 minutos de inactividad

// Configuración de limpieza de sesiones antiguas
const MAX_SESSION_AGE = 1 * 24 * 60 * 60 * 1000; // 1 día (24 horas)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Limpiar cada 24 horas

/**
 * Limpia sesiones antiguas de la memoria para prevenir fuga de memoria
 */
const cleanupOldSessions = () => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [userPhone, session] of Object.entries(userSessions)) {
    // Eliminar sesiones sin actividad reciente (más de 1 día / 24 horas)
    if (session.lastActivity && (now - session.lastActivity) > MAX_SESSION_AGE) {
      delete userSessions[userPhone];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Limpieza automática: ${cleanedCount} sesiones antiguas eliminadas`);
  }
  
  console.log(`📊 Sesiones activas: ${Object.keys(userSessions).length}`);
};

// Ejecutar limpieza periódica cada 24 horas
setInterval(cleanupOldSessions, CLEANUP_INTERVAL);

// Ejecutar limpieza inicial 10 segundos después de arrancar
setTimeout(cleanupOldSessions, 10000);

/**
 * Verifica si la sesión del usuario ha expirado por inactividad
 */
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
    console.log(`⏰ Sesión expirada por inactividad para ${userPhone} (${Math.round(timeSinceLastActivity / 60000)} minutos)`);
    return true;
  }

  return false;
};

/**
 * Actualiza el timestamp de última actividad del usuario
 */
const updateLastActivity = (userPhone) => {
  if (userSessions[userPhone]) {
    userSessions[userPhone].lastActivity = Date.now();
  }
};

/**
 * Normaliza texto quitando tildes y caracteres especiales
 */
const normalizeText = (text) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N');
};

/**
 * Verifica si un usuario está actualmente hablando con un asesor
 * Si han pasado 24 horas, finaliza automáticamente la conversación
 */
const isUserWithAdvisor = (userPhone) => {
  if (!usersWithAdvisor.has(userPhone)) {
    return false;
  }

  const advisorSession = usersWithAdvisor.get(userPhone);
  const now = Date.now();
  const timeSinceStart = now - advisorSession.startTime;

  // Si han pasado 24 horas desde el inicio, finalizar conversación automáticamente
  if (timeSinceStart > ADVISOR_CONVERSATION_TIMEOUT) {
    console.log(`⏰ Conversación con asesor expiró después de 24h para ${userPhone}`);
    usersWithAdvisor.delete(userPhone);
    return false;
  }

  return true;
};

/**
 * Activa el modo asesor para un usuario
 */
const activateAdvisorMode = async (userPhone, userQuery = '') => {
  const now = Date.now();
  usersWithAdvisor.set(userPhone, {
    startTime: now,
    lastAdvisorMessage: now,
    userQuery: userQuery
  });

  // Notificar al asesor con la consulta del usuario
  const advisorMessage = `🔔 *NUEVA SOLICITUD DE ATENCIÓN*\n\n` +
    `📱 Cliente: +${userPhone}\n` +
    `⏰ Hora: ${new Date().toLocaleString('es-CO')}\n\n` +
    `💬 *Consulta del cliente:*\n"${userQuery}"\n\n` +
    `Por favor responde desde WhatsApp Business.\n\n` +
    `📌 *Para finalizar la conversación:*\n` +
    `Escribe "/finalizar" en este chat (del bot) o dile al cliente que escriba "menú".`;

  try {
    await sendTextMessage(ADVISOR_PHONE, advisorMessage);
    console.log(`✅ Notificación enviada al asesor para cliente ${userPhone}`);
  } catch (error) {
    console.error('❌ Error notificando al asesor:', error);
  }

  // Mensaje al cliente
  const clientMessage = `✅ *Solicitud enviada al asesor*\n\n` +
    `Hemos recibido tu consulta:\n_"${userQuery}"_\n\n` +
    `⏱️ Un asesor se contactará contigo pronto.\n` +
    `Estate pendiente de la respuesta.\n\n` +
    `_Si deseas volver al menú automático, escribe *menú*_`;

  await sendTextMessage(userPhone, clientMessage);
  console.log(`👤 Usuario ${userPhone} ahora está en modo asesor con consulta: "${userQuery}"`);
  
  // Cambiar estado de la sesión para que no procese más mensajes como nueva consulta
  if (userSessions[userPhone]) {
    userSessions[userPhone].state = 'WITH_ADVISOR';
  }
};

/**
 * Desactiva el modo asesor para un usuario
 */
const deactivateAdvisorMode = (userPhone) => {
  if (usersWithAdvisor.has(userPhone)) {
    usersWithAdvisor.delete(userPhone);
    console.log(`🤖 Bot reactivado para ${userPhone}`);
    return true;
  }
  return false;
};

/**
 * Finaliza la conversación desde el lado del asesor
 * Si hay 1 cliente: cierra directamente
 * Si hay varios: muestra menú para elegir
 * Si no hay ninguno: notifica
 */
const finalizeAdvisorConversation = async (advisorPhone) => {
  console.log(`🔍 Buscando conversaciones activas para asesor ${advisorPhone}...`);
  
  // Obtener todos los clientes activos con asesor
  const activeClients = Array.from(usersWithAdvisor.entries());
  
  if (activeClients.length === 0) {
    // No hay clientes activos
    await sendTextMessage(
      advisorPhone,
      `⚠️ *No hay conversaciones activas*\n\n` +
      `No se encontró ningún cliente en conversación con asesor en este momento.`
    );
    return false;
  }
  
  if (activeClients.length === 1) {
    // Solo 1 cliente: cerrar directamente
    const [clientPhone, clientData] = activeClients[0];
    await closeClientConversation(clientPhone, advisorPhone);
    return true;
  }
  
  // Múltiples clientes: mostrar menú para elegir
  await showClientSelectionMenu(advisorPhone, activeClients);
  return true;
};

/**
 * Muestra un menú interactivo con los clientes activos para que el asesor elija cuál cerrar
 */
const showClientSelectionMenu = async (advisorPhone, activeClients) => {
  console.log(`📋 Mostrando menú de selección con ${activeClients.length} clientes activos`);
  
  // Crear botones (máximo 3 por limitación de WhatsApp)
  if (activeClients.length <= 3) {
    // Usar botones interactivos
    const buttons = activeClients.map(([clientPhone, clientData], index) => {
      const timeAgo = Math.floor((Date.now() - clientData.startTime) / 60000); // minutos
      return {
        id: `finalizar_${clientPhone}`,
        title: `Cliente ${index + 1} (${timeAgo}m)`
      };
    });
    
    let bodyText = `🔚 *Selecciona qué conversación finalizar:*\n\n`;
    activeClients.forEach(([clientPhone, clientData], index) => {
      const timeAgo = Math.floor((Date.now() - clientData.startTime) / 60000);
      const query = clientData.userQuery || 'Sin consulta';
      const shortQuery = query.length > 30 ? query.substring(0, 30) + '...' : query;
      bodyText += `${index + 1}. +${clientPhone}\n`;
      bodyText += `   ⏱️ Hace ${timeAgo} min\n`;
      bodyText += `   💬 "${shortQuery}"\n\n`;
    });
    
    await sendInteractiveButtons(advisorPhone, bodyText, buttons);
    
  } else if (activeClients.length <= 10) {
    // Entre 4 y 10 clientes: usar lista interactiva
    const rows = activeClients.map(([clientPhone, clientData], index) => {
      const timeAgo = Math.floor((Date.now() - clientData.startTime) / 60000);
      const query = clientData.userQuery || 'Sin consulta';
      const shortQuery = query.length > 20 ? query.substring(0, 20) + '...' : query;
      
      return {
        id: `finalizar_${clientPhone}`,
        title: `+${clientPhone}`,
        description: `Hace ${timeAgo}m: ${shortQuery}`
      };
    });
    
    const sections = [{
      title: 'Conversaciones activas',
      rows: rows
    }];
    
    await sendInteractiveList(
      advisorPhone,
      `🔚 *Tienes ${activeClients.length} conversaciones activas*\n\nSelecciona cuál deseas finalizar:`,
      'Ver conversaciones',
      sections
    );
  } else {
    // Más de 10 clientes: usar mensaje de texto con números
    let message = `🔚 *Tienes ${activeClients.length} conversaciones activas*\n\n`;
    message += `Escribe el *número* del cliente que deseas finalizar:\n\n`;
    
    activeClients.forEach(([clientPhone, clientData], index) => {
      const timeAgo = Math.floor((Date.now() - clientData.startTime) / 60000);
      const query = clientData.userQuery || 'Sin consulta';
      const shortQuery = query.length > 40 ? query.substring(0, 40) + '...' : query;
      
      message += `*${index + 1}.* +${clientPhone}\n`;
      message += `   ⏱️ Hace ${timeAgo} min\n`;
      message += `   💬 "${shortQuery}"\n\n`;
    });
    
    message += `_Ejemplo: Escribe *1* para finalizar la primera conversación_`;
    
    await sendTextMessage(advisorPhone, message);
    
    // Guardar el estado para procesar la respuesta numérica
    if (!userSessions[advisorPhone]) {
      userSessions[advisorPhone] = {};
    }
    userSessions[advisorPhone].state = 'SELECTING_CLIENT_TO_FINALIZE';
    userSessions[advisorPhone].clientList = activeClients;
  }
};

/**
 * Cierra la conversación con un cliente específico
 */
const closeClientConversation = async (clientPhone, advisorPhone) => {
  console.log(`✅ Finalizando conversación con cliente ${clientPhone}`);
  
  // Desactivar modo asesor para ese cliente
  deactivateAdvisorMode(clientPhone);
  
  // Notificar al cliente que la conversación finalizó
  await sendTextMessage(
    clientPhone,
    `✅ *Conversación finalizada*\n\n` +
    `El asesor ha finalizado la atención.\n\n` +
    `Gracias por contactarnos. Si necesitas más ayuda, escribe *menú* para ver las opciones disponibles.`
  );
  
  // NO mostramos el menú automáticamente, esperamos a que el cliente escriba "menú"
  
  // Confirmar al asesor
  await sendTextMessage(
    advisorPhone,
    `✅ *Conversación finalizada correctamente*\n\n` +
    `Cliente: +${clientPhone}\n` +
    `El bot ha sido reactivado para este cliente.`
  );
};

/**
 * Maneja la selección del menú según el mensaje del usuario
 */
const handleMenuSelection = async (userPhone, message) => {
  const messageText = message.toLowerCase().trim();

  // COMANDO /FINALIZAR DESDE EL ASESOR
  if (messageText === '/finalizar' && userPhone === ADVISOR_PHONE) {
    console.log(`🔚 Comando /finalizar recibido del asesor`);
    await finalizeAdvisorConversation(userPhone);
    return;
  }

  // SELECCIÓN NUMÉRICA DE CLIENTE (cuando hay más de 10 clientes)
  if (userPhone === ADVISOR_PHONE && 
      userSessions[userPhone]?.state === 'SELECTING_CLIENT_TO_FINALIZE') {
    const selectedNumber = parseInt(messageText);
    const clientList = userSessions[userPhone].clientList;
    
    if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > clientList.length) {
      await sendTextMessage(
        userPhone,
        `❌ *Número inválido*\n\nPor favor escribe un número entre 1 y ${clientList.length}`
      );
      return;
    }
    
    // Obtener el cliente seleccionado (índice empieza en 0)
    const [clientPhone, clientData] = clientList[selectedNumber - 1];
    console.log(`🔚 Asesor seleccionó finalizar conversación con ${clientPhone} (opción ${selectedNumber})`);
    
    // Limpiar el estado
    delete userSessions[userPhone].state;
    delete userSessions[userPhone].clientList;
    
    // Verificar que el cliente todavía está activo
    if (usersWithAdvisor.has(clientPhone)) {
      await closeClientConversation(clientPhone, userPhone);
    } else {
      await sendTextMessage(
        userPhone,
        `❌ *Error*\n\nEse cliente ya no está en conversación activa.`
      );
    }
    return;
  }

  // SELECCIÓN DE CLIENTE PARA FINALIZAR (desde menú interactivo)
  if (userPhone === ADVISOR_PHONE && messageText.startsWith('finalizar_')) {
    const clientPhone = messageText.replace('finalizar_', '');
    console.log(`🔚 Asesor seleccionó finalizar conversación con ${clientPhone}`);
    
    // Verificar que el cliente está realmente en conversación con asesor
    if (usersWithAdvisor.has(clientPhone)) {
      await closeClientConversation(clientPhone, userPhone);
    } else {
      await sendTextMessage(
        userPhone,
        `❌ *Error*\n\nEse cliente ya no está en conversación activa.`
      );
    }
    return;
  }

  // BOTONES DEL MENÚ PRINCIPAL (respuestas interactivas)
  if (messageText.startsWith('menu_')) {
    const menuOption = messageText.replace('menu_', '');
    
    if (menuOption === 'catalogo') {
      // Simular selección de opción 1
      await handleMainMenuSelection(userPhone, '1');
      return;
    } else if (menuOption === 'asesor') {
      // Simular selección de opción 2
      await handleMainMenuSelection(userPhone, '2');
      return;
    } else if (menuOption === 'horarios') {
      // Simular selección de opción 3
      await handleMainMenuSelection(userPhone, '3');
      return;
    }
  }

  // VERIFICAR SI ESTABA CON ASESOR PERO EXPIRÓ (24 horas)
  if (usersWithAdvisor.has(userPhone)) {
    const advisorSession = usersWithAdvisor.get(userPhone);
    const timeSinceStart = Date.now() - advisorSession.startTime;
    
    if (timeSinceStart > ADVISOR_CONVERSATION_TIMEOUT) {
      // Conversación expiró - cierre silencioso (sin mensaje)
      console.log(`⏰ Conversación con asesor expiró (24h) para ${userPhone} - Cierre silencioso`);
      usersWithAdvisor.delete(userPhone);
      
      // Simplemente mostrar el menú normalmente (experiencia fluida)
      await showMainMenu(userPhone);
      return;
    }
  }

  // SI EL USUARIO ESTÁ CON UN ASESOR (y NO ha expirado)
  if (isUserWithAdvisor(userPhone)) {
    // Si escribe "menú", desactivar modo asesor y volver al bot
    if (messageText === 'menu' || messageText === 'menú' || messageText === 'inicio') {
      deactivateAdvisorMode(userPhone);
      await sendTextMessage(userPhone, '✅ Conversación con asesor finalizada.\n\n🤖 Bot reactivado. Volviendo al menú principal...');
      await showMainMenu(userPhone);
      return;
    }
    
    // Actualizar actividad y enviar recordatorio
    updateLastActivity(userPhone);
    
    // Enviar mensaje recordatorio al usuario
    await sendTextMessage(
      userPhone,
      `⏳ *En conversación con asesor*\n\n` +
      `Tu consulta fue enviada. El asesor te responderá pronto.\n\n` +
      `💬 Puedes seguir escribiendo y el asesor verá tus mensajes.\n\n` +
      `_No finalices la sesión, pero si deseas volver al menú automático, escribe *menú*_`
    );
    
    console.log(`👤 Mensaje de ${userPhone} recibido - está en conversación con asesor`);
    return;
  }

  // VERIFICAR SI LA SESIÓN EXPIRÓ POR INACTIVIDAD (solo si NO está con asesor)
  if (isSessionExpired(userPhone)) {
    console.log(`🔄 Sesión expirada para ${userPhone}. Mostrando menú principal...`);
    // Limpiar modo asesor si estaba activo
    deactivateAdvisorMode(userPhone);
    // Notificar al usuario que su sesión expiró
    await sendTextMessage(
      userPhone,
      `⏱️ *Tu sesión ha expirado*\n\n` +
      `Por inactividad, hemos reiniciado la conversación.\n\n` +
      `A continuación, verás el menú principal. 👇`
    );
    // Mostrar menú de bienvenida
    await showMainMenu(userPhone);
    return;
  }

  // Actualizar timestamp de última actividad
  updateLastActivity(userPhone);

  // Inicializar sesión si no existe
  if (!userSessions[userPhone]) {
    userSessions[userPhone] = {
      state: 'MAIN_MENU',
      cart: [],
      selectedCategory: null,
      selectedSubcategory: null,
      categoriesList: [],
      subcategoriesList: []
    };
  }

  const session = userSessions[userPhone];

  try {
    // Comandos globales
    if (messageText === 'hola' || messageText === 'menu' || messageText === 'menú' || messageText === 'inicio') {
      await showMainMenu(userPhone);
      return;
    }

    // Navegación según el estado de la sesión
    switch (session.state) {
      case 'MAIN_MENU':
        await handleMainMenuSelection(userPhone, messageText);
        break;
      
      case 'WAITING_ADVISOR_QUERY':
        // El usuario escribió su consulta, ahora activar modo asesor con esa consulta
        await activateAdvisorMode(userPhone, message);
        break;
      
      case 'WITH_ADVISOR':
        // El usuario ya está con asesor, este caso ya se maneja arriba
        // No debería llegar aquí porque isUserWithAdvisor() ya lo captura
        console.log(`⚠️ Usuario ${userPhone} en estado WITH_ADVISOR pero no está en usersWithAdvisor`);
        await showMainMenu(userPhone);
        break;
      
      case 'CATEGORY_LIST':
        await handleCategorySelection(userPhone, messageText);
        break;
      
      case 'SUBCATEGORY_LIST':
        await handleSubcategorySelection(userPhone, messageText);
        break;

      default:
        await showMainMenu(userPhone);
    }
  } catch (error) {
    console.error('Error manejando selección:', error);
    await sendTextMessage(userPhone, '❌ Ocurrió un error. Por favor intenta de nuevo.');
    await showMainMenu(userPhone);
  }
};

/**
 * Muestra el menú principal
 */
const showMainMenu = async (userPhone) => {
  userSessions[userPhone] = {
    state: 'MAIN_MENU',
    cart: [],
    selectedCategory: null,
    selectedSubcategory: null,
    categoriesList: [],
    subcategoriesList: [],
    lastActivity: Date.now()
  };

  // Crear botones interactivos del menú principal
  const buttons = [
    {
      id: 'menu_catalogo',
      title: '📦 Ver catálogo'
    },
    {
      id: 'menu_asesor',
      title: '💬 Hablar con asesor'
    },
    {
      id: 'menu_horarios',
      title: '🕒 Ver horarios'
    }
  ];

  const bodyText = `👋 *¡Bienvenido a Zona Repuestera!*\n\n` +
    `🚗 Somos tu tienda de confianza para autopartes de calidad.\n\n` +
    `*¿Qué deseas hacer?*\n\n` +
    `_Si estás ausente durante 7 minutos, se terminará la sesión._`;

  await sendInteractiveButtons(userPhone, bodyText, buttons);
};

/**
 * Maneja la selección en el menú principal
 */
const handleMainMenuSelection = async (userPhone, messageText) => {
  // Aceptar número o palabra clave
  if (messageText === '1' || messageText.includes('catálogo') || messageText.includes('catalogo') || messageText.includes('producto')) {
    await showCategories(userPhone);
  } else if (messageText === '2' || messageText.includes('asesor') || messageText.includes('asesora') || messageText.includes('ayuda')) {
    // Cambiar estado para esperar la consulta del usuario
    userSessions[userPhone].state = 'WAITING_ADVISOR_QUERY';
    await sendTextMessage(
      userPhone,
      `📝 *Cuéntanos tu consulta*\n\n` +
      `Por favor, escribe en detalle qué información necesitas o en qué podemos ayudarte.\n\n` +
      `Un asesor recibirá tu mensaje y se contactará contigo *en breve*.\n\n` +
      `💬 _Escribe tu consulta ahora:_`
    );
  } else if (messageText === '3' || messageText.includes('horario')) {
    const mensaje = `🕒 *HORARIOS DE ATENCIÓN*\n\n` +
      `Lunes a Viernes: 8:00 AM - 6:00 PM\n` +
      `Sábados: 8:00 AM - 2:00 PM\n` +
      `Domingos: Cerrado\n\n` +
      `Escribe *menú* para volver al inicio.`;
    await sendTextMessage(userPhone, mensaje);
  } else {
    await sendTextMessage(
      userPhone,
      '❌ Opción no válida.\n\nPor favor escribe el *número* de la opción que deseas (1, 2 o 3).\n\nO escribe *menú* para ver las opciones.'
    );
  }
};

/**
 * Muestra la lista de categorías
 */
const showCategories = async (userPhone) => {
  userSessions[userPhone].state = 'CATEGORY_LIST';
  await sendTextMessage(userPhone, '⏳ Cargando catálogo...');
  
  try {
    const categories = await getCategories();
    
    if (!categories || categories.length === 0) {
      await sendTextMessage(userPhone, '❌ No hay categorías disponibles en este momento.');
      await showMainMenu(userPhone);
      return;
    }

    // Guardar categorías en la sesión
    userSessions[userPhone].categoriesList = categories;

    // Crear mensaje con todas las categorías numeradas
    let mensaje = `📋 *CATEGORÍAS DISPONIBLES*\n\n`;
    
    categories.forEach((cat, index) => {
      const numero = index + 1;
      const subcatInfo = cat.subcategory_count ? `\t\t(${cat.subcategory_count} subcategorías)` : '';
      mensaje += `${numero}. ${cat.name}${subcatInfo}\n`;
    });
    
    mensaje += `\n💬 *Escribe el número* de la categoría que deseas ver.`;
    mensaje += `\n\n_Ejemplo: escribe *1* para ver ${categories[0].name}_`;
    mensaje += `\n\nEscribe *menú* para volver al inicio.`;

    await sendTextMessage(userPhone, mensaje);
  } catch (error) {
    console.error('Error mostrando categorías:', error);
    await sendTextMessage(userPhone, '❌ Error al cargar el catálogo. Intenta de nuevo más tarde.');
    await showMainMenu(userPhone);
  }
};

/**
 * Maneja la selección de categoría
 */
const handleCategorySelection = async (userPhone, message) => {
  // El usuario escribe un número
  const numero = parseInt(message.trim());
  
  if (isNaN(numero) || numero < 1) {
    await sendTextMessage(userPhone, '❌ Por favor escribe un número válido.\n\nEscribe *catálogo* para ver las categorías de nuevo.');
    return;
  }

  const categories = userSessions[userPhone].categoriesList || [];
  
  if (numero > categories.length) {
    await sendTextMessage(userPhone, `❌ Número inválido. Tenemos ${categories.length} categorías.\n\nEscribe *catálogo* para ver la lista.`);
    return;
  }

  // Obtener la categoría seleccionada (índice = número - 1)
  const selectedCategory = categories[numero - 1];
  userSessions[userPhone].selectedCategory = selectedCategory.id;
  
  await showSubCategories(userPhone, selectedCategory.id);
};

/**
 * Muestra las subcategorías de una categoría
 */
const showSubCategories = async (userPhone, categoryId) => {
  userSessions[userPhone].state = 'SUBCATEGORY_LIST';
  await sendTextMessage(userPhone, '⏳ Cargando subcategorías...');
  
  try {
    const subcategories = await getSubCategories(categoryId);
    
    if (!subcategories || subcategories.length === 0) {
      await sendTextMessage(userPhone, '❌ No hay subcategorías disponibles para esta categoría.');
      await showCategories(userPhone);
      return;
    }

    // Guardar subcategorías en la sesión
    userSessions[userPhone].subcategoriesList = subcategories;

    // Crear mensaje con todas las subcategorías numeradas
    let mensaje = `📋 *SUBCATEGORÍAS DISPONIBLES*\n\n`;
    
    subcategories.forEach((subcat, index) => {
      const numero = index + 1;
      mensaje += `${numero}. ${subcat.name}\n`;
    });
    
    mensaje += `\n💬 *Escribe el número* de la subcategoría que deseas ver.`;
    mensaje += `\n\n_Ejemplo: escribe *1* para ver ${subcategories[0].name}_`;
    mensaje += `\n\nEscribe *menú* para volver al inicio.`;

    await sendTextMessage(userPhone, mensaje);
  } catch (error) {
    console.error('Error mostrando subcategorías:', error);
    await sendTextMessage(userPhone, '❌ Error al cargar subcategorías.');
    await showCategories(userPhone);
  }
};

/**
 * Maneja la selección de subcategoría
 */
const handleSubcategorySelection = async (userPhone, message) => {
  // El usuario escribe un número
  const numero = parseInt(message.trim());
  
  if (isNaN(numero) || numero < 1) {
    await sendTextMessage(userPhone, '❌ Por favor escribe un número válido.\n\nEscribe *catálogo* para volver al inicio.');
    return;
  }

  const subcategories = userSessions[userPhone].subcategoriesList || [];
  
  if (numero > subcategories.length) {
    await sendTextMessage(userPhone, `❌ Número inválido. Hay ${subcategories.length} subcategorías.\n\nEscribe *catálogo* para volver al inicio.`);
    return;
  }

  // Obtener la subcategoría seleccionada (índice = número - 1)
  const selectedSubcategory = subcategories[numero - 1];
  userSessions[userPhone].selectedSubcategory = selectedSubcategory.id;
  userSessions[userPhone].selectedSubcategoryData = selectedSubcategory; // Guardar datos completos
  
  // Primero verificar si esta subcategoría tiene más subcategorías
  await sendTextMessage(userPhone, '⏳ Verificando opciones disponibles...');
  
  const subSubcategories = await getSubCategories(selectedSubcategory.id);
  
  if (subSubcategories && subSubcategories.length > 0) {
    // Si tiene sub-subcategorías, mostrarlas
    await showSubCategories(userPhone, selectedSubcategory.id);
  } else {
    // Si no tiene más subcategorías, mostrar productos
    await showProducts(userPhone, selectedSubcategory.id);
  }
};

/**
 * Muestra los productos de una subcategoría
 */
const showProducts = async (userPhone, subcategoryId) => {
  userSessions[userPhone].state = 'PRODUCT_LIST';
  await sendTextMessage(userPhone, '⏳ Cargando productos...');
  
  try {
    const products = await getProducts(subcategoryId);
    
    if (!products || products.length === 0) {
      await sendTextMessage(userPhone, '❌ No hay productos disponibles en esta subcategoría.');
      const categoryId = userSessions[userPhone].selectedCategory;
      await showSubCategories(userPhone, categoryId);
      return;
    }

    // Formatear y enviar productos como mensajes de texto
    // WhatsApp limita el mensaje a 4096 caracteres, así que limitamos a 10 productos
    const maxProducts = 10;
    const productsToShow = products.slice(0, maxProducts);
    
    let mensaje = `🛒 *Productos Disponibles* (${products.length})\n\n`;
    
    productsToShow.forEach((prod, index) => {
      // Formatear precio en pesos colombianos
      const price = prod.final_price || prod.price || prod.base_price || 0;
      const formattedPrice = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }).format(price);
      
      // Nombre del producto sin asteriscos para evitar negrilla inconsistente
      mensaje += `${index + 1}. ${prod.name}\n`;
      mensaje += `   💰 Precio: ${formattedPrice}\n`;
      
      // Agregar código si existe
      if (prod.code || prod.sku) {
        mensaje += `   🔖 Código: ${prod.code || prod.sku}\n`;
      }
      
      // Agregar stock si existe
      if (prod.stock !== undefined && prod.stock !== null) {
        const stockStatus = prod.stock > 0 ? `✅ ${prod.stock} disponibles` : '❌ Agotado';
        mensaje += `   📦 Stock: ${stockStatus}\n`;
      }
      
      mensaje += '\n';
    });
    
    if (products.length > maxProducts) {
      mensaje += `_Mostrando ${maxProducts} de ${products.length} productos_\n\n`;
    }
    
    // Obtener datos de la subcategoría para generar el link correcto
    const subcategoryData = userSessions[userPhone].selectedSubcategoryData;
    const categoryId = userSessions[userPhone].selectedCategory;
    
    if (categoryId && subcategoryId) {
      // Link directo a los productos de esta subcategoría
      mensaje += `🌐 *Ver más información en la web:*\n`;
      mensaje += `https://zonarepuestera.com.co/products/?category=${categoryId}&subcategory=${subcategoryId}\n\n`;
    } else if (categoryId) {
      // Fallback: mostrar subcategorías de la categoría
      mensaje += `🌐 *Ver más en la tienda:*\n`;
      mensaje += `https://zonarepuestera.com.co/sub-categories/?category=${categoryId}\n\n`;
    } else {
      // Fallback general: link a productos
      mensaje += `🌐 *Ver más en la tienda:*\n`;
      mensaje += `https://zonarepuestera.com.co/products/\n\n`;
    }
    
    mensaje += `Escribe *menú* para volver al inicio o *catálogo* para seguir navegando.`;
    
    await sendTextMessage(userPhone, mensaje);
    userSessions[userPhone].state = 'MAIN_MENU';
    
  } catch (error) {
    console.error('Error mostrando productos:', error);
    await sendTextMessage(userPhone, '❌ Error al cargar productos.');
    const categoryId = userSessions[userPhone].selectedCategory;
    await showSubCategories(userPhone, categoryId);
  }
};

module.exports = {
  handleMenuSelection,
  showMainMenu,
  isUserWithAdvisor,
  deactivateAdvisorMode,
  finalizeAdvisorConversation,
  updateLastActivity  // Exportar para que el webhook la pueda usar
};
