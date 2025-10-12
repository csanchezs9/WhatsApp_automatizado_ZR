const express = require('express');
const router = express.Router();
const { handleWebhookVerification, handleIncomingMessage } = require('../controllers/webhookController');

// Verificación del webhook (GET request from Meta)
router.get('/', handleWebhookVerification);

// Recibir mensajes entrantes (POST request from Meta)
router.post('/', handleIncomingMessage);

module.exports = router;
