const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

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
