const { sendTextMessage, sendInteractiveButtons, sendInteractiveList } = require('./whatsappService');
const { getCategories, getSubCategories, getProducts } = require('./ecommerceService');
const { getOrdersByEmail, formatOrdersList, formatOrderDetails, isValidEmail } = require('./orderService');
const {
  getCarBrands,
  getCarModels,
  getCategories: getProductCategories,
  getSubcategories: getProductSubcategories,
  searchProducts,
  formatProduct,
  formatProductList
} = require('./quoteService');
const conversationService = require('./conversationService');
const fs = require('fs');
const path = require('path');

// Almacenamiento temporal de sesiones de usuario (en producción usa Redis o DB)
const userSessions = {};

// Usuarios que están hablando con un asesor
const usersWithAdvisor = new Map(); // { userPhone: { startTime: Date, lastAdvisorMessage: Date } }

const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573164088588';
const ADVISOR_CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
const INACTIVITY_TIMEOUT = parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES || '20') * 60 * 1000; // 20 minutos de inactividad

// Configuración de limpieza de sesiones antiguas
const MAX_SESSION_AGE = 1 * 24 * 60 * 60 * 1000; // 1 día (24 horas)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Limpiar cada 24 horas

// Ruta al archivo de promociones (en directorio persistente para Render)
const PROMO_FILE_PATH = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/data/persistent/promoMessage.json'
    : path.join(__dirname, '../data/persistent/promoMessage.json');

// Mensaje por defecto
const DEFAULT_PROMO_MESSAGE = '🔥 *PROMOCIONES Y DESCUENTOS*\n\nActualmente no hay promociones activas.\n\nMantente atento a nuestras redes sociales.';

/**
 * Inicializa el archivo de promociones si no existe
 */
