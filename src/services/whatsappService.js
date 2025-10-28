const axios = require('axios');
const conversationService = require('./conversationService');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573164088588';

// Configuración de reintentos
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 segundos

/**
 * Función auxiliar para reintentar peticiones en caso de errores de red
 */
const retryRequest = async (requestFn, retries = MAX_RETRIES) => {
  try {
    return await requestFn();
  } catch (error) {
    // Verificar si es un error de red o timeout
    const isNetworkError = error.code === 'ENOTFOUND' || 
                          error.code === 'ECONNREFUSED' || 
                          error.code === 'ETIMEDOUT' ||
                          error.message.includes('network') ||
                          !error.response;
    
    if (isNetworkError && retries > 0) {
      console.log(`⚠️ Error de red. Reintentando en ${RETRY_DELAY/1000}s... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return retryRequest(requestFn, retries - 1);
    }
    
    // Si no es error de red o ya no quedan reintentos, lanzar el error
    throw error;
  }
};

/**
 * Envía un mensaje de texto del BOT a través de WhatsApp
 * IMPORTANTE: Solo usar para mensajes automáticos del bot
 * Para mensajes del asesor, usar sendRawTextMessage() desde panel.js
 *
 * Esta función automáticamente:
 * - Envía el mensaje por WhatsApp
 * - Lo registra en conversationService como 'bot'
 * - Emite evento WebSocket 'new_message'
 */
const sendTextMessage = async (to, text) => {
  try {
    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos de timeout
      }
    ));
    console.log('✅ Mensaje enviado:', response.data);

    // Registrar mensaje del bot en el panel (solo si no es para el asesor)
    if (to !== ADVISOR_PHONE) {
      const botMessage = {
        from: 'bot',
        text: text,
        type: 'text',
        timestamp: new Date()
      };

      conversationService.addMessage(to, botMessage);

      // Notificar al panel mediante WebSocket (si está disponible)
      const io = global.io;
      if (io) {
        io.emit('new_message', {
          phoneNumber: to,
          message: botMessage
        });
      }
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    console.error('⚠️ El servidor continúa funcionando a pesar del error de envío.');
    return null; // Retornar null en vez de lanzar error para no crashear el servidor
  }
};

/**
 * Envía botones interactivos del BOT a través de WhatsApp
 * IMPORTANTE: Solo usar para botones automáticos del bot
 * Para botones del asesor, usar sendRawInteractiveButtons() desde panel.js
 *
 * Esta función automáticamente:
 * - Envía los botones por WhatsApp
 * - Los registra en conversationService como 'bot'
 * - Emite evento WebSocket 'new_message'
 */
const sendInteractiveButtons = async (to, bodyText, buttons) => {
  try {
    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn, index) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            })).slice(0, 3) // WhatsApp permite máximo 3 botones
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));
    console.log('✅ Botones enviados');

    // Registrar mensaje con botones en el panel
    if (to !== ADVISOR_PHONE) {
      const buttonText = buttons.map(btn => `[${btn.title}]`).join(' ');
      const botMessage = {
        from: 'bot',
        text: `${bodyText}\n\n${buttonText}`,
        type: 'interactive_buttons',
        timestamp: new Date()
      };

      conversationService.addMessage(to, botMessage);

      // Notificar al panel mediante WebSocket (si está disponible)
      const io = global.io;
      if (io) {
        io.emit('new_message', {
          phoneNumber: to,
          message: botMessage
        });
      }
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error enviando botones:', error.response?.data || error.message);
    console.error('⚠️ El servidor continúa funcionando a pesar del error de envío.');
    return null;
  }
};

/**
 * Envía lista interactiva del BOT a través de WhatsApp
 * IMPORTANTE: Solo usar para listas automáticas del bot
 *
 * Esta función automáticamente:
 * - Envía la lista por WhatsApp
 * - La registra en conversationService como 'bot'
 * - Emite evento WebSocket 'new_message'
 */
const sendInteractiveList = async (to, bodyText, buttonText, sections) => {
  try {
    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: sections
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));
    console.log('✅ Lista enviada');

    // Registrar mensaje con lista en el panel
    if (to !== ADVISOR_PHONE) {
      const botMessage = {
        from: 'bot',
        text: `${bodyText}\n\n[Menú: ${buttonText}]`,
        type: 'interactive_list',
        timestamp: new Date()
      };

      conversationService.addMessage(to, botMessage);

      // Notificar al panel mediante WebSocket (si está disponible)
      const io = global.io;
      if (io) {
        io.emit('new_message', {
          phoneNumber: to,
          message: botMessage
        });
      }
    }

    return response.data;
  } catch (error) {
    console.error('❌ Error enviando lista:', error.response?.data || error.message);
    console.error('⚠️ El servidor continúa funcionando a pesar del error de envío.');
    return null;
  }
};

/**
 * Envía un mensaje de texto SIN registrarlo automáticamente
 *
 * USAR SOLO DESDE PANEL.JS para mensajes del asesor
 *
 * Esta función SOLO:
 * - Envía el mensaje por WhatsApp
 *
 * NO registra ni emite eventos WebSocket
 * El registro se hace manualmente en panel.js como 'advisor'
 */
const sendRawTextMessage = async (to, text) => {
  try {
    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));
    console.log('✅ Mensaje RAW enviado (sin registro):', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje RAW:', error.response?.data || error.message);
    console.error('⚠️ El servidor continúa funcionando a pesar del error de envío.');
    return null;
  }
};

/**
 * Envía botones interactivos SIN registrarlos automáticamente
 *
 * USAR SOLO DESDE PANEL.JS o MENUSERVICE.JS para mensajes del sistema/asesor
 *
 * Esta función SOLO:
 * - Envía los botones por WhatsApp
 *
 * NO registra ni emite eventos WebSocket
 * El registro se hace manualmente si es necesario
 */
const sendRawInteractiveButtons = async (to, bodyText, buttons) => {
  try {
    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn, index) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            })).slice(0, 3)
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));
    console.log('✅ Botones RAW enviados (sin registro)');
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando botones RAW:', error.response?.data || error.message);
    console.error('⚠️ El servidor continúa funcionando a pesar del error de envío.');
    return null;
  }
};

module.exports = {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendRawTextMessage,
  sendRawInteractiveButtons
};
