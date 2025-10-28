const express = require('express');
const router = express.Router();
const conversationService = require('../services/conversationService');
const whatsappService = require('../services/whatsappService');
const menuService = require('../services/menuService');
const fs = require('fs');
const path = require('path');

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

        res.json({
            success: true,
            conversation: {
                phoneNumber: conversation.phoneNumber,
                messages: conversation.messages,
                startedAt: conversation.startedAt,
                lastActivity: conversation.lastActivity,
                status: conversation.status
            }
        });
    } catch (error) {
        console.error('Error al obtener conversación:', error);
        res.status(500).json({ error: 'Error al obtener conversación' });
    }
});

/**
 * GET /api/conversations/:phoneNumber/history
 * Obtener historial de conversaciones de un cliente (últimos 90 días)
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

        // Enviar mensaje por WhatsApp
        await whatsappService.sendTextMessage(phoneNumber, message);

        // Agregar mensaje a la conversación
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
 * POST /api/conversations/:phoneNumber/archive
 * Archivar conversación y eliminarla de activas
 * También finaliza la sesión con el asesor si está activa
 */
router.post('/conversations/:phoneNumber/archive', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { advisorNotes } = req.body;

        // Finalizar la conversación con el asesor (si está activa)
        if (menuService.isUserWithAdvisor(phoneNumber)) {
            menuService.deactivateAdvisorMode(phoneNumber);

            // Enviar mensaje al cliente informando que la conversación finalizó
            const finalMessage = `✅ *Conversación finalizada*\n\n` +
                `El asesor ha finalizado la conversación.\n\n` +
                `Si necesitas más ayuda, puedes volver al menú principal escribiendo *menú*.`;

            await whatsappService.sendTextMessage(phoneNumber, finalMessage);

            console.log(`🔚 Conversación con asesor finalizada desde el panel para ${phoneNumber}`);
        }

        // Archivar la conversación
        await conversationService.archiveConversation(phoneNumber, advisorNotes);

        res.json({
            success: true,
            message: 'Conversación archivada y finalizada correctamente'
        });

        // Emitir evento de WebSocket
        if (req.app.get('io')) {
            req.app.get('io').emit('conversation_archived', { phoneNumber });
        }
    } catch (error) {
        console.error('Error al archivar conversación:', error);
        res.status(500).json({ error: 'Error al archivar conversación' });
    }
});

/**
 * POST /api/conversations/:phoneNumber/finalize
 * Finaliza la conversación con el asesor sin archivarla
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
            `Si necesitas más ayuda, puedes volver al menú principal escribiendo *menú*.`;

        await whatsappService.sendTextMessage(phoneNumber, finalMessage);

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

module.exports = router;