const initPromoFile = () => {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(PROMO_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Crear archivo con mensaje por defecto si no existe
    if (!fs.existsSync(PROMO_FILE_PATH)) {
      const defaultData = {
        message: DEFAULT_PROMO_MESSAGE,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Sistema'
      };
      fs.writeFileSync(PROMO_FILE_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('❌ Error inicializando archivo de promociones:', error);
  }
};

// Inicializar archivo al cargar el módulo
initPromoFile();

/**
 * Lee el mensaje de promociones desde el archivo JSON
 */
const getPromoMessage = () => {
  try {
    if (fs.existsSync(PROMO_FILE_PATH)) {
      const data = fs.readFileSync(PROMO_FILE_PATH, 'utf8');
      const promoData = JSON.parse(data);
      return promoData.message;
    }
  } catch (error) {
    console.error('Error leyendo mensaje de promociones:', error);
  }
  // Fallback al mensaje por defecto
  return DEFAULT_PROMO_MESSAGE;
};

/**
 * Actualiza el mensaje de promociones (solo el asesor puede hacerlo)
 */
const updatePromoMessage = (newMessage, updatedBy = 'Asesor') => {
  try {
    const promoData = {
      message: newMessage,
      lastUpdated: new Date().toISOString(),
      updatedBy: updatedBy
    };
    
    // Crear directorio si no existe
    const dir = path.dirname(PROMO_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(PROMO_FILE_PATH, JSON.stringify(promoData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error actualizando mensaje de promociones:', error);
    return false;
  }
};

/**
 * Limpia sesiones antiguas de la memoria para prevenir fuga de memoria
 * (Solo en memoria, NO guarda en BD)
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

};

// Ejecutar limpieza periódica cada 24 horas
setInterval(cleanupOldSessions, CLEANUP_INTERVAL);

// Ejecutar limpieza inicial 10 segundos después de arrancar
setTimeout(cleanupOldSessions, 10000);

/**
 * Inicializa una nueva sesión para un usuario (solo en memoria)
 */
const initializeUserSession = (userPhone) => {
  userSessions[userPhone] = {
    state: 'MAIN_MENU',
    cart: [],
    selectedCategory: null,
    selectedSubcategory: null,
    categoriesList: [],
    subcategoriesList: [],
    lastActivity: Date.now()
  };

  return userSessions[userPhone];
};

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
    return true;
  }

  return false;
};

/**
 * Actualiza el timestamp de última actividad del usuario (solo en memoria)
 */
const updateLastActivity = (userPhone) => {
  if (userSessions[userPhone]) {
    userSessions[userPhone].lastActivity = Date.now();
  }
};

/**
 * Cambia el estado de la sesión (solo en memoria)
 * Uso: setSessionState(userPhone, 'WITH_ADVISOR')
 */
const setSessionState = (userPhone, newState, additionalData = {}) => {
  if (!userSessions[userPhone]) {
    initializeUserSession(userPhone);
  }

  userSessions[userPhone].state = newState;

  // Aplicar datos adicionales si se proveen
  Object.assign(userSessions[userPhone], additionalData);
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
 * Verifica si estamos dentro del horario de atención
 * Lunes a viernes: 8:00 AM - 4:30 PM
 * Sábados: 8:00 AM - 12:40 PM
 * Domingos: Cerrado
 * Zona horaria: Colombia (America/Bogota, UTC-5)
 *
 * ⚠️ TEMPORALMENTE DESHABILITADO PARA PRUEBAS ⚠️
 */
const isWithinBusinessHours = () => {
  // ⚠️ COMENTADO TEMPORALMENTE PARA PRUEBAS - DESCOMENTAR EN PRODUCCIÓN
  return true; // Siempre retorna true para permitir pruebas fuera de horario

  /* DESCOMENTAR ESTE BLOQUE PARA ACTIVAR VALIDACIÓN DE HORARIO EN PRODUCCIÓN
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
  */
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
    usersWithAdvisor.delete(userPhone);
    return false;
  }

  return true;
};

/**
 * Activa el modo asesor para un usuario
 * @param {string} consultationType - Tipo de consulta: 'cotizacion', 'garantia', 'general'
 * @param {boolean} skipInitialMessage - Si es true, no guarda el mensaje inicial (usado cuando se envía imagen)
 */
const activateAdvisorMode = async (userPhone, userQuery = '', consultationType = 'general', skipInitialMessage = false) => {
  // Verificar si estamos dentro del horario de atención
  if (!isWithinBusinessHours()) {
    const outOfHoursMessage = `⏰ *FUERA DE HORARIO DE ATENCIÓN*\n\n` +
      `Lo sentimos, actualmente estamos fuera de nuestro horario de atención para brindar asesoría personalizada.\n\n` +
      `📅 *Nuestros horarios son:*\n` +
      `• Lunes a viernes: 8:00 AM - 4:30 PM\n` +
      `• Sábados: 8:00 AM - 12:40 PM\n` +
      `• Domingos: Cerrado\n\n` +
      `💡 Puedes contactarnos en nuestros horarios o seguir explorando más opciones en nuestro menú automático.`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, outOfHoursMessage, buttons);
    return;
  }

  const now = Date.now();
  const advisorSessionData = {
    startTime: now,
    lastAdvisorMessage: now,
    userQuery: userQuery,
    advisorHasResponded: false  // Inicialmente el asesor no ha respondido
  };
  usersWithAdvisor.set(userPhone, advisorSessionData);

  // Determinar emoji y texto según tipo de consulta
  let consultaIcon = '💬';
  let consultaType = 'ATENCIÓN GENERAL';

  if (consultationType === 'cotizacion') {
    consultaIcon = '🚗';
    consultaType = 'COTIZACIÓN DE REPUESTO';
  } else if (consultationType === 'garantia') {
    consultaIcon = '🛡️';
    consultaType = 'SOLICITUD DE GARANTÍA';
  }

  // Mensaje al cliente
  const clientMessage = `✅ *Solicitud enviada al asesor*\n\n` +
    `Hemos recibido tu consulta:\n"${userQuery}"\n\n` +
    `⏱️ *Un asesor se contactará contigo pronto.*\n` +
    `Estate pendiente de la respuesta.\n\n` +
    `💡 Si no quieres esperar, puedes volver al menú automático:`;

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, clientMessage, buttons);

  // CREAR mensaje de sistema con el tipo de consulta en el panel
  const systemMessage = `${consultaIcon} *Tipo de consulta:* ${consultaType}`;
  conversationService.addMessage(userPhone, {
    from: 'system',
    text: systemMessage,
    type: 'text'
  });

  // CREAR conversación en el panel con la consulta inicial
  // SOLO si no se debe saltar (skipInitialMessage se usa cuando envía imagen)
  if (!skipInitialMessage) {
    conversationService.addMessage(userPhone, {
      from: 'client',
      text: userQuery,
      type: 'text'
    });
  }

  // Cambiar estado de la sesión para que no procese más mensajes como nueva consulta
  if (userSessions[userPhone]) {
    userSessions[userPhone].state = 'WITH_ADVISOR';
    userSessions[userPhone].advisorSession = advisorSessionData;
  }

  // IMPORTANTE: Emitir evento WebSocket adicional para habilitar textarea en el panel
  // El mensaje de confirmación anterior no incluye isWithAdvisor, así que lo enviamos ahora
  const io = global.io;
  if (io) {
    io.emit('advisor_mode_activated', {
      phoneNumber: userPhone,
      isWithAdvisor: true
    });
  }
};

/**
 * Desactiva el modo asesor para un usuario
 */
const deactivateAdvisorMode = async (userPhone) => {
  if (usersWithAdvisor.has(userPhone)) {
    usersWithAdvisor.delete(userPhone);

    // Actualizar sesión en memoria y BD
    if (userSessions[userPhone]) {
      delete userSessions[userPhone].advisorSession;
      if (userSessions[userPhone].state === 'WITH_ADVISOR') {
        userSessions[userPhone].state = 'MAIN_MENU';
      }
      
    }

    return true;
  }
  return false;
};

/**
 * Marca que el asesor ha respondido a un usuario
 * Se llama desde el panel cuando el asesor envía un mensaje
 */
const markAdvisorResponse = (userPhone) => {
  if (usersWithAdvisor.has(userPhone)) {
    const session = usersWithAdvisor.get(userPhone);
    session.advisorHasResponded = true;
    session.lastAdvisorMessage = Date.now();
    usersWithAdvisor.set(userPhone, session);
    return true;
  }
  return false;
};

/**
 * Maneja la selección del menú según el mensaje del usuario
 */
const handleMenuSelection = async (userPhone, message) => {
  // VALIDACIONES DE SEGURIDAD
  try {
    // Validar que userPhone existe y es string
    if (!userPhone || typeof userPhone !== 'string') {
      console.error('❌ userPhone inválido:', userPhone);
      return;
    }

    // Validar que message existe
    if (message === null || message === undefined) {
      console.error('❌ mensaje null/undefined de:', userPhone);
      return;
    }

    // Convertir message a string si no lo es
    message = String(message);

    // Limitar longitud del mensaje para prevenir ataques
    const MAX_MESSAGE_LENGTH = 10000;
    if (message.length > MAX_MESSAGE_LENGTH) {
      console.warn(`⚠️ Mensaje muy largo (${message.length} chars) de ${userPhone} - Truncando`);
      message = message.substring(0, MAX_MESSAGE_LENGTH);
    }

    const messageText = message.toLowerCase().trim();

    // Verificar si está en modo asesor para guardar en panel
    const userState = userSessions[userPhone]?.state || 'UNKNOWN';
    const isWithAdvisorMap = isUserWithAdvisor(userPhone);
    const isInAdvisorMode = isWithAdvisorMap ||
                           userState === 'WAITING_ADVISOR_QUERY' ||
                           userState === 'WITH_ADVISOR';

    // SOLO registrar mensaje del cliente en el panel SI está con asesor
    if (userPhone !== ADVISOR_PHONE && isInAdvisorMode) {
      conversationService.addMessage(userPhone, {
        from: 'client',
        text: message,
        type: 'text'
      });

      // Notificar al panel mediante WebSocket
      const io = global.io;
      if (io) {
        io.emit('new_message', {
          phoneNumber: userPhone,
          message: {
            from: 'client',
            text: message,
            timestamp: new Date()
          },
          userState: userState,
          messageId: message,
          isWithAdvisor: isInAdvisorMode
        });
      }
    }







  // BOTONES DEL MENÚ PRINCIPAL (respuestas interactivas)
  // Manejar botón "Volver al menú"
  if (messageText === 'volver_menu') {
    await showMainMenu(userPhone);
    return;
  }

  // Manejar botón "Repetir correo"
  if (messageText === 'repetir_correo') {
    userSessions[userPhone].state = 'WAITING_EMAIL_FOR_ORDERS';
    await sendTextMessage(
      userPhone,
      '📧 *Por favor, ingresa tu correo electrónico*\n\n' +
      'Escribe el correo que usaste al hacer tu compra:'
    );

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    return;
  }

  // Manejar botones del menú de asesor
  if (messageText === 'asesor_varios') {
    // Flujo actual: pedir consulta general
    userSessions[userPhone].state = 'WAITING_ADVISOR_QUERY';

    const mensaje = `¡Perfecto! 👨‍💼\n\n` +
      `*¿Has elegido hablar con un asesor?*\n\n` +
      `Cuéntanos aquí tu problema o consulta, y un asesor se contactará contigo *en breve* para ayudarte. 😊\n\n` +
      `💬 _Escribe tu consulta ahora:_\n\n` +
      `Estoy atento si necesitas más información o ayuda 😊`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
    return;
  }

  if (messageText === 'asesor_cotizar') {
    // Nuevo flujo: pedir datos para cotización
    userSessions[userPhone].state = 'WAITING_QUOTE_DATA_FOR_ADVISOR';

    const mensaje = `¡Perfecto! 🚗 *Para ayudarte a cotizar, por favor compárteme los siguientes datos:*\n\n` +
      `✔ Marca del vehículo (Hyundai, Kia, Chevrolet, Renault, etc.)\n` +
      `✔ Modelo o línea (por ejemplo, Accent, Sail, Logan…)\n` +
      `✔ Año o cilindraje del vehículo.\n` +
      `✔ Nombre del repuesto que necesitas (ej: radiador, rótula, correa, etc.)\n` +
      `✔ Si tienes la referencia original o una foto, ¡envíala aquí! 📸\n\n` +
      `💬 _Escribe toda la información ahora:_\n\n` +
      `Estoy atento si necesitas más información o ayuda 😊`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
    return;
  }

  // Manejar botones interactivos del menú principal
  if (messageText.startsWith('menu_')) {
    const menuOption = messageText.replace('menu_', '');

    if (menuOption === 'cotizar') {
      await startQuoteFlow(userPhone);
      return;
    } else if (menuOption === 'catalogo') {
      await showCategories(userPhone);
      return;
    } else if (menuOption === 'asesor') {
      // Verificar horario de atención ANTES de mostrar el menú
      if (!isWithinBusinessHours()) {
        const outOfHoursMessage = `⏰ *FUERA DE HORARIO DE ATENCIÓN*\n\n` +
          `Lo sentimos, actualmente estamos fuera de nuestro horario de atención para brindar asesoría personalizada.\n\n` +
          `📅 *Nuestros horarios son:*\n` +
          `• Lunes a viernes: 8:00 AM - 4:30 PM\n` +
          `• Sábados: 8:00 AM - 12:40 PM\n` +
          `• Domingos: Cerrado\n\n` +
          `💡 Puedes contactarnos en nuestros horarios o seguir explorando más opciones en nuestro menú automático.`;

        const buttons = [
          { id: 'volver_menu', title: '🏠 Volver al menú' }
        ];

        await sendInteractiveButtons(userPhone, outOfHoursMessage, buttons);
            return;
      }

      // Mostrar menú de opciones de asesor
      userSessions[userPhone].state = 'ADVISOR_MENU';

      const mensaje = `¡Hola! 👋 Estoy aquí para ayudarte 😊\n\n` +
        `*¿Cómo te gustaría que te asista hoy?*\n\n` +
        `Selecciona una opción y con gusto te atenderé:`;

      const buttons = [
        { id: 'asesor_cotizar', title: '🔍 Cotizar autoparte' },
        { id: 'asesor_varios', title: '💬 Atención general' },
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];

      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    } else if (menuOption === 'horarios') {
      userSessions[userPhone].state = 'VIEWING_INFO';
      const mensaje = `🕒 *HORARIOS DE ATENCIÓN*\n\n` +
        `Lunes a Viernes: 8:00 AM - 4:30 PM\n` +
        `Sábados: 8:00 AM - 12:40 PM\n` +
        `Domingos: Cerrado`;
      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];
      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    } else if (menuOption === 'garantias') {
      userSessions[userPhone].state = 'WAITING_WARRANTY_REQUEST';
      const mensaje = `🛡️ *GARANTÍAS Y DEVOLUCIONES*\n\n` +
        `🧾 *Todos nuestros productos cuentan con garantía de 3 meses*, excepto la línea de eléctricos originales.\n\n` +
        `⚠️ *Importante:* Los productos eléctricos originales tienen garantía *solo si presentan fallas de fábrica en el momento de la instalación*.\n\n` +
        `Después de instalados y en funcionamiento, no aplica garantía por daños causados por mal uso, voltajes incorrectos u otras manipulaciones.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 *¿Necesitas hacer una solicitud de garantía?*\n\n` +
        `Por favor escríbenos en un solo mensaje los siguientes datos:\n\n` +
        `✔ Número de pedido\n` +
        `✔ Nombre del producto\n` +
        `✔ Breve descripción del problema\n\n` +
        `💬 *Un asesor revisará tu caso y se contactará contigo de inmediato.*`;
      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];
      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    } else if (menuOption === 'envios') {
      userSessions[userPhone].state = 'VIEWING_INFO';
      const mensaje = `📮 *INFORMACIÓN SOBRE TIEMPOS DE ENVÍO Y PAGOS*\n\n` +
        `📮 Realizamos envíos a todo Colombia.\n\n` +
        `🚚 *Tiempo estimado:* 1 a 3 días hábiles en ciudades principales\n\n` +
        `💳 *Métodos de pago:* Wompi, Addi, transferencia, contra entrega (según zona)\n\n` +
        `📦 Empacamos con cuidado para garantizar que tus repuestos lleguen en perfecto estado.`;
      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];
      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    } else if (menuOption === 'puntos') {
      userSessions[userPhone].state = 'VIEWING_INFO';
      const mensaje = `📍 *PUNTOS DE ENTREGA O RECOGIDA LOCAL*\n\n` +
        `📦 Puedes recoger tu pedido en nuestra sede o coordinar contra entrega (según zona)\n\n` +
        `📍 *Dirección:* CR 50A # 46 – 48, Piso 3. Itagüí (Antioquia)\n\n` +
        `📞 *Teléfono:* 316 483 6166\n\n` +
        `🕓 *Horario:*\n` +
        `Lunes a viernes 8:00 a.m. – 4:30 p.m.\n` +
        `Sábados 8:00 a.m. – 12:40 p.m.\n\n` +
        `📌 Ver en Google Maps:\n` +
        `https://www.google.com/maps/search/?api=1&query=CR+50A+%23+46-48+Itagüí+Antioquia`;
      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];
      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    } else if (menuOption === 'promociones') {
      userSessions[userPhone].state = 'VIEWING_INFO';
      const mensajePromo = getPromoMessage();
      const mensajeFinal = mensajePromo + '\n\nEstoy atento si necesitas más información o ayuda 😊';
      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];
      await sendInteractiveButtons(userPhone, mensajeFinal, buttons);
      return;
    } else if (menuOption === 'pedidos') {
      userSessions[userPhone].state = 'WAITING_EMAIL_FOR_ORDERS';

      const mensaje = `¡Perfecto! 🎯\n\n` +
        `📦 *¿Quieres consultar tu pedido?*\n\n` +
        `Por favor, escríbeme el 📧 *correo electrónico* con el que hiciste tu compra y te mostraré toda la información de tu pedido. 😊\n\n` +
        `✍️ _Escribe tu correo aquí:_\n\n` +
        `Estoy atento si necesitas más información o ayuda 😊`;

      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];

      await sendInteractiveButtons(userPhone, mensaje, buttons);
      return;
    }
  }

  // VERIFICAR SI ESTABA CON ASESOR PERO EXPIRÓ (24 horas)
  if (usersWithAdvisor.has(userPhone)) {
    const advisorSession = usersWithAdvisor.get(userPhone);
    const timeSinceStart = Date.now() - advisorSession.startTime;
    
    if (timeSinceStart > ADVISOR_CONVERSATION_TIMEOUT) {
      // Conversación expiró - cierre silencioso (sin mensaje)
      usersWithAdvisor.delete(userPhone);
      
      // Simplemente mostrar el menú normalmente (experiencia fluida)
      await showMainMenu(userPhone);
      return;
    }
  }

  // SI EL USUARIO ESTÁ CON UN ASESOR (y NO ha expirado)
  if (isUserWithAdvisor(userPhone)) {
    // Actualizar actividad
    updateLastActivity(userPhone);

    // Obtener sesión del asesor para verificar si ya respondió
    const advisorSession = usersWithAdvisor.get(userPhone);

    // Solo enviar recordatorio si el asesor NO ha respondido aún
    if (!advisorSession.advisorHasResponded) {
      await sendTextMessage(
        userPhone,
        `⏳ *En conversación con asesor*\n\n` +
        `Tu consulta fue enviada. El asesor te responderá pronto.\n\n` +
        `💬 Puedes seguir escribiendo y el asesor verá tus mensajes.`
      );
    } else {
      // El asesor ya respondió, solo registrar el mensaje sin enviar recordatorio
    }

    return;
  }

  // VERIFICAR SI LA SESIÓN EXPIRÓ POR INACTIVIDAD (solo si NO está con asesor)
  if (isSessionExpired(userPhone)) {
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
    await initializeUserSession(userPhone);
  }

  const session = userSessions[userPhone];

  try {
    // Navegación según el estado de la sesión
    switch (session.state) {
      case 'MAIN_MENU':
        await handleMainMenuSelection(userPhone, messageText);
        break;
      
      case 'WAITING_ADVISOR_QUERY':
        // El usuario escribió su consulta, ahora activar modo asesor con esa consulta
        await activateAdvisorMode(userPhone, message, 'general');
        break;

      case 'WAITING_WARRANTY_REQUEST':
        // El usuario proporcionó los datos de garantía, activar modo asesor
        await sendTextMessage(
          userPhone,
          `✅ *Solicitud de garantía recibida*\n\n` +
          `Un asesor revisará tu caso y se contactará contigo de inmediato. 💬`
        );
        // Activar modo asesor con los datos de garantía
        await activateAdvisorMode(userPhone, message, 'garantia');
        break;

      case 'WAITING_QUOTE_DATA_FOR_ADVISOR':
        // El usuario proporcionó los datos de cotización
        await sendTextMessage(
          userPhone,
          `¡Gracias por la información! 🚗\n\n` +
          `Un asesor estará contigo en breve.`
        );
        // Activar modo asesor con los datos de cotización
        await activateAdvisorMode(userPhone, message, 'cotizacion');
        break;

      case 'WAITING_EMAIL_FOR_ORDERS':
        // El usuario escribió su email para consultar pedidos
        await handleOrdersEmailInput(userPhone, message);
        break;
      
      case 'VIEWING_ORDER_DETAILS':
        // El usuario seleccionó un pedido para ver detalles
        await handleOrderSelection(userPhone, messageText);
        break;
      
      case 'WITH_ADVISOR':
        // El usuario ya está con asesor, este caso ya se maneja arriba
        // No debería llegar aquí porque isUserWithAdvisor() ya lo captura
        await showMainMenu(userPhone);
        break;
      
      case 'CATEGORY_LIST':
        await handleCategorySelection(userPhone, messageText);
        break;
      
      case 'SUBCATEGORY_LIST':
        await handleSubcategorySelection(userPhone, messageText);
        break;

      case 'PRODUCT_LIST':
        // Usuario está viendo lista de productos y puede seleccionar por número
        const catalogProductIndex = parseInt(messageText);
        if (!isNaN(catalogProductIndex) && catalogProductIndex > 0) {
          await showProductDetails(userPhone, catalogProductIndex);
        } else {
          await sendTextMessage(
            userPhone,
            `❌ Por favor escribe el número del producto que deseas ver.\n\n` +
            `Ejemplo: escribe *5* para ver los detalles del producto #5`
          );
        }
        break;

      case 'QUOTE_SELECT_BRAND':
        // Usuario seleccionó una marca de vehículo (por número)
        const brandIndex = parseInt(messageText);
        if (!isNaN(brandIndex) && brandIndex > 0 && userSessions[userPhone].carBrandsList) {
          const selectedBrand = userSessions[userPhone].carBrandsList[brandIndex - 1];
          if (selectedBrand) {
            // Mostrar modelos de la marca seleccionada
            await showCarModels(userPhone, selectedBrand.id);
          } else {
            await sendTextMessage(userPhone, '❌ Número inválido. Por favor elige un número de la lista.');
            const buttons = [
              { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
              { id: 'volver_menu', title: '🏠 Volver al menú' }
            ];
            await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
          }
        } else {
          await sendTextMessage(userPhone, '❌ Por favor responde con el número de la marca que deseas.');
          const buttons = [
            { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
            { id: 'volver_menu', title: '🏠 Volver al menú' }
          ];
          await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
        }
        break;
      
      case 'QUOTE_SELECT_MODEL':
        // Usuario seleccionó un modelo de vehículo (por número)
        const modelIndex = parseInt(messageText);
        if (!isNaN(modelIndex) && modelIndex > 0 && userSessions[userPhone].carModelsList) {
          const selectedModel = userSessions[userPhone].carModelsList[modelIndex - 1];
          if (selectedModel) {
            userSessions[userPhone].quoteFilters.model = selectedModel.id;
            await showQuoteCategories(userPhone);
          } else {
            await sendTextMessage(userPhone, '❌ Número inválido. Por favor elige un número de la lista.');
            const buttons = [
              { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
              { id: 'volver_menu', title: '🏠 Volver al menú' }
            ];
            await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
          }
        } else {
          await sendTextMessage(userPhone, '❌ Por favor responde con el número del modelo que deseas.');
          const buttons = [
            { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
            { id: 'volver_menu', title: '🏠 Volver al menú' }
          ];
          await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
        }
        break;

      case 'QUOTE_SELECT_CATEGORY':
        // Usuario seleccionó una categoría de producto (por número)
        const categoryIndex = parseInt(messageText);
        if (!isNaN(categoryIndex) && categoryIndex > 0 && userSessions[userPhone].quoteCategoriesList) {
          const selectedCategory = userSessions[userPhone].quoteCategoriesList[categoryIndex - 1];
          if (selectedCategory) {
            userSessions[userPhone].quoteCategoryName = selectedCategory.name;
            await showQuoteSubcategories(userPhone, selectedCategory.id, selectedCategory.name);
          } else {
            await sendTextMessage(userPhone, '❌ Número inválido. Por favor elige un número de la lista.');
            const buttons = [
              { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
              { id: 'volver_menu', title: '🏠 Volver al menú' }
            ];
            await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
          }
        } else {
          await sendTextMessage(userPhone, '❌ Por favor responde con el número de la categoría que necesitas.');
          const buttons = [
            { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
            { id: 'volver_menu', title: '🏠 Volver al menú' }
          ];
          await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
        }
        break;

      case 'QUOTE_SELECT_SUBCATEGORY':
        // Usuario seleccionó una subcategoría o decidió omitirla (por número)
        const subcategoryIndex = parseInt(messageText);
        if (subcategoryIndex === 0) {
          // Omitir subcategoría
          await searchQuoteProducts(userPhone);
        } else if (!isNaN(subcategoryIndex) && subcategoryIndex > 0 && userSessions[userPhone].quoteSubcategoriesList) {
          const selectedSubcategory = userSessions[userPhone].quoteSubcategoriesList[subcategoryIndex - 1];
          if (selectedSubcategory) {
            userSessions[userPhone].quoteFilters.subcategory = selectedSubcategory.id;
            await searchQuoteProducts(userPhone);
          } else {
            await sendTextMessage(userPhone, '❌ Número inválido. Por favor elige un número de la lista o 0 para omitir.');
            const buttons = [
              { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
              { id: 'volver_menu', title: '🏠 Volver al menú' }
            ];
            await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
          }
        } else {
          await sendTextMessage(userPhone, '❌ Por favor responde con el número de la subcategoría o 0 para omitir.');
          const buttons = [
            { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
            { id: 'volver_menu', title: '🏠 Volver al menú' }
          ];
          await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
        }
        break;

      case 'QUOTE_VIEW_RESULTS':
        // Usuario está viendo resultados y puede seleccionar un producto por número
        const productIndex = parseInt(messageText);
        if (!isNaN(productIndex) && productIndex > 0) {
          await showQuoteProductDetails(userPhone, productIndex);
        } else if (messageText.toLowerCase().includes('siguiente') || messageText.toLowerCase().includes('mas')) {
          // Mostrar siguiente página de resultados
          const currentPage = userSessions[userPhone].quoteResultsPage || 1;
          const results = userSessions[userPhone].quoteResults || [];
          const totalPages = Math.ceil(results.length / 5);

          if (currentPage < totalPages) {
            userSessions[userPhone].quoteResultsPage = currentPage + 1;
            const productList = formatProductList(results, currentPage + 1, 5);
            await sendTextMessage(userPhone, productList);
          } else {
            await sendTextMessage(userPhone, '📄 Ya estás en la última página de resultados.');
            const buttons = [
              { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
              { id: 'volver_menu', title: '🏠 Volver al menú' }
            ];
            await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
          }
        } else {
          await sendTextMessage(userPhone, '❌ Por favor ingresa el número del producto que deseas ver o escribe "siguiente" para más resultados.');
          const buttons = [
            { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
            { id: 'volver_menu', title: '🏠 Volver al menú' }
          ];
          await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
        }
        break;

      case 'VIEWING_INFO':
        // Usuario está viendo información estática (horarios, garantías, envíos, puntos, promociones)
        // Solo aceptar botones, rechazar cualquier otro input
        const errorMsg = '❌ *Opción no válida.*';
        const buttons = [
          { id: 'volver_menu', title: '🏠 Volver al menú' }
        ];
        await sendInteractiveButtons(userPhone, errorMsg, buttons);
        break;

      case 'ADVISOR_MENU':
        // Usuario está en el menú de selección de tipo de asesor
        // Solo aceptar botones, rechazar cualquier otro input
        const advisorMenuErrorMsg = '❌ *Opción no válida.*\n\nPor favor selecciona una de las opciones del menú.';
        const advisorMenuButtons = [
          { id: 'asesor_cotizar', title: '🔍 Cotizar autoparte' },
          { id: 'asesor_varios', title: '💬 Atención general' },
          { id: 'volver_menu', title: '🏠 Volver al menú' }
        ];
        await sendInteractiveButtons(userPhone, advisorMenuErrorMsg, advisorMenuButtons);
        break;

      default:
        await showMainMenu(userPhone);
    }

    // Persistir sesión después de cualquier cambio en el switch
    

  } catch (error) {
    console.error('Error manejando selección:', error);
    // Intentar enviar mensaje de error al usuario
    try {
      await sendTextMessage(userPhone, '❌ Ocurrió un error. Por favor intenta de nuevo.');
      await showMainMenu(userPhone);
    } catch (innerError) {
      console.error('❌ Error crítico enviando mensaje de error:', innerError);
      // No hacer nada más, evitar loop infinito
    }
  }
  } catch (outerError) {
    // Capturar errores en las validaciones iniciales
    console.error('❌ Error crítico en handleMenuSelection:', outerError);
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

  // Crear lista interactiva del menú principal
    const sections = [
      {
        title: "Opciones disponibles",
        rows: [
          {
            id: 'menu_cotizar',
            title: '🔍 Cotizar un repuesto',
            description: 'Busca por marca y modelo de vehículo'
          },
          {
            id: 'menu_catalogo',
            title: '📚 Ver catálogo',
            description: 'Explora nuestros productos'
          },
          {
            id: 'menu_pedidos',
            title: '📦 Estado de pedido',
            description: 'Consulta el estado de tu pedido'
          },
          {
            id: 'menu_garantias',
            title: '🛡️ Garantías',
            description: 'Garantías y devoluciones'
          },
          {
            id: 'menu_promociones',
            title: '🔥 Promociones',
            description: 'Descuentos y ofertas del mes'
          },
          {
            id: 'menu_envios',
            title: '📮 Envío y pagos',
            description: 'Tiempos, métodos de pago y envíos'
          },
          {
            id: 'menu_puntos',
            title: '📍 Puntos de entrega',
            description: 'Recogida local y dirección'
          },
          {
            id: 'menu_asesor',
            title: '💬 Hablar con asesor',
            description: 'Atención personalizada'
          },
          {
            id: 'menu_horarios',
            title: '🕒 Ver horarios',
            description: 'Horarios de atención'
          }
        ]
      }
    ];

  const bodyText = `👋 ¡Hola! Soy *ZonaBot*, el asistente virtual de Zona Repuestera 🚗💬\n\n` +
    `Estoy aquí para ayudarte con todo lo que necesites sobre *autopartes, cotizaciones, envío y más*.\n\n` +
    `Por favor selecciona una de las siguientes opciones para continuar 👇🏻\n\n` +
    `_Si estás ausente durante 20 minutos, se terminará la sesión._`;

  await sendInteractiveList(userPhone, bodyText, '📋 Ver opciones', sections);
};

/**
 * Maneja la selección en el menú principal
 * IMPORTANTE: Solo acepta palabras clave (no números), ya que el menú es interactivo
 */
const handleMainMenuSelection = async (userPhone, messageText) => {
  // Solo aceptar palabras clave (no números)
  if (messageText.includes('catálogo') || messageText.includes('catalogo') || messageText.includes('producto')) {
    await showCategories(userPhone);
  } else if (messageText.includes('asesor') || messageText.includes('asesora') || messageText.includes('ayuda')) {
    // Verificar horario de atención ANTES de mostrar el menú
    if (!isWithinBusinessHours()) {
      const outOfHoursMessage = `⏰ *FUERA DE HORARIO DE ATENCIÓN*\n\n` +
        `Lo sentimos, actualmente estamos fuera de nuestro horario de atención para brindar asesoría personalizada.\n\n` +
        `📅 *Nuestros horarios son:*\n` +
        `• Lunes a viernes: 8:00 AM - 4:30 PM\n` +
        `• Sábados: 8:00 AM - 12:40 PM\n` +
        `• Domingos: Cerrado\n\n` +
        `💡 Puedes contactarnos en nuestros horarios o seguir explorando más opciones en nuestro menú automático.`;

      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];

      await sendInteractiveButtons(userPhone, outOfHoursMessage, buttons);
        return;
    }

    // Mostrar menú de opciones de asesor
    userSessions[userPhone].state = 'ADVISOR_MENU';

    const mensaje = `¡Hola! 👋 Estoy aquí para ayudarte 😊\n\n` +
      `*¿Cómo te gustaría que te asista hoy?*\n\n` +
      `Selecciona una opción y con gusto te atenderé:`;

    const buttons = [
      { id: 'asesor_cotizar', title: '🔍 Cotizar autoparte' },
      { id: 'asesor_varios', title: '💬 Atención general' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else if (messageText.includes('horario')) {
    userSessions[userPhone].state = 'VIEWING_INFO';
    const mensaje = `🕒 *HORARIOS DE ATENCIÓN*\n\n` +
      `Lunes a Viernes: 8:00 AM - 4:30 PM\n` +
      `Sábados: 8:00 AM - 12:40 PM\n` +
      `Domingos: Cerrado`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else if (messageText.includes('garantía') || messageText.includes('garantia') || messageText.includes('devoluc')) {
    userSessions[userPhone].state = 'VIEWING_INFO';
    const mensaje = `🛡️ *GARANTÍAS Y DEVOLUCIONES*\n\n` +
      `🧾 *Todos nuestros productos cuentan con garantía de 3 meses*, excepto la línea de eléctricos originales.\n\n` +
      `⚠️ *Importante:* Los productos eléctricos originales tienen garantía *solo si presentan fallas de fábrica en el momento de la instalación*.\n\n` +
      `Después de instalados y en funcionamiento, no aplica garantía por daños causados por mal uso, voltajes incorrectos u otras manipulaciones.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Si presentas algún inconveniente con tu compra, escríbenos con:\n\n` +
      `✔ Número de pedido\n` +
      `✔ Nombre del producto\n` +
      `✔ Breve descripción del caso\n\n` +
      `Nuestro equipo revisará tu solicitud y te responderá lo antes posible.`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else if (messageText.includes('envío') || messageText.includes('envio') || messageText.includes('pago')) {
    userSessions[userPhone].state = 'VIEWING_INFO';
    const mensaje = `📮 *INFORMACIÓN SOBRE TIEMPOS DE ENVÍO Y PAGOS*\n\n` +
      `📮 Realizamos envíos a todo Colombia.\n\n` +
      `🚚 *Tiempo estimado:* 1 a 3 días hábiles\n\n` +
      `💳 *Métodos de pago:* Wompi, Addi, transferencia, contra entrega (según zona)\n\n` +
      `📦 Empacamos con cuidado para garantizar que tus repuestos lleguen en perfecto estado.`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else if (messageText.includes('punto') || messageText.includes('entrega') || messageText.includes('recogida') || messageText.includes('dirección') || messageText.includes('direccion')) {
    userSessions[userPhone].state = 'VIEWING_INFO';
    const mensaje = `📍 *PUNTOS DE ENTREGA O RECOGIDA LOCAL*\n\n` +
      `📦 Puedes recoger tu pedido en nuestra sede o coordinar contra entrega (según zona)\n\n` +
      `📍 *Dirección:* CR 50A # 46 – 48, Piso 3. Itagüí (Antioquia)\n\n` +
      `📞 *Teléfono:* 316 483 6166\n\n` +
      `🕓 *Horario:*\n` +
      `Lunes a viernes 8:00 a.m. – 4:30 p.m.\n` +
      `Sábados 8:00 a.m. – 12:40 p.m.\n\n` +
      `📌 Ver en Google Maps:\n` +
      `https://www.google.com/maps/search/?api=1&query=CR+50A+%23+46-48+Itagüí+Antioquia`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else if (messageText.includes('promo') || messageText.includes('descuento') || messageText.includes('oferta')) {
    userSessions[userPhone].state = 'VIEWING_INFO';
    // Obtener mensaje de promociones
    const mensajePromo = getPromoMessage();
    const mensajeFinal = mensajePromo + '\n\nEstoy atento si necesitas más información o ayuda 😊';

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensajeFinal, buttons);
  } else if (messageText.includes('pedido') || messageText.includes('orden') || messageText.includes('estado')) {
    // Solicitar email para consultar pedidos
    userSessions[userPhone].state = 'WAITING_EMAIL_FOR_ORDERS';

    const mensaje = `¡Perfecto! 🎯\n\n` +
      `📦 *¿Quieres consultar tu pedido?*\n\n` +
      `Por favor, escríbeme el 📧 *correo electrónico* con el que hiciste tu compra y te mostraré toda la información de tu pedido. 😊\n\n` +
      `✍️ _Escribe tu correo aquí:_\n\n` +
      `Estoy atento si necesitas más información o ayuda 😊`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
  } else {
    // Rechazar cualquier otro input (incluyendo números)
    const errorMsg = `❌ *Opción no válida.*\n\n` +
      `Por favor, usa el botón *"📋 Ver opciones"* del menú para seleccionar una opción.`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Ver menú' }
    ];

    await sendInteractiveButtons(userPhone, errorMsg, buttons);
  }
};

/**
 * Muestra la lista de categorías
 */
const showCategories = async (userPhone) => {
  userSessions[userPhone].state = 'CATEGORY_LIST';

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
    let mensaje = `🔧 *Estas son nuestras categorías principales*\n\n`;

    categories.forEach((cat, index) => {
      const numero = index + 1;
      const subcatInfo = cat.subcategory_count ? ` (${cat.subcategory_count}sub)` : '';
      mensaje += `${numero}. ${cat.name}${subcatInfo}\n`;
    });
    
    mensaje += `\n💬 *Escribe el número* de la categoría que deseas ver.`;
    mensaje += `\n\n_Ejemplo: escribe *1* para ver ${categories[0].name}_`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
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
    const buttons = [
      { id: 'menu_catalogo', title: '📦 Ver catálogo' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, '❌ Por favor escribe un número válido.', buttons);
    return;
  }

  const categories = userSessions[userPhone].categoriesList || [];
  
  if (numero > categories.length) {
    const buttons = [
      { id: 'menu_catalogo', title: '📦 Ver catálogo' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, `❌ Número inválido. Tenemos ${categories.length} categorías.`, buttons);
    return;
  }

  // Obtener la categoría seleccionada (índice = número - 1)
  const selectedCategory = categories[numero - 1];
  userSessions[userPhone].selectedCategory = selectedCategory.id;
  userSessions[userPhone].selectedCategoryName = selectedCategory.name;

  await showSubCategories(userPhone, selectedCategory.id, selectedCategory.name);
};

/**
 * Muestra las subcategorías de una categoría
 */
const showSubCategories = async (userPhone, categoryId, categoryName = null) => {
  userSessions[userPhone].state = 'SUBCATEGORY_LIST';

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
    // Usar el nombre de la categoría si está disponible, sino buscar en la sesión
    const catName = categoryName || userSessions[userPhone].selectedCategoryName || 'esta categoría';
    let mensaje = `¡Perfecto! *Estas son las subcategorías de ${catName}*\n\n`;
    
    subcategories.forEach((subcat, index) => {
      const numero = index + 1;
      mensaje += `${numero}. ${subcat.name}\n`;
    });
    
    mensaje += `\n💬 *Escribe el número* de la subcategoría que deseas ver.`;
    mensaje += `\n\n_Ejemplo: escribe *1* para ver ${subcategories[0].name}_`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
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
    const buttons = [
      { id: 'menu_catalogo', title: '📦 Ver catálogo' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, '❌ Por favor escribe un número válido.', buttons);
    return;
  }

  const subcategories = userSessions[userPhone].subcategoriesList || [];
  
  if (numero > subcategories.length) {
    const buttons = [
      { id: 'menu_catalogo', title: '📦 Ver catálogo' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, `❌ Número inválido. Hay ${subcategories.length} subcategorías.`, buttons);
    return;
  }

  // Obtener la subcategoría seleccionada (índice = número - 1)
  const selectedSubcategory = subcategories[numero - 1];
  userSessions[userPhone].selectedSubcategory = selectedSubcategory.id;
  userSessions[userPhone].selectedSubcategoryData = selectedSubcategory; // Guardar datos completos
  
  // Primero verificar si esta subcategoría tiene más subcategorías
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

  try {
    const products = await getProducts(subcategoryId);

    if (!products || products.length === 0) {
      await sendTextMessage(userPhone, '❌ No hay productos disponibles en esta subcategoría.');
      const categoryId = userSessions[userPhone].selectedCategory;
      await showSubCategories(userPhone, categoryId);
      return;
    }

    // Guardar lista de productos en la sesión para selección posterior
    userSessions[userPhone].productsList = products;

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

    // Agregar instrucción para seleccionar producto por número
    mensaje += `💬 *Escribe el número del producto para ver sus detalles y el link de compra*\n\n`;

    // Obtener datos de la subcategoría para generar el link correcto
    const subcategoryData = userSessions[userPhone].selectedSubcategoryData;
    const categoryId = userSessions[userPhone].selectedCategory;

    if (categoryId && subcategoryId) {
      // Link directo a los productos de esta subcategoría
      mensaje += `🌐 También puedes hacer clic aquí para ver todos los productos y comprarlo en línea de forma segura y rápida, o agregarlo al carrito 👇\n`;
      mensaje += `https://zonarepuestera.com.co/products/?category=${categoryId}&subcategory=${subcategoryId}`;
    } else if (categoryId) {
      // Fallback: mostrar subcategorías de la categoría
      mensaje += `🌐 También puedes hacer clic aquí para ver todos los productos y comprarlo en línea de forma segura y rápida, o agregarlo al carrito 👇\n`;
      mensaje += `https://zonarepuestera.com.co/sub-categories/?category=${categoryId}`;
    } else {
      // Fallback general: link a productos
      mensaje += `🌐 También puedes hacer clic aquí para ver todos los productos y comprarlo en línea de forma segura y rápida, o agregarlo al carrito 👇\n`;
      mensaje += `https://zonarepuestera.com.co/products/`;
    }

    // WhatsApp limita mensajes con botones a 1024 caracteres
    // Si el mensaje es muy largo, dividir en 2: texto + botones
    const MAX_BUTTON_MESSAGE_LENGTH = 1000; // Margen de seguridad

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' },
      { id: 'menu_catalogo', title: '📚 Ver catálogo' }
    ];

    if (mensaje.length > MAX_BUTTON_MESSAGE_LENGTH) {
      // Mensaje largo: dividir en 2
      console.log(`⚠️ Mensaje largo (${mensaje.length} chars) - Dividiendo en 2 mensajes`);

      // 1. Enviar productos sin botones
      await sendTextMessage(userPhone, mensaje);

      // 2. Enviar botones en mensaje corto separado
      const shortMessage = 'Estoy atento si necesitas más información o ayuda 😊';
      await sendInteractiveButtons(userPhone, shortMessage, buttons);
    } else {
      // Mensaje corto: enviar todo junto
      mensaje += '\n\nEstoy atento si necesitas más información o ayuda 😊';
      await sendInteractiveButtons(userPhone, mensaje, buttons);
    }

    // Mantener estado PRODUCT_LIST para permitir selección por número
    
  } catch (error) {
    console.error('Error mostrando productos:', error);
    await sendTextMessage(userPhone, '❌ Error al cargar productos.');
    const categoryId = userSessions[userPhone].selectedCategory;
    await showSubCategories(userPhone, categoryId);
  }
};

/**
 * Muestra los detalles de un producto específico del catálogo
 */
const showProductDetails = async (userPhone, productIndex) => {
  const productsList = userSessions[userPhone].productsList;

  if (!productsList || productsList.length === 0) {
    await sendTextMessage(userPhone, '❌ No hay productos disponibles.');
    await showMainMenu(userPhone);
    return;
  }

  const product = productsList[productIndex - 1];

  if (!product) {
    await sendTextMessage(
      userPhone,
      `❌ *Producto no encontrado*\n\n` +
      `Verifica el número del producto. Hay ${productsList.length} productos disponibles.`
    );
    return;
  }

  // Formatear detalles del producto (similar a formatProduct de quoteService)
  const price = product.final_price || product.price || product.base_price || 0;
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(price);

  let mensaje = `📦 *${product.name || product.description}*\n\n`;

  // Código del producto
  if (product.code || product.sku) {
    mensaje += `🔖 *Código:* ${product.code || product.sku}\n`;
  }

  // Marca si existe
  if (product.brand) {
    mensaje += `🏷️ *Marca:* ${product.brand}\n`;
  }

  // Precio
  mensaje += `💰 *Precio:* ${formattedPrice}\n`;

  // Stock
  if (product.stock !== undefined && product.stock !== null) {
    const stockStatus = product.stock > 0 ? `${product.stock} unidades disponibles` : 'Agotado';
    mensaje += `📊 *Stock:* ${stockStatus}\n`;
  }

  // Descripción adicional si existe
  if (product.description && product.description !== product.name) {
    mensaje += `\n📝 *Descripción:* ${product.description}\n`;
  }

  // Link directo al producto individual
  if (product.id) {
    mensaje += `\n🌐 *Puedes hacer clic aquí para ver más detalles y comprarlo en línea de forma segura y rápida, o agregarlo al carrito* 👇\n`;
    mensaje += `https://zonarepuestera.com.co/products/${product.id}/`;
  }

  await sendTextMessage(userPhone, mensaje);

  const buttons = [
    { id: 'menu_catalogo', title: '📚 Ver catálogo' },
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
};

/**
 * Maneja la entrada de email para consultar pedidos
 */
const handleOrdersEmailInput = async (userPhone, email) => {
  const trimmedEmail = email.trim();

  // Validar formato de email
  if (!isValidEmail(trimmedEmail)) {
    const mensaje = `❌ *Email inválido*\n\n` +
      `Por favor ingresa un correo electrónico válido.\n\n` +
      `Ejemplo: *juan@email.com*\n\n` +
      `_Escribe tu correo nuevamente o vuelve al menú:_\n\n` +
      `Estoy atento si necesitas más información o ayuda 😊`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' },
      { id: 'repetir_correo', title: '✉️ Repetir correo' }
    ];

    await sendInteractiveButtons(userPhone, mensaje, buttons);
    return;
  }

  try {
    // Obtener pedidos del backend
    const orders = await getOrdersByEmail(trimmedEmail);
    
    if (!orders || orders.length === 0) {
      const mensaje = `📦 *No se encontraron pedidos*\n\n` +
        `No hay pedidos asociados al correo *${trimmedEmail}*.\n\n` +
        `Verifica que el correo sea el mismo que usaste al hacer tu compra.\n\n` +
        `Estoy atento si necesitas más información o ayuda 😊`;

      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' },
        { id: 'repetir_correo', title: '✉️ Repetir correo' }
      ];

      await sendInteractiveButtons(userPhone, mensaje, buttons);
      userSessions[userPhone].state = 'MAIN_MENU';
      return;
    }

    // Guardar pedidos en la sesión
    userSessions[userPhone].ordersList = orders;
    userSessions[userPhone].ordersEmail = trimmedEmail;

    // Si solo hay 1 pedido, mostrar detalles directamente
    if (orders.length === 1) {
      const orderDetails = formatOrderDetails(orders[0]);
      const mensajeFinal = orderDetails + '\n\nEstoy atento si necesitas más información o ayuda 😊';

      const buttons = [
        { id: 'volver_menu', title: '🏠 Volver al menú' }
      ];

      await sendInteractiveButtons(userPhone, mensajeFinal, buttons);
      userSessions[userPhone].state = 'MAIN_MENU';
      return;
    }

    // Si hay múltiples pedidos, mostrar lista resumida
    const ordersList = formatOrdersList(orders);
    const mensajeFinal = ordersList +
      `\n\n💬 *Para ver detalles de un pedido:*\n` +
      `Escribe el *número del pedido*\n\n` +
      `_Ejemplo: escribe *${orders[0].id}* para ver el pedido #${orders[0].id}_\n\n` +
      `Estoy atento si necesitas más información o ayuda 😊`;

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, mensajeFinal, buttons);
    userSessions[userPhone].state = 'VIEWING_ORDER_DETAILS';

  } catch (error) {
    console.error('Error al buscar pedidos:', error);
    await sendTextMessage(
      userPhone,
      `❌ *Error al consultar pedidos*\n\n` +
      `No se pudieron obtener los pedidos en este momento.\n\n` +
      `Por favor intenta más tarde o contacta con un asesor.`
    );

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' },
      { id: 'menu_asesor', title: '💬 Hablar con asesor' }
    ];

    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    userSessions[userPhone].state = 'MAIN_MENU';
  }
};

/**
 * Maneja la selección de un pedido específico para ver detalles
 */
const handleOrderSelection = async (userPhone, orderIdText) => {
  const orderId = parseInt(orderIdText.trim());

  if (isNaN(orderId)) {
    await sendTextMessage(
      userPhone,
      `❌ *Número inválido*\n\n` +
      `Por favor escribe el número del pedido que deseas consultar.\n\n` +
      `_Ejemplo: escribe *123* para ver el pedido #123_`
    );

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    return;
  }

  const ordersList = userSessions[userPhone].ordersList;
  if (!ordersList || ordersList.length === 0) {
    await sendTextMessage(userPhone, '❌ No hay pedidos disponibles. Por favor inicia una nueva consulta.');
    await showMainMenu(userPhone);
    return;
  }

  // Buscar el pedido en la lista
  const order = ordersList.find(o => o.id === orderId);

  if (!order) {
    await sendTextMessage(
      userPhone,
      `❌ *Pedido no encontrado*\n\n` +
      `El pedido #${orderId} no está en tu lista de pedidos.\n\n` +
      `Verifica el número e intenta nuevamente.`
    );

    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];

    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    return;
  }

  // Mostrar detalles del pedido
  const orderDetails = formatOrderDetails(order);
  await sendTextMessage(userPhone, orderDetails);

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
  userSessions[userPhone].state = 'MAIN_MENU';
};

/**
 * ========================
 * FLUJO DE COTIZACIÓN DE AUTOPARTES
 * ========================
 */

/**
 * Inicia el flujo de cotización de autopartes
 */
const startQuoteFlow = async (userPhone) => {
  userSessions[userPhone].state = 'QUOTE_SELECT_BRAND';
  userSessions[userPhone].quoteFilters = {
    brand: null,
    model: null,
    category: null,
    subcategory: null
  };
  userSessions[userPhone].lastActivity = Date.now();

  await showCarBrands(userPhone);
};

/**
 * Muestra las marcas de vehículos disponibles
 */
const showCarBrands = async (userPhone) => {
  const result = await getCarBrands();

  if (!result.success || !result.data || result.data.length === 0) {
    await sendTextMessage(
      userPhone,
      `❌ *Error*\n\nNo se pudieron cargar las marcas de vehículos.\n\nIntenta nuevamente más tarde.`
    );
    await showMainMenu(userPhone);
    return;
  }

  userSessions[userPhone].carBrandsList = result.data;

  // Crear lista numerada en texto (sin límite de 10)
  let message = `*Trabajo para ti 24/7!* 🚗\n\n` +
    `*¡Vamos a buscar tu repuesto!*\n\n` +
    `Buscaremos por:\n` +
    `1️⃣ Marca de tu vehículo\n` +
    `2️⃣ Modelo\n` +
    `3️⃣ Categoría del repuesto\n` +
    `4️⃣ Subcategoría (opcional)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚗 *SELECCIONA LA MARCA DE TU VEHÍCULO*\n\n` +
    `Tenemos ${result.data.length} marcas disponibles.\n\n`;

  result.data.forEach((brand, index) => {
    message += `${index + 1}. ${brand.name}\n`;
  });

  message += `\n📝 *Responde con el número* de la marca que deseas.`;

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, message, buttons);
  userSessions[userPhone].state = 'QUOTE_SELECT_BRAND';
};

/**
 * Muestra los modelos de una marca seleccionada
 */
const showCarModels = async (userPhone, brandId) => {
  const result = await getCarModels(brandId);
  
  if (!result.success || !result.data || result.data.length === 0) {
    await sendTextMessage(
      userPhone,
      `❌ *Error*\n\nNo se pudieron cargar los modelos para esta marca.\n\nIntenta con otra marca.`
    );
    await showCarBrands(userPhone);
    return;
  }

  userSessions[userPhone].carModelsList = result.data;
  userSessions[userPhone].quoteFilters.brand = brandId;
  
  const brandName = userSessions[userPhone].carBrandsList.find(b => b.id === brandId)?.name || '';

  // Crear lista numerada en texto
  let message = `🚙 *SELECCIONA EL MODELO DE TU ${brandName.toUpperCase()}*\n\n`;
  message += `Tenemos ${result.data.length} modelos disponibles.\n\n`;

  result.data.forEach((model, index) => {
    message += `${index + 1}. ${model.name}\n`;
  });

  message += `\n📝 *Responde con el número* del modelo que deseas.`;

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, message, buttons);
  userSessions[userPhone].state = 'QUOTE_SELECT_MODEL';
};

/**
 * Muestra las categorías de productos disponibles para la marca y modelo seleccionados
 */
const showQuoteCategories = async (userPhone) => {
  const brandId = userSessions[userPhone].quoteFilters.brand;
  const modelId = userSessions[userPhone].quoteFilters.model;
  
  const result = await getProductCategories(brandId, modelId);
  
  if (!result.success || !result.data || result.data.length === 0) {
    await sendTextMessage(
      userPhone,
      `❌ *Error*\n\nNo se encontraron categorías de productos disponibles para este modelo.\n\nIntenta con otro modelo.`
    );
    await showMainMenu(userPhone);
    return;
  }

  userSessions[userPhone].quoteCategoriesList = result.data;

  // Crear lista numerada en texto
  let message = `📁 *SELECCIONA LA CATEGORÍA DEL REPUESTO*\n\n`;
  message += `¿Qué tipo de repuesto necesitas?\n\n`;

  result.data.forEach((category, index) => {
    message += `${index + 1}. ${category.name}\n`;
  });

  message += `\n📝 *Responde con el número* de la categoría que necesitas.`;

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, message, buttons);
  userSessions[userPhone].state = 'QUOTE_SELECT_CATEGORY';
};

/**
 * Muestra las subcategorías de una categoría disponibles para la marca y modelo seleccionados
 */
const showQuoteSubcategories = async (userPhone, categoryId, categoryName = null) => {
  const brandId = userSessions[userPhone].quoteFilters.brand;
  const modelId = userSessions[userPhone].quoteFilters.model;

  const result = await getProductSubcategories(categoryId, brandId, modelId);

  if (!result.success || !result.data || result.data.length === 0) {
    // Si no hay subcategorías, buscar productos directamente
    userSessions[userPhone].quoteFilters.category = categoryId;
    await searchQuoteProducts(userPhone);
    return;
  }

  userSessions[userPhone].quoteSubcategoriesList = result.data;
  userSessions[userPhone].quoteFilters.category = categoryId;

  // Crear lista numerada en texto
  const catName = categoryName || userSessions[userPhone].quoteCategoryName || 'esta categoría';
  let message = `¡Perfecto! *Estas son las subcategorías de ${catName}*\n\n`;

  result.data.forEach((subcategory, index) => {
    message += `${index + 1}. ${subcategory.name}\n`;
  });

  message += `\n0. ⏭️ Omitir subcategoría (buscar sin filtro)\n`;
  message += `\n📝 *Responde con el número* de la subcategoría o 0 para omitir.`;

  const buttons = [
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, message, buttons);
  userSessions[userPhone].state = 'QUOTE_SELECT_SUBCATEGORY';
};

/**
 * Busca y muestra los productos según los filtros
 */
const searchQuoteProducts = async (userPhone) => {
  const filters = userSessions[userPhone].quoteFilters;

  const result = await searchProducts(filters);
  
  if (!result.success) {
    await sendTextMessage(
      userPhone,
      `❌ *Error en la búsqueda*\n\n` +
      `No se pudieron obtener los productos.\n\nIntenta nuevamente.`
    );
    const buttons = [
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    return;
  }

  if (result.count === 0) {
    await sendTextMessage(
      userPhone,
      `😔 *No se encontraron productos*\n\n` +
      `No hay productos disponibles con los filtros seleccionados.\n\n` +
      `Intenta con otros filtros o contáctanos para ayuda personalizada.`
    );

    const buttons = [
      { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
      { id: 'menu_asesor', title: '💬 Hablar con asesor' },
      { id: 'volver_menu', title: '🏠 Volver al menú' }
    ];
    await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
    return;
  }

  // Guardar resultados y mostrar lista paginada
  userSessions[userPhone].quoteResults = result.data;
  userSessions[userPhone].quoteResultsPage = 1;
  userSessions[userPhone].state = 'QUOTE_VIEW_RESULTS';

  const productList = formatProductList(result.data, 1, 10, filters);
  const mensajeFinal = productList +
    `\n\n💬 *Escribe el número del producto para ver sus detalles y el link de compra*\n\n` +
    `Estoy atento si necesitas más información o ayuda 😊`;

  const buttons = [
    { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, mensajeFinal, buttons);
};

/**
 * Muestra los detalles de un producto específico
 */
const showQuoteProductDetails = async (userPhone, productIndex) => {
  const results = userSessions[userPhone].quoteResults;
  
  if (!results || results.length === 0) {
    await sendTextMessage(userPhone, '❌ No hay productos disponibles.');
    await showMainMenu(userPhone);
    return;
  }

  const product = results[productIndex - 1];
  
  if (!product) {
    await sendTextMessage(userPhone, '❌ Producto no encontrado. Verifica el número.');
    return;
  }

  const productDetails = formatProduct(product);
  await sendTextMessage(userPhone, productDetails);

  const buttons = [
    { id: 'menu_cotizar', title: '🔍 Nueva búsqueda' },
    { id: 'volver_menu', title: '🏠 Volver al menú' }
  ];

  await sendInteractiveButtons(userPhone, 'Estoy atento si necesitas más información o ayuda 😊', buttons);
};

module.exports = {
  handleMenuSelection,
  showMainMenu,
  isUserWithAdvisor,
  deactivateAdvisorMode,
  activateAdvisorMode,  // Exportar para activar desde webhook cuando envíe imagen
  markAdvisorResponse,  // Exportar para que el panel la pueda usar
  updateLastActivity,  // Exportar para que el webhook la pueda usar
  getUserSession: (userPhone) => userSessions[userPhone]  // Exportar para verificar estado
};
