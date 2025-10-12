const { sendTextMessage, sendInteractiveButtons, sendInteractiveList } = require('./whatsappService');
const { getCategories, getSubCategories, getProducts } = require('./ecommerceService');

// Almacenamiento temporal de sesiones de usuario (en producción usa Redis o DB)
const userSessions = {};

// Usuarios que están hablando con un asesor
const usersWithAdvisor = new Map(); // { userPhone: { startTime: Date, lastAdvisorMessage: Date } }

const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573173745021';
const ADVISOR_TIMEOUT = parseInt(process.env.ADVISOR_TIMEOUT_MINUTES || '5') * 60 * 1000; // Convertir a milisegundos
const INACTIVITY_TIMEOUT = parseInt(process.env.INACTIVITY_TIMEOUT_MINUTES || '10') * 60 * 1000; // Timeout de inactividad

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
 */
const isUserWithAdvisor = (userPhone) => {
  if (!usersWithAdvisor.has(userPhone)) {
    return false;
  }

  const advisorSession = usersWithAdvisor.get(userPhone);
  const now = Date.now();
  const timeSinceStart = now - advisorSession.startTime;

  // Si ha pasado el tiempo de timeout desde el inicio, reactivar bot
  if (timeSinceStart > ADVISOR_TIMEOUT) {
    console.log(`⏰ Timeout del asesor para ${userPhone}. Reactivando bot...`);
    usersWithAdvisor.delete(userPhone);
    return false;
  }

  return true;
};

/**
 * Activa el modo asesor para un usuario
 */
const activateAdvisorMode = async (userPhone) => {
  const now = Date.now();
  usersWithAdvisor.set(userPhone, {
    startTime: now,
    lastAdvisorMessage: now
  });

  // Notificar al asesor
  const advisorMessage = `🔔 *NUEVA SOLICITUD DE ATENCIÓN*\n\n` +
    `📱 Cliente: +${userPhone}\n` +
    `⏰ Hora: ${new Date().toLocaleString('es-CO')}\n\n` +
    `El cliente está esperando hablar contigo.\n` +
    `Por favor responde desde WhatsApp Business.\n\n` +
    `⚠️ Si no respondes en ${process.env.ADVISOR_TIMEOUT_MINUTES || 5} minutos, el bot se reactivará automáticamente.`;

  try {
    await sendTextMessage(ADVISOR_PHONE, advisorMessage);
    console.log(`✅ Notificación enviada al asesor para cliente ${userPhone}`);
  } catch (error) {
    console.error('❌ Error notificando al asesor:', error);
  }

  // Mensaje al cliente
  const clientMessage = `✅ *Conectando con un asesor...*\n\n` +
    `Un momento por favor, te estamos conectando con uno de nuestros asesores.\n\n` +
    `⏱️ En breve recibirás respuesta personalizada.\n\n` +
    `_Si deseas volver al menú automático, escribe *menú*_`;

  await sendTextMessage(userPhone, clientMessage);
  console.log(`👤 Usuario ${userPhone} ahora está en modo asesor`);
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
 * Maneja la selección del menú según el mensaje del usuario
 */
const handleMenuSelection = async (userPhone, message) => {
  const messageText = message.toLowerCase().trim();

  // VERIFICAR SI LA SESIÓN EXPIRÓ POR INACTIVIDAD
  if (isSessionExpired(userPhone)) {
    console.log(`🔄 Sesión expirada para ${userPhone}. Mostrando menú principal...`);
    // Limpiar modo asesor si estaba activo
    deactivateAdvisorMode(userPhone);
    // Mostrar menú de bienvenida
    await showMainMenu(userPhone);
    return;
  }

  // Actualizar timestamp de última actividad
  updateLastActivity(userPhone);

  // VERIFICAR SI EL USUARIO ESTÁ CON UN ASESOR
  if (isUserWithAdvisor(userPhone)) {
    // Si escribe "menú", desactivar modo asesor y volver al bot
    if (messageText === 'menu' || messageText === 'menú' || messageText === 'inicio') {
      deactivateAdvisorMode(userPhone);
      await sendTextMessage(userPhone, '🤖 Bot reactivado. Volviendo al menú principal...');
      await showMainMenu(userPhone);
      return;
    }
    
    // Si no escribe "menú", no hacer nada (dejar que el asesor responda)
    console.log(`👤 Mensaje de ${userPhone} ignorado - está con asesor`);
    return;
  }

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

  const mensaje = `👋 *¡Bienvenido a Zona Repuestera!*\n\n` +
    `🚗 Somos tu tienda de confianza para autopartes de calidad.\n\n` +
    `*¿Qué deseas hacer?*\n\n` +
    `1️⃣ Consultar catálogo de productos\n` +
    `2️⃣ Hablar con un asesor\n` +
    `3️⃣ Horarios de atención\n\n` +
    `💬 *Escribe el número* de la opción que deseas.`;

  await sendTextMessage(userPhone, mensaje);
};

/**
 * Maneja la selección en el menú principal
 */
const handleMainMenuSelection = async (userPhone, messageText) => {
  // Aceptar número o palabra clave
  if (messageText === '1' || messageText.includes('catálogo') || messageText.includes('catalogo') || messageText.includes('producto')) {
    await showCategories(userPhone);
  } else if (messageText === '2' || messageText.includes('asesor') || messageText.includes('asesora') || messageText.includes('ayuda')) {
    // Activar modo asesor
    await activateAdvisorMode(userPhone);
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
  deactivateAdvisorMode
};
