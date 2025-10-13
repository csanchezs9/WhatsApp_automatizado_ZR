// Script de prueba para simular webhook de WhatsApp
const axios = require('axios');

async function testBot() {
  const webhookUrl = 'http://localhost:3000/webhook';
  
  // Simular mensaje de usuario pidiendo estado de pedido
  const testMessage = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            phone_number_id: '778330925371261'
          },
          messages: [{
            from: '573173745021',
            id: 'test_message_id',
            timestamp: Date.now(),
            type: 'text',
            text: {
              body: '8'  // Selecciona opción 8 (Estado de Pedido)
            }
          }]
        }
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje de prueba al bot...');
    const response = await axios.post(webhookUrl, testMessage);
    console.log('✅ Respuesta del bot:', response.status);
    console.log('📝 Data:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testBot();
