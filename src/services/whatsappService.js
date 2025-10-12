const axios = require('axios');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Envía un mensaje de texto a WhatsApp
 */
const sendTextMessage = async (to, text) => {
  try {
    const response = await axios.post(
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
        }
      }
    );
    console.log('✅ Mensaje enviado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Envía un mensaje con botones interactivos
 */
const sendInteractiveButtons = async (to, bodyText, buttons) => {
  try {
    const response = await axios.post(
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
        }
      }
    );
    console.log('✅ Botones enviados');
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando botones:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Envía un mensaje con lista interactiva
 */
const sendInteractiveList = async (to, bodyText, buttonText, sections) => {
  try {
    const response = await axios.post(
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
        }
      }
    );
    console.log('✅ Lista enviada');
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando lista:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList
};
