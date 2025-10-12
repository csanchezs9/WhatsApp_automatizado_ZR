const { sendWhatsAppMessage } = require('../services/whatsappService');
const { handleMenuSelection } = require('../services/menuService');

/**
 * Verificación del webhook de WhatsApp
 */
const handleWebhookVerification = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔍 Verificación recibida:', { mode, token, challenge });
  console.log('🔑 Token esperado:', process.env.WEBHOOK_VERIFY_TOKEN);

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    } else {
      console.log('❌ Verificación fallida - Token no coincide');
      return res.sendStatus(403);
    }
  } else {
    console.log('❌ Verificación fallida - Faltan parámetros');
    return res.sendStatus(400);
  }
};

/**
 * Maneja los mensajes entrantes de WhatsApp
 */
const handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;

    // Verificar que sea un mensaje válido
    if (body.object) {
      if (body.entry && 
          body.entry[0].changes && 
          body.entry[0].changes[0].value.messages && 
          body.entry[0].changes[0].value.messages[0]) {
        
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // Número del usuario
        const messageBody = message.text?.body || '';
        const messageType = message.type;

        console.log(`📱 Mensaje de ${from}: ${messageBody}`);

        // Procesar el mensaje según el tipo
        if (messageType === 'text') {
          await handleMenuSelection(from, messageBody);
        } else if (messageType === 'interactive') {
          // Manejar respuestas de botones/listas
          const interactiveResponse = message.interactive;
          if (interactiveResponse.type === 'button_reply') {
            await handleMenuSelection(from, interactiveResponse.button_reply.id);
          } else if (interactiveResponse.type === 'list_reply') {
            await handleMenuSelection(from, interactiveResponse.list_reply.id);
          }
        }

        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.sendStatus(500);
  }
};

module.exports = {
  handleWebhookVerification,
  handleIncomingMessage
};
