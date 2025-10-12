require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/webhook', whatsappRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('🚀 WhatsApp E-commerce Bot está corriendo!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).send('Error interno del servidor');
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🔑 Verify Token: ${process.env.WEBHOOK_VERIFY_TOKEN}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

module.exports = app;
