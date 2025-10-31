const { sendWhatsAppMessage } = require('../services/whatsappService');
const { handleMenuSelection, updateLastActivity, isUserWithAdvisor } = require('../services/menuService');
const { processMediaMessage } = require('../services/mediaService');
const { addMessage } = require('../services/conversationService');

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
        } else if (['image', 'document', 'audio'].includes(messageType)) {
          // Procesar archivos multimedia soportados (solo cuando está con asesor)
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
                const { getUserSession } = require('../services/menuService');
                const userSession = getUserSession(from);

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
                  },
                  isWithAdvisor: isWithAdvisor,
                  userState: userSession?.state
                });
              }
            } catch (error) {
              console.error(`❌ Error procesando ${messageType}:`, error);
              await sendWhatsAppMessage(from, '❌ Hubo un error procesando tu archivo. Por favor, intenta nuevamente.');
            }
          } else {
            await sendWhatsAppMessage(from, '⚠️ Solo puedes enviar archivos cuando estás hablando con un asesor. Por favor, selecciona "Hablar con asesor" en el menú.');
          }
        } else if (['sticker', 'video', 'location', 'contacts', 'reaction', 'unknown'].includes(messageType)) {
          // Tipos de mensajes NO soportados - mostrar indicador en panel
          const isWithAdvisor = isUserWithAdvisor(from);

          // Detectar si es GIF (viene como video pero tiene mime_type image/gif o es animado)
          let isGif = false;
          if (messageType === 'video' && message.video) {
            const mimeType = message.video.mime_type || '';
            isGif = mimeType.includes('gif') || message.video.animated === true;
          }

          // Mapear tipo de mensaje a texto descriptivo
          const messageTypeLabels = {
            'sticker': '[Sticker]',
            'video': isGif ? '[GIF]' : '[Video]',
            'location': '[Ubicación]',
            'contacts': '[Contacto]',
            'reaction': '[Reacción]',
            'unknown': '[Mensaje no soportado]'
          };

          const descriptiveText = messageTypeLabels[messageType] || `[${messageType}]`;

          console.log(`ℹ️ ${from} envió ${descriptiveText} - tipo no soportado`);

          // Si está con asesor, guardar indicador en el panel
          if (isWithAdvisor) {
            addMessage(from, {
              from: 'client',
              type: 'text',
              text: descriptiveText,
              timestamp: new Date()
            });

            // Emitir por socket al panel
            const io = req.app.get('io');
            if (io) {
              const { getUserSession } = require('../services/menuService');
              const userSession = getUserSession(from);

              io.emit('new_message', {
                phoneNumber: from,
                message: {
                  from: 'client',
                  type: 'text',
                  text: descriptiveText,
                  timestamp: new Date()
                },
                isWithAdvisor: isWithAdvisor,
                userState: userSession?.state
              });
            }
          }

          // Informar al cliente que este tipo de mensaje no está soportado
          if (messageType === 'video') {
            if (isGif) {
              await sendWhatsAppMessage(from, '⚠️ No procesamos GIFs. Por favor, envía un mensaje de texto o imagen.');
            } else {
              await sendWhatsAppMessage(from, '⚠️ No aceptamos videos en este momento. Por favor, envía imágenes o documentos.');
            }
          } else if (messageType === 'sticker') {
            await sendWhatsAppMessage(from, '⚠️ No procesamos stickers. Por favor, envía un mensaje de texto.');
          } else if (messageType === 'location') {
            await sendWhatsAppMessage(from, '⚠️ No procesamos ubicaciones. Por favor, envía un mensaje de texto.');
          } else {
            await sendWhatsAppMessage(from, `⚠️ Este tipo de mensaje no está soportado. Por favor, envía texto, imágenes o documentos.`);
          }
        } else {
          // Catch-all para cualquier otro tipo de mensaje no manejado
          const isWithAdvisor = isUserWithAdvisor(from);

          console.log(`⚠️ Tipo de mensaje desconocido: ${messageType}`);

          if (isWithAdvisor) {
            addMessage(from, {
              from: 'client',
              type: 'text',
              text: `[Mensaje tipo: ${messageType}]`,
              timestamp: new Date()
            });

            const io = req.app.get('io');
            if (io) {
              const { getUserSession } = require('../services/menuService');
              const userSession = getUserSession(from);

              io.emit('new_message', {
                phoneNumber: from,
                message: {
                  from: 'client',
                  type: 'text',
                  text: `[Mensaje tipo: ${messageType}]`,
                  timestamp: new Date()
                },
                isWithAdvisor: isWithAdvisor,
                userState: userSession?.state
              });
            }
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
