const express = require('express');
const router = express.Router();
const conversationService = require('../services/conversationService');
const whatsappService = require('../services/whatsappService');

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
 */
router.post('/conversations/:phoneNumber/archive', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { advisorNotes } = req.body;

        await conversationService.archiveConversation(phoneNumber, advisorNotes);

        res.json({
            success: true,
            message: 'Conversación archivada correctamente'
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

module.exports = router;
