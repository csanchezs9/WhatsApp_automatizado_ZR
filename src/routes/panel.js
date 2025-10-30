const express = require('express');
const router = express.Router();
const conversationService = require('../services/conversationService');
const whatsappService = require('../services/whatsappService');
const menuService = require('../services/menuService');
const mediaService = require('../services/mediaService');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configurar multer para subir archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, mediaService.MEDIA_DIR);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        cb(null, `${timestamp}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB max (WhatsApp limit)
    },
    fileFilter: (req, file, cb) => {
        // Permitir imágenes, PDFs, documentos comunes y AUDIO
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            // Tipos de audio
            'audio/ogg', 'audio/oga', 'audio/opus',
            'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg',
            'audio/mp4', 'audio/aac', 'audio/m4a'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
        }
    }
});

/**
 * Middleware de autenticación básica
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    // Basic Auth: "Basic base64(username:password)"
    const base64Credentials = authHeader.split(' ')[1] || '';
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Credenciales desde variables de entorno
    const validUsername = process.env.PANEL_USERNAME || 'admin';
    const validPassword = process.env.PANEL_PASSWORD || 'zonarepuestera2025';

    if (username === validUsername && password === validPassword) {
        next();
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
}

/**
 * GET /api/conversations
 * Obtener todas las conversaciones activas
 */
router.get('/conversations', authMiddleware, (req, res) => {
    try {
        const conversations = conversationService.getAllActiveConversations();
        res.json({
            success: true,
            total: conversations.length,
            conversations: conversations.map(conv => ({
                phoneNumber: conv.phoneNumber,
                messageCount: conv.messages.length,
                lastMessage: conv.messages[conv.messages.length - 1],
                startedAt: conv.startedAt,
                lastActivity: conv.lastActivity,
                status: conv.status
            }))
        });
    } catch (error) {
        console.error('Error al obtener conversaciones:', error);
        res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
});

/**
 * GET /api/conversations/:phoneNumber
 * Obtener conversación específica con todos sus mensajes
 */
router.get('/conversations/:phoneNumber', authMiddleware, (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const conversation = conversationService.getActiveConversation(phoneNumber);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        // Verificar si el usuario está con asesor o esperando escribir consulta
        const userSession = menuService.getUserSession(phoneNumber);
        const isWithAdvisor = menuService.isUserWithAdvisor(phoneNumber) ||
                            userSession?.state === 'WAITING_ADVISOR_QUERY';

        res.json({
            success: true,
            conversation: {
                phoneNumber: conversation.phoneNumber,
                messages: conversation.messages,
                startedAt: conversation.startedAt,
                lastActivity: conversation.lastActivity,
                status: conversation.status,
                isWithAdvisor: isWithAdvisor // Agregar estado para el frontend
            }
        });
    } catch (error) {
        console.error('Error al obtener conversación:', error);
        res.status(500).json({ error: 'Error al obtener conversación' });
    }
});

/**
 * GET /api/conversations/:phoneNumber/history
 * Obtener historial de conversaciones de un cliente (últimos 20 días)
 */
router.get('/conversations/:phoneNumber/history', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        const history = await conversationService.getConversationHistory(phoneNumber, limit);

        res.json({
            success: true,
            total: history.length,
            history
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

/**
 * POST /api/send-message
 * Enviar mensaje desde el panel al cliente
 */
router.post('/send-message', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({ error: 'phoneNumber y message son requeridos' });
        }

        // Verificar que el usuario esté en modo asesor
        const userSession = menuService.getUserSession(phoneNumber);
        const isWithAdvisor = menuService.isUserWithAdvisor(phoneNumber) ||
                            userSession?.state === 'WAITING_ADVISOR_QUERY' ||
                            userSession?.state === 'WITH_ADVISOR';

        if (!isWithAdvisor) {
            return res.status(403).json({
                error: 'No se puede enviar mensaje. El usuario no está en modo asesor.',
                userState: userSession?.state || 'unknown'
            });
        }

        // Enviar mensaje por WhatsApp (SIN registrar - usamos RAW)
        await whatsappService.sendRawTextMessage(phoneNumber, message);

        // Agregar mensaje a la conversación (SOLO UNA VEZ, aquí)
        conversationService.addMessage(phoneNumber, {
            from: 'advisor',
            text: message,
            type: 'text'
        });

        // Marcar que el asesor ha respondido (para evitar mensajes recordatorios innecesarios)
        menuService.markAdvisorResponse(phoneNumber);

        res.json({
            success: true,
            message: 'Mensaje enviado correctamente'
        });

        // Emitir evento de WebSocket (si está configurado)
        if (req.app.get('io')) {
            req.app.get('io').emit('message_sent', {
                phoneNumber,
                message: {
                    from: 'advisor',
                    text: message,
                    timestamp: new Date()
                }
            });
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

/**
 * POST /api/conversations/:phoneNumber/finalize
 * Finaliza la conversación con el asesor (la conversación se mantiene visible hasta que se auto-elimine en 20 días)
 */
router.post('/conversations/:phoneNumber/finalize', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        // Verificar si el usuario está con asesor
        if (!menuService.isUserWithAdvisor(phoneNumber)) {
            return res.status(400).json({
                error: 'El usuario no está en conversación con asesor'
            });
        }

        // Desactivar modo asesor
        menuService.deactivateAdvisorMode(phoneNumber);

        // Enviar mensaje al cliente
        const finalMessage = `✅ *Conversación finalizada*\n\n` +
            `El asesor ha finalizado la conversación.\n\n` +
            `Si necesitas más ayuda:`;

        const buttons = [
            { id: 'volver_menu', title: '🏠 Volver al menú' }
        ];

        // Enviar por WhatsApp (sin registro automático)
        await whatsappService.sendRawInteractiveButtons(phoneNumber, finalMessage, buttons);

        // Registrar mensaje en el panel para que el asesor lo vea
        const buttonText = buttons.map(btn => `[${btn.title}]`).join(' ');
        conversationService.addMessage(phoneNumber, {
            from: 'bot',
            text: `${finalMessage}\n\n${buttonText}`,
            type: 'interactive_buttons',
            timestamp: new Date()
        });

        // Emitir evento WebSocket para que aparezca en tiempo real
        if (req.app.get('io')) {
            req.app.get('io').emit('new_message', {
                phoneNumber,
                message: {
                    from: 'bot',
                    text: `${finalMessage}\n\n${buttonText}`,
                    type: 'interactive_buttons',
                    timestamp: new Date()
                }
            });
        }

        console.log(`🔚 Conversación finalizada desde el panel para ${phoneNumber}`);

        res.json({
            success: true,
            message: 'Conversación finalizada correctamente'
        });

        // Emitir evento de WebSocket
        if (req.app.get('io')) {
            req.app.get('io').emit('conversation_finalized', { phoneNumber });
        }
    } catch (error) {
        console.error('Error al finalizar conversación:', error);
        res.status(500).json({ error: 'Error al finalizar conversación' });
    }
});

/**
 * DELETE /api/conversations/:phoneNumber
 * Elimina permanentemente una conversación de la base de datos y todos sus archivos multimedia
 */
router.delete('/conversations/:phoneNumber', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        // Verificar si existe conversación activa
        const conversation = conversationService.getActiveConversation(phoneNumber);

        if (!conversation) {
            return res.status(404).json({
                error: 'Conversación no encontrada'
            });
        }

        // Si el usuario está con asesor, desactivar modo asesor primero
        if (menuService.isUserWithAdvisor(phoneNumber)) {
            menuService.deactivateAdvisorMode(phoneNumber);
            console.log(`🔓 Modo asesor desactivado para ${phoneNumber} antes de eliminar`);
        }

        // Obtener todos los archivos multimedia antes de eliminar la conversación
        const mediaFiles = conversation.messages
            .filter(msg => msg.mediaPath && (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video'))
            .map(msg => msg.mediaPath);

        // Eliminar archivos multimedia del sistema de archivos
        const { deleteMedia } = require('../services/mediaService');
        let deletedFilesCount = 0;
        for (const mediaPath of mediaFiles) {
            try {
                deleteMedia(mediaPath);
                deletedFilesCount++;
            } catch (error) {
                console.error(`⚠️ Error eliminando archivo ${mediaPath}:`, error.message);
            }
        }

        // Eliminar conversación PERMANENTEMENTE de BD y memoria
        await conversationService.deleteConversationPermanently(phoneNumber);

        console.log(`🗑️ Conversación eliminada: ${phoneNumber}`);
        console.log(`📎 Archivos multimedia eliminados: ${deletedFilesCount}`);

        res.json({
            success: true,
            message: 'Conversación eliminada permanentemente',
            deletedFiles: deletedFilesCount,
            messageCount: conversation.messages.length
        });

        // Emitir evento WebSocket para notificar al panel
        if (req.app.get('io')) {
            req.app.get('io').emit('conversation_deleted', { phoneNumber });
        }
    } catch (error) {
        console.error('Error al eliminar conversación:', error);
        res.status(500).json({ error: 'Error al eliminar conversación' });
    }
});

/**
 * GET /api/search
 * Buscar conversaciones por número o texto
 */
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { q, limit } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Parámetro "q" es requerido' });
        }

        const results = await conversationService.searchConversations(
            q,
            parseInt(limit) || 20
        );

        res.json({
            success: true,
            total: results.length,
            results
        });
    } catch (error) {
        console.error('Error en búsqueda:', error);
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

/**
 * GET /api/statistics
 * Obtener estadísticas de conversaciones
 */
router.get('/statistics', authMiddleware, async (req, res) => {
    try {
        const stats = await conversationService.getStatistics();
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

/**
 * GET /api/promotions
 * Obtener el mensaje actual de promociones
 */
router.get('/promotions', authMiddleware, (req, res) => {
    try {
        const PROMO_FILE_PATH = path.join(__dirname, '../data/promoMessage.json');

        if (fs.existsSync(PROMO_FILE_PATH)) {
            const data = fs.readFileSync(PROMO_FILE_PATH, 'utf8');
            const promoData = JSON.parse(data);
            res.json({
                success: true,
                promotion: promoData
            });
        } else {
            res.json({
                success: true,
                promotion: {
                    message: '🔥 PROMOCIONES Y DESCUENTOS\n\nActualmente no hay promociones activas.',
                    lastUpdated: null,
                    updatedBy: null
                }
            });
        }
    } catch (error) {
        console.error('Error al obtener promociones:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
});

/**
 * POST /api/promotions
 * Actualizar el mensaje de promociones
 */
router.post('/promotions', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido' });
        }

        if (message.length > 4000) {
            return res.status(400).json({
                error: `Mensaje demasiado largo (${message.length} caracteres). Máximo 4000 caracteres.`
            });
        }

        const PROMO_FILE_PATH = path.join(__dirname, '../data/promoMessage.json');
        const promoData = {
            message: message,
            lastUpdated: new Date().toISOString(),
            updatedBy: 'Panel Web'
        };

        // Crear directorio si no existe
        const dir = path.dirname(PROMO_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(PROMO_FILE_PATH, JSON.stringify(promoData, null, 2), 'utf8');

        res.json({
            success: true,
            message: 'Promoción actualizada correctamente',
            promotion: promoData
        });
    } catch (error) {
        console.error('Error al actualizar promociones:', error);
        res.status(500).json({ error: 'Error al actualizar promociones' });
    }
});

/**
 * POST /api/upload-media
 * Subir archivo multimedia desde el panel (SOLO UPLOAD, no envía ni guarda en conversación)
 */
router.post('/upload-media', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            // Eliminar archivo subido
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Número de teléfono requerido' });
        }

        const relativePath = `media/${req.file.filename}`;

        // Determinar tipo de archivo
        let fileType;
        let normalizedMimeType = req.file.mimetype;

        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('audio/')) {
            fileType = 'audio';
            // IMPORTANTE: WhatsApp Business API solo acepta ciertos formatos de audio
            // Normalizar audio/webm a audio/ogg (ambos usan codec opus)
            if (req.file.mimetype.includes('webm')) {
                normalizedMimeType = 'audio/ogg; codecs=opus';
                console.log(`🔄 Normalizando ${req.file.mimetype} -> ${normalizedMimeType}`);
            }
        } else {
            fileType = 'document';
        }

        console.log(`✅ Archivo subido desde panel: ${req.file.filename} (tipo: ${fileType}, mime original: ${req.file.mimetype}, normalizado: ${normalizedMimeType})`);

        res.json({
            success: true,
            mediaPath: relativePath,
            filename: req.file.originalname,
            mimeType: normalizedMimeType, // Usar mimeType normalizado
            size: req.file.size,
            type: fileType
        });
    } catch (error) {
        console.error('Error al subir archivo:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Error al subir archivo' });
    }
});

/**
 * GET /api/media/:filename
 * Servir archivos multimedia (sin autenticación para permitir carga de imágenes en <img>)
 * NOTA: Los archivos multimedia no contienen información sensible y se generan con nombres únicos
 */
router.get('/media/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = mediaService.getMediaFullPath(`media/${filename}`);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        res.sendFile(filepath);
    } catch (error) {
        console.error('Error al servir media:', error);
        res.status(500).json({ error: 'Error al servir archivo' });
    }
});

/**
 * POST /api/send-media
 * Enviar archivo multimedia al cliente vía WhatsApp
 */
router.post('/send-media', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber, mediaPath, caption, mimeType, filename } = req.body;

        console.log('📤 Enviando media:', { phoneNumber, mediaPath, caption, mimeType, filename });

        if (!phoneNumber || !mediaPath) {
            console.error('❌ Faltan parámetros:', { phoneNumber, mediaPath });
            return res.status(400).json({ error: 'Faltan parámetros requeridos: phoneNumber y mediaPath' });
        }

        if (!mimeType) {
            console.error('❌ Falta mimeType');
            return res.status(400).json({ error: 'Falta parámetro requerido: mimeType' });
        }

        // Verificar que el usuario esté en modo asesor
        const userSession = menuService.getUserSession(phoneNumber);
        const isWithAdvisor = menuService.isUserWithAdvisor(phoneNumber) ||
                            userSession?.state === 'WAITING_ADVISOR_QUERY' ||
                            userSession?.state === 'WITH_ADVISOR';

        if (!isWithAdvisor) {
            console.error('❌ Usuario no está en modo asesor:', phoneNumber, 'Estado:', userSession?.state);
            return res.status(403).json({
                error: 'No se puede enviar archivo. El usuario no está en modo asesor.',
                userState: userSession?.state || 'unknown'
            });
        }

        // Obtener path completo del archivo
        const fullPath = mediaService.getMediaFullPath(mediaPath);

        if (!fs.existsSync(fullPath)) {
            console.error('❌ Archivo no encontrado:', fullPath);
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        console.log('✅ Archivo encontrado, subiendo a WhatsApp...');

        // Subir archivo a WhatsApp y obtener media ID
        const mediaId = await whatsappService.uploadMediaToWhatsApp(fullPath, mimeType);

        console.log('✅ Media ID obtenido:', mediaId);

        // Determinar tipo de mensaje
        let messageType;
        if (mimeType.startsWith('image/')) {
            messageType = 'image';
        } else if (mimeType.startsWith('audio/')) {
            messageType = 'audio';
        } else {
            messageType = 'document';
        }

        // Enviar según el tipo
        if (messageType === 'image') {
            console.log('📷 Enviando imagen a WhatsApp...');
            await whatsappService.sendImage(phoneNumber, mediaId, caption);
        } else if (messageType === 'audio') {
            console.log('🎤 Enviando audio a WhatsApp...');
            console.log(`   → Número destino: ${phoneNumber}`);
            console.log(`   → Media ID: ${mediaId}`);
            console.log(`   → Tipo de mensaje: ${messageType}`);
            const audioResult = await whatsappService.sendAudio(phoneNumber, mediaId, caption);
            console.log('✅ Respuesta de WhatsApp para audio:', JSON.stringify(audioResult, null, 2));
        } else {
            console.log('📄 Enviando documento a WhatsApp...');
            await whatsappService.sendDocument(phoneNumber, mediaId, filename || 'documento', caption);
        }

        console.log('✅ Mensaje enviado a WhatsApp, guardando en conversación...');

        // Guardar mensaje en la conversación (CON caption si fue proporcionado)
        conversationService.addMessage(phoneNumber, {
            from: 'advisor',
            type: messageType,
            mediaPath: mediaPath,
            mimeType: mimeType,
            caption: messageType !== 'audio' ? (caption || null) : null, // Audio no soporta caption
            filename: filename || 'archivo',
            size: fs.statSync(fullPath).size
        });

        console.log('✅ Mensaje guardado en conversación');

        // Emitir por WebSocket al panel
        const io = req.app.get('io');
        if (io) {
            // Obtener estado del usuario para el frontend
            const userSession = menuService.getUserSession(phoneNumber);
            const isWithAdvisorNow = menuService.isUserWithAdvisor(phoneNumber) ||
                                    userSession?.state === 'WAITING_ADVISOR_QUERY' ||
                                    userSession?.state === 'WITH_ADVISOR';

            io.emit('new_message', {
                phoneNumber: phoneNumber,
                message: {
                    from: 'advisor',
                    type: messageType,
                    mediaPath: mediaPath,
                    mimeType: mimeType,
                    caption: messageType !== 'audio' ? caption : null,
                    filename: filename,
                    timestamp: new Date()
                },
                isWithAdvisor: isWithAdvisorNow, // Incluir estado para frontend
                userState: userSession?.state // Incluir estado del usuario
            });
        }

        console.log('✅ Archivo enviado completamente');

        res.json({
            success: true,
            message: 'Archivo enviado correctamente'
        });
    } catch (error) {
        console.error('❌ Error al enviar media:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            error: 'Error al enviar archivo',
            details: error.message
        });
    }
});

module.exports = router;
