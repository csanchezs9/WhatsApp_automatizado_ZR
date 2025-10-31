const { sendWhatsAppMessage } = require('../services/whatsappService');
const { handleMenuSelection, updateLastActivity, isUserWithAdvisor, activateAdvisorMode } = require('../services/menuService');
const { processMediaMessage } = require('../services/mediaService');
const { addMessage } = require('../services/conversationService');

// Cache de mensajes procesados para prevenir duplicados
const processedMessages = new Map(); // { messageId: timestamp }
const MESSAGE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// Limpieza periódica de mensajes antiguos cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_EXPIRY) {
      processedMessages.delete(messageId);
    }
  }
}, MESSAGE_EXPIRY);

/**
 * Verificación del webhook de WhatsApp
 */
const handleWebhookVerification = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      console.error('❌ Verificación fallida - Token no coincide');
      return res.sendStatus(403);
    }
  } else {
    console.error('❌ Verificación fallida - Faltan parámetros');
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
          res.sendStatus(200);
          return;
        }

        // Marcar mensaje como procesado
        processedMessages.set(messageId, Date.now());

        const from = message.from;
        const messageBody = message.text?.body || '';
        const messageType = message.type;

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
          // Procesar archivos multimedia soportados
          const isWithAdvisor = isUserWithAdvisor(from);
          const { getUserSession } = require('../services/menuService');
          const userSession = getUserSession(from);
          const userState = userSession?.state;

          // Verificar si está esperando enviar consulta al asesor
          const isWaitingAdvisorQuery = ['WAITING_ADVISOR_QUERY', 'WAITING_WARRANTY_REQUEST', 'WAITING_QUOTE_DATA_FOR_ADVISOR'].includes(userState);

          if (isWithAdvisor || isWaitingAdvisorQuery) {
            try {
              const mediaInfo = await processMediaMessage(message);

              // Si está esperando enviar consulta, activar modo asesor primero
              if (isWaitingAdvisorQuery && !isWithAdvisor) {
                let consultationType = 'general';
                if (userState === 'WAITING_WARRANTY_REQUEST') {
                  consultationType = 'garantia';
                } else if (userState === 'WAITING_QUOTE_DATA_FOR_ADVISOR') {
                  consultationType = 'cotizacion';
                }

                const queryText = mediaInfo.caption || '[El cliente envió una imagen]';
                await activateAdvisorMode(from, queryText, consultationType, true);
                await new Promise(resolve => setTimeout(resolve, 100));
              }

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

              // Emitir por socket al panel
              const io = req.app.get('io');
              if (io) {
                const updatedSession = getUserSession(from);

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
                  isWithAdvisor: true,
                  userState: updatedSession?.state
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
