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
 * Envía un mensaje de texto a WhatsApp
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
 * Envía un mensaje con botones interactivos
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
 * Envía un mensaje con lista interactiva
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

module.exports = {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList
};
