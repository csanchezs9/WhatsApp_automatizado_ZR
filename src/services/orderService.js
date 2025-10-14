const axios = require('axios');

// URL del backend de Django (configurable desde variables de entorno)
const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'http://localhost:8000/api';
const ECOMMERCE_API_TOKEN = process.env.ECOMMERCE_API_TOKEN || '';

/**
 * Obtiene todos los pedidos de un usuario por su email
 * @param {string} email - Email del cliente
 * @returns {Promise<Array>} Lista de pedidos
 */
const getOrdersByEmail = async (email) => {
  try {
    console.log(`🔍 Buscando pedidos para email: ${email}`);
    
    // Usar el nuevo endpoint público /by-email/
    const response = await axios.get(`${ECOMMERCE_API_URL}/orders/by-email/`, {
      params: {
        email: email.trim().toLowerCase()
      }
    });

    const count = response.data.count || 0;
    const results = response.data.results || [];
    
    console.log(`✅ Se encontraron ${count} pedidos`);
    return results;
  } catch (error) {
    console.error('❌ Error al buscar pedidos:', error.response?.data || error.message);
    if (error.response?.status === 400) {
      throw new Error(error.response.data.error || 'Email inválido');
    }
    throw new Error('No se pudieron obtener los pedidos');
  }
};

/**
 * Obtiene el detalle de un pedido específico por su ID
 * @param {number} orderId - ID del pedido
 * @returns {Promise<Object>} Detalles del pedido
 */
const getOrderById = async (orderId) => {
  try {
    console.log(`🔍 Obteniendo detalles del pedido #${orderId}`);
    
    const headers = {};
    if (ECOMMERCE_API_TOKEN) {
      headers['Authorization'] = `Bearer ${ECOMMERCE_API_TOKEN}`;
    }
    
    const response = await axios.get(`${ECOMMERCE_API_URL}/orders/${orderId}/`, {
      headers: headers
    });
    
    console.log(`✅ Pedido #${orderId} obtenido`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al obtener pedido #${orderId}:`, error.response?.data || error.message);
    throw new Error('No se pudo obtener el pedido');
  }
};

/**
 * Obtiene el historial de estados de un pedido
 * @param {number} orderId - ID del pedido
 * @returns {Promise<Array>} Historial de estados
 */
const getOrderHistory = async (orderId) => {
  try {
    console.log(`📜 Obteniendo historial del pedido #${orderId}`);
    
    const headers = {};
    if (ECOMMERCE_API_TOKEN) {
      headers['Authorization'] = `Bearer ${ECOMMERCE_API_TOKEN}`;
    }
    
    const response = await axios.get(`${ECOMMERCE_API_URL}/orders/${orderId}/history/`, {
      headers: headers
    });
    
    console.log(`✅ Historial obtenido con ${response.data.length} entradas`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al obtener historial del pedido #${orderId}:`, error.response?.data || error.message);
    return []; // Retornar array vacío si no hay historial
  }
};

/**
 * Formatea un pedido para mostrarlo al usuario
 * @param {Object} order - Objeto de pedido
 * @returns {string} Mensaje formateado
 */
const formatOrderDetails = (order) => {
  const statusEmojis = {
    'Pendiente pago': '⏳',
    'Pagado': '✅',
    'Enviado': '🚚',
    'Completado': '✅',
    'Cancelado': '❌'
  };

  const emoji = statusEmojis[order.status] || '📦';
  
  let message = `${emoji} *Pedido #${order.id}*\n\n`;
  message += `📅 *Fecha:* ${new Date(order.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}\n`;
  
  message += `📊 *Estado:* ${order.status}\n`;
  
  // Información de envío
  if (order.shipping_method) {
    message += `🚚 *Transportadora:* ${order.shipping_method.name}\n`;
  }
  
  // Número de rastreo si existe
  if (order.tracking_number) {
    message += `📍 *Número de guía:* ${order.tracking_number}\n`;
  }
  
  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  
  // Productos
  message += `🛍️ *Productos:*\n`;
  if (order.items && order.items.length > 0) {
    order.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product_detail.name} (${item.product_detail.code})\n`;
      message += `   Cantidad: ${item.quantity} × $${parseFloat(item.unit_price).toLocaleString('es-CO')}\n`;
      message += `   Subtotal: $${parseFloat(item.total_price).toLocaleString('es-CO')}\n`;
    });
  }
  
  message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  
  // Totales
  message += `💰 *Resumen de pagos:*\n`;
  message += `• Subtotal: $${parseFloat(order.subtotal).toLocaleString('es-CO')}\n`;
  if (order.discount > 0) {
    message += `• Descuento: ${order.discount}%\n`;
  }
  message += `• Envío: $${parseFloat(order.shipping_cost).toLocaleString('es-CO')}\n`;
  message += `• *Total: $${parseFloat(order.total).toLocaleString('es-CO')}*\n`;
  
  // Notas (si existen)
  if (order.notes) {
    message += `\n📝 *Notas:* ${order.notes}\n`;
  }
  
  return message;
};

/**
 * Formatea una lista resumida de pedidos
 * @param {Array} orders - Lista de pedidos
 * @returns {string} Mensaje formateado
 */
const formatOrdersList = (orders) => {
  if (!orders || orders.length === 0) {
    return '📦 No se encontraron pedidos para este correo electrónico.';
  }

  const statusEmojis = {
    'Pendiente pago': '⏳',
    'Pagado': '✅',
    'Enviado': '🚚',
    'Completado': '✅',
    'Cancelado': '❌'
  };

  let message = `¡Excelente! 🎉\n\n` +
    `Tu correo tiene *${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'}* registrado${orders.length === 1 ? '' : 's'}. Aquí está${orders.length === 1 ? '' : 'n'}:\n\n`;
  
  orders.forEach((order, index) => {
    const emoji = statusEmojis[order.status] || '📦';
    const date = new Date(order.created_at).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    message += `${emoji} *Pedido #${order.id}*\n`;
    message += `   ${date} | ${order.status}\n`;
    message += `   Total: $${parseFloat(order.total).toLocaleString('es-CO')}\n`;
    
    if (index < orders.length - 1) {
      message += `\n`;
    }
  });
  
  return message;
};

/**
 * Valida si un email tiene un formato correcto
 * @param {string} email - Email a validar
 * @returns {boolean} True si el email es válido
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  getOrdersByEmail,
  getOrderById,
  getOrderHistory,
  formatOrderDetails,
  formatOrdersList,
  isValidEmail
};
