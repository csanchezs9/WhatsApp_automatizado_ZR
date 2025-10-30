const axios = require('axios');
const conversationService = require('./conversationService');
const FormData = require('form-data');
const fs = require('fs');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573164088588';

// Importar función para verificar si usuario está con asesor
let isUserWithAdvisor;
// Carga lazy para evitar dependencia circular
const getIsUserWithAdvisor = () => {
  if (!isUserWithAdvisor) {
    isUserWithAdvisor = require('./menuService').isUserWithAdvisor;
  }
  return isUserWithAdvisor;
};

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

    // SOLO registrar mensaje del bot en el panel SI:
    // 1. No es para el asesor
    // 2. El usuario está con asesor (modo asesor activo)
    const isWithAdvisor = getIsUserWithAdvisor()(to);
    if (to !== ADVISOR_PHONE && isWithAdvisor) {
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

    // SOLO registrar mensaje con botones en el panel SI el usuario está con asesor
    const isWithAdvisor = getIsUserWithAdvisor()(to);
    if (to !== ADVISOR_PHONE && isWithAdvisor) {
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

    // SOLO registrar mensaje con lista en el panel SI el usuario está con asesor
    const isWithAdvisor = getIsUserWithAdvisor()(to);
    if (to !== ADVISOR_PHONE && isWithAdvisor) {
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

/**
 * Subir archivo multimedia a WhatsApp y obtener media ID
 */
const uploadMediaToWhatsApp = async (filePath, mimeType) => {
  try {
    const uploadUrl = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/media`;

    // Limpiar mimeType: remover codecs y parámetros extra
    // WhatsApp API solo acepta "audio/ogg", no "audio/ogg; codecs=opus"
    const cleanMimeType = mimeType.split(';')[0].trim();

    console.log(`📤 Subiendo media a WhatsApp: ${filePath}`);
    console.log(`   MimeType original: ${mimeType}`);
    console.log(`   MimeType limpio: ${cleanMimeType}`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('type', cleanMimeType); // Usar mimeType limpio
    formData.append('messaging_product', 'whatsapp');

    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`
      }
    });

    console.log('✅ Media uploaded to WhatsApp:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Error uploading media to WhatsApp:', error.response?.data || error.message);
    console.error('   Detalles completos:', JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
};

/**
 * Enviar imagen a través de WhatsApp
 */
const sendImage = async (to, mediaId, caption = null) => {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'image',
      image: {
        id: mediaId
      }
    };

    if (caption) {
      payload.image.caption = caption;
    }

    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));

    console.log('✅ Imagen enviada:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando imagen:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Enviar documento (PDF, Word, etc.) a través de WhatsApp
 */
const sendDocument = async (to, mediaId, filename = null, caption = null) => {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'document',
      document: {
        id: mediaId
      }
    };

    if (filename) {
      payload.document.filename = filename;
    }

    if (caption) {
      payload.document.caption = caption;
    }

    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));

    console.log('✅ Documento enviado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando documento:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Enviar audio/voz a través de WhatsApp
 */
const sendAudio = async (to, mediaId, caption = null) => {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'audio',
      audio: {
        id: mediaId
      }
    };

    console.log('🎤 sendAudio() - Preparando envío de audio:');
    console.log('   → Destino:', to);
    console.log('   → Media ID:', mediaId);
    console.log('   → API URL:', WHATSAPP_API_URL);
    console.log('   → Payload:', JSON.stringify(payload, null, 2));

    // Los audios NO soportan caption en WhatsApp Business API
    // Si se proporciona caption, se ignora silenciosamente

    const response = await retryRequest(() => axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    ));

    console.log('✅ Audio enviado exitosamente a WhatsApp');
    console.log('   → Respuesta:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ ERROR CRÍTICO enviando audio a WhatsApp:');
    console.error('   → Error message:', error.message);
    console.error('   → Error response:', JSON.stringify(error.response?.data, null, 2));
    console.error('   → Status code:', error.response?.status);
    throw error;
  }
};

module.exports = {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendRawTextMessage,
  sendRawInteractiveButtons,
  uploadMediaToWhatsApp,
  sendImage,
  sendDocument,
  sendAudio
};
