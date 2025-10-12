# 🤖 WhatsApp E-commerce Bot

Bot de WhatsApp Business integrado con tu tienda de autopartes Django.

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- Cuenta de WhatsApp Business API
- Token de acceso de Meta
- Número de WhatsApp Business configurado

## 🚀 Instalación

1. **Instala las dependencias:**
```bash
npm install
```

2. **Configura las variables de entorno:**

Copia el archivo `.env.example` a `.env`:
```bash
copy .env.example .env
```

Luego edita `.env` con tus credenciales:
```
WHATSAPP_TOKEN=tu_token_de_acceso_aqui
PHONE_NUMBER_ID=tu_phone_number_id_aqui
WEBHOOK_VERIFY_TOKEN=tu_token_secreto_aqui
PORT=3000
```

### 🔑 Dónde obtener las credenciales:

1. **WHATSAPP_TOKEN**: 
   - Ve a [Meta for Developers](https://developers.facebook.com/)
   - Selecciona tu app
   - Ve a WhatsApp > API Setup
   - Copia el "Temporary access token" (para producción, genera uno permanente)

2. **PHONE_NUMBER_ID**: 
   - En la misma página de API Setup
   - Busca "Phone number ID" debajo del número de prueba

3. **WEBHOOK_VERIFY_TOKEN**: 
   - Es un string secreto que TÚ defines (ej: "mi_token_secreto_123")
   - Debe ser el mismo que configures en Meta

## 🔧 Configuración del Webhook en Meta

1. Ve a tu app en Meta for Developers
2. WhatsApp > Configuration > Webhook
3. Clic en "Edit"
4. **Callback URL**: `https://tu-dominio.com/webhook` 
   - Para desarrollo local usa ngrok: `https://xxxx.ngrok.io/webhook`
5. **Verify token**: El mismo que pusiste en `WEBHOOK_VERIFY_TOKEN`
6. Suscríbete a los campos: `messages`

### 🌐 Usando ngrok para desarrollo local:

```bash
# Instala ngrok
npm install -g ngrok

# Ejecuta ngrok en el puerto 3000
ngrok http 3000

# Copia la URL HTTPS que te da y úsala como Callback URL
```

## ▶️ Ejecución

**Modo desarrollo (con auto-reload):**
```bash
npm run dev
```

**Modo producción:**
```bash
npm start
```

El servidor correrá en `http://localhost:3000`

## 📱 Uso del Bot

1. Envía un mensaje de WhatsApp al número configurado
2. Escribe **"hola"** o **"menu"** para comenzar
3. Navega por las opciones usando los botones interactivos

### Comandos disponibles:
- `hola` / `menu` / `inicio` - Muestra el menú principal
- `categorias` - Ver categorías de productos
- `carrito` - Ver tu carrito de compras
- `ayuda` - Obtener ayuda

## 🏗️ Estructura del Proyecto

```
wpp/
├── src/
│   ├── index.js                 # Servidor Express principal
│   ├── routes/
│   │   └── whatsapp.js          # Rutas del webhook
│   ├── controllers/
│   │   └── webhookController.js # Controlador de mensajes
│   └── services/
│       ├── whatsappService.js   # Servicios de WhatsApp API
│       ├── menuService.js       # Lógica del menú interactivo
│       └── ecommerceService.js  # Integración con Django
├── .env                         # Variables de entorno (NO SUBIR A GIT)
├── .env.example                 # Plantilla de variables
├── package.json
└── README.md
```

## 🔗 Integración con Django E-commerce

El bot actualmente usa datos de prueba. Para conectarlo con tu Django backend:

1. **Activa el servidor Django** (debe estar corriendo en `http://localhost:8000`)

2. **Edita `src/services/ecommerceService.js`** y descomenta las llamadas a la API real:

```javascript
// Cambiar de datos de prueba a API real
const response = await axios.get(`${ECOMMERCE_API_URL}/catalog/categories/`);
return response.data;
```

3. **Asegúrate que las URLs de la API coincidan** con tus endpoints de Django

### Endpoints necesarios en Django:

- `GET /api/catalog/categories/` - Lista de categorías
- `GET /api/catalog/products/?category={id}` - Productos por categoría
- `GET /api/catalog/products/{id}/` - Detalles de producto
- `POST /api/orders/` - Crear orden

## 🧪 Pruebas

Para probar el bot sin WhatsApp, puedes usar herramientas como:

- **Postman** o **cURL** para simular webhooks
- **Ejemplo de mensaje de prueba:**

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "521234567890",
            "type": "text",
            "text": { "body": "hola" }
          }]
        }
      }]
    }]
  }'
```

## 📝 Funcionalidades Implementadas

✅ Webhook de WhatsApp configurado
✅ Menú principal interactivo con botones
✅ Navegación por categorías (lista interactiva)
✅ Visualización de productos
✅ Carrito de compras (en memoria)
✅ Sistema de sesiones por usuario
✅ Comandos de texto
✅ Manejo de errores

## 🚧 Próximas Mejoras

- [ ] Integración completa con Django API
- [ ] Persistencia de carritos en base de datos
- [ ] Sistema de pagos
- [ ] Confirmación de pedidos
- [ ] Seguimiento de órdenes
- [ ] Notificaciones automáticas
- [ ] Soporte para imágenes de productos
- [ ] Búsqueda de productos

## 🐛 Troubleshooting

### El webhook no se verifica
- Verifica que `WEBHOOK_VERIFY_TOKEN` sea el mismo en .env y en Meta
- Asegúrate que el servidor esté corriendo
- Si usas ngrok, verifica que la URL HTTPS sea correcta

### No llegan mensajes
- Verifica que estés suscrito al campo `messages` en el webhook
- Revisa los logs del servidor (`console.log`)
- Verifica que el token de acceso sea válido

### Errores al enviar mensajes
- Verifica `WHATSAPP_TOKEN` y `PHONE_NUMBER_ID`
- Asegúrate que el número de destino esté registrado como número de prueba
- Revisa los logs de error en la consola

## 📞 Soporte

Para más información sobre WhatsApp Business API:
- [Documentación oficial](https://developers.facebook.com/docs/whatsapp)
- [Guía de inicio rápido](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

**Desarrollado con ❤️ para AutoPartes Store**
