require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const whatsappRoutes = require('./routes/whatsapp');
const panelRoutes = require('./routes/panel');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Hacer io accesible en toda la app
app.set('io', io);
global.io = io; // Disponible globalmente para menuService

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos (panel web)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/webhook', whatsappRoutes);
app.use('/api', panelRoutes);

// Panel de asesor
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).send('Error interno del servidor');
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado al panel:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado del panel:', socket.id);
  });

  socket.on('request_conversations', () => {
    // El cliente puede solicitar actualización de conversaciones
    socket.emit('conversations_update', {
      timestamp: new Date()
    });
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`💻 Panel de asesor: http://localhost:${PORT}/`);
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
