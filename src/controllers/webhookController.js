const { sendWhatsAppMessage } = require('../services/whatsappService');
const { handleMenuSelection, updateLastActivity, isUserWithAdvisor } = require('../services/menuService');
const { processMediaMessage } = require('../services/mediaService');
const { addMessage } = require('../services/conversationService');

const ADVISOR_PHONE = process.env.ADVISOR_PHONE_NUMBER || '573173745021';

// Cache de mensajes procesados para prevenir duplicados
const processedMessages = new Map(); // { messageId: timestamp }
const MESSAGE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// Limpieza periódica de mensajes antiguos cada 5 minutos
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_EXPIRY) {
      processedMessages.delete(messageId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Limpieza: ${cleanedCount} message IDs antiguos eliminados`);
  }
}, MESSAGE_EXPIRY);

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
        const messageId = message.id;
        
        // Validar si el mensaje ya fue procesado (prevenir duplicados)
        if (processedMessages.has(messageId)) {
          console.log(`⚠️ Mensaje duplicado detectado: ${messageId} - Ignorando`);
          res.sendStatus(200);
          return;
        }
        
        // Marcar mensaje como procesado
        processedMessages.set(messageId, Date.now());
        
        const from = message.from; // Número del usuario
        const messageBody = message.text?.body || '';
        const messageType = message.type;

        console.log(`📱 Mensaje de ${from}: ${messageBody}`);

        // Si el mensaje viene del ASESOR, verificar si es comando /finalizar o respuesta interactiva
        if (from === ADVISOR_PHONE) {
          console.log(`👨‍💼 Mensaje del asesor recibido: ${messageBody}`);
          
          // Si el asesor escribe comandos especiales, procesarlos
          const lowerMessage = messageBody.trim().toLowerCase();
          if (lowerMessage === '/finalizar' || lowerMessage === '/comandos' || lowerMessage.startsWith('/actualizar_promo')) {
            await handleMenuSelection(from, messageBody);
            res.sendStatus(200);
            return;
          }
          
          // Si el asesor selecciona un botón/lista interactiva (ej: finalizar cliente)
          if (messageType === 'interactive') {
            const interactiveResponse = message.interactive;
            let selectedOption = null;
            
            if (interactiveResponse.type === 'button_reply') {
              selectedOption = interactiveResponse.button_reply.id;
            } else if (interactiveResponse.type === 'list_reply') {
              selectedOption = interactiveResponse.list_reply.id;
            }
            
            // Procesar botones del menú de comandos (cmd_finalizar, cmd_promo)
            if (selectedOption && (selectedOption === 'cmd_finalizar' || selectedOption === 'cmd_promo')) {
              await handleMenuSelection(from, selectedOption);
              res.sendStatus(200);
              return;
            }
            
            // Procesar botones de finalizar conversación específica
            if (selectedOption && selectedOption.startsWith('finalizar_')) {
              await handleMenuSelection(from, selectedOption);
              res.sendStatus(200);
              return;
            }
          }
          
          // Si el asesor está actualizando promociones, procesar el mensaje
          const { getUserSession } = require('../services/menuService');
          const advisorSession = getUserSession(from);
          if (advisorSession && advisorSession.state === 'UPDATING_PROMO') {
            await handleMenuSelection(from, messageBody);
            res.sendStatus(200);
            return;
          }
          
          // Nota: Los demás mensajes del asesor se manejan directamente en WhatsApp Business
          res.sendStatus(200);
          return;
        }

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
        } else if (['image', 'document', 'audio', 'video'].includes(messageType)) {
          // Procesar archivos multimedia (solo cuando está con asesor)
          const isWithAdvisor = isUserWithAdvisor(from);

          if (isWithAdvisor) {
            try {
              console.log(`📎 Procesando ${messageType} de ${from}`);
              const mediaInfo = await processMediaMessage(message);

              // Guardar mensaje multimedia en conversación
              addMessage(from, {
                from: 'client',
                type: messageType,
                mediaPath: mediaInfo.localPath,
                mimeType: mediaInfo.mimeType,
                caption: mediaInfo.caption,
                filename: mediaInfo.filename,
                size: mediaInfo.size
              });

              console.log(`✅ ${messageType} guardado: ${mediaInfo.localPath}`);

              // Emitir por socket al panel
              const io = req.app.get('io');
              if (io) {
                io.emit('new_message', {
                  phoneNumber: from,
                  message: {
                    from: 'client',
                    type: messageType,
                    mediaPath: mediaInfo.localPath,
                    mimeType: mediaInfo.mimeType,
                    caption: mediaInfo.caption,
                    filename: mediaInfo.filename,
                    timestamp: new Date()
                  }
                });
              }
            } catch (error) {
              console.error(`❌ Error procesando ${messageType}:`, error);
              // Notificar al cliente que hubo un error
              await sendWhatsAppMessage(from, '❌ Hubo un error procesando tu archivo. Por favor, intenta nuevamente.');
            }
          } else {
            // Cliente no está con asesor, informar que no puede enviar archivos
            await sendWhatsAppMessage(from, '⚠️ Solo puedes enviar archivos cuando estás hablando con un asesor. Por favor, selecciona "Hablar con asesor" en el menú.');
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
