# Panel de Asesor Web

## Descripción

Panel web profesional para que los asesores de Zona Repuestera gestionen conversaciones de WhatsApp en tiempo real, sin necesidad de usar la aplicación de WhatsApp Business.

## Características

✅ **Gestión en Tiempo Real**
- Ver todas las conversaciones activas
- Responder mensajes directamente desde el navegador
- Notificaciones en tiempo real mediante WebSocket
- Actualización automática cada 10 segundos

✅ **Historial Persistente**
- Historial de conversaciones de los últimos 20 días
- Almacenamiento en SQLite (Render Disk 2GB)
- Búsqueda por número de teléfono
- Ver conversaciones pasadas de clientes recurrentes

✅ **Funciones de Asesor**
- Archivar conversaciones finalizadas
- Agregar notas a conversaciones
- Búsqueda rápida de clientes
- Estadísticas de uso

## Acceso al Panel

### URL de Producción
```
https://whatsapp-automatizado-zr-86dx.onrender.com/
```

### URL de Desarrollo
```
http://localhost:3000/
```

### Credenciales por Defecto

**Usuario:** `admin`
**Contraseña:** `zonarepuestera2025`

> ⚠️ **Importante:** Cambia estas credenciales en producción editando las variables de entorno `PANEL_USERNAME` y `PANEL_PASSWORD` en Render.

## Cómo Usar el Panel

### 1. Inicio de Sesión
1. Abre el panel en tu navegador
2. Ingresa usuario y contraseña
3. Presiona "Iniciar Sesión"

### 2. Ver Conversaciones Activas
- El panel muestra automáticamente todas las conversaciones activas
- Las conversaciones se ordenan por actividad más reciente
- El indicador verde muestra si estás conectado al servidor

### 3. Responder Mensajes
1. Haz clic en una conversación de la lista
2. Escribe tu mensaje en el campo de texto
3. Presiona "Enviar" o Enter

### 4. Ver Historial de Cliente
1. Selecciona una conversación
2. Haz clic en "📚 Ver Historial"
3. Verás las últimas 10 conversaciones de ese cliente

### 5. Archivar Conversación
1. Selecciona una conversación
2. Haz clic en "🗄️ Archivar"
3. Opcionalmente agrega notas
4. Confirma la acción

La conversación se guardará en la base de datos y se eliminará de las conversaciones activas.

### 6. Buscar Cliente
- Usa el buscador en la parte superior de la lista
- Escribe el número de teléfono
- Los resultados se filtran automáticamente

## Arquitectura Técnica

### Stack Tecnológico
- **Frontend:** HTML5, CSS3, JavaScript vanilla
- **Backend:** Node.js, Express
- **Tiempo Real:** Socket.io
- **Base de Datos:** SQLite (almacenada en Render Disk)
- **Hosting:** Render.com (Starter Plan $7/mes + Disk 2GB $2/mes)

### Flujo de Datos

```
Cliente WhatsApp → Meta API → Webhook (/webhook)
                                    ↓
                         menuService registra mensaje
                                    ↓
                         conversationService (SQLite)
                                    ↓
                         WebSocket notifica panel
                                    ↓
                         Panel actualiza UI en tiempo real
```

### Estructura de Archivos

```
wpp/
├── src/
│   ├── public/                    # Panel web (frontend)
│   │   ├── index.html            # UI del panel
│   │   ├── styles.css            # Estilos
│   │   └── app.js                # Lógica del panel
│   ├── routes/
│   │   ├── whatsapp.js           # Webhook de WhatsApp
│   │   └── panel.js              # API del panel
│   ├── services/
│   │   ├── conversationService.js # Gestión de conversaciones
│   │   ├── menuService.js        # Lógica del bot
│   │   └── whatsappService.js    # Envío de mensajes
│   ├── data/
│   │   └── persistent/           # Montado en Render Disk
│   │       └── conversations.db  # Base de datos SQLite
│   └── index.js                  # Servidor principal
```

## API Endpoints

### Autenticación
Todos los endpoints requieren Basic Auth:
```
Authorization: Basic base64(username:password)
```

### GET /api/conversations
Obtiene todas las conversaciones activas.

**Respuesta:**
```json
{
  "success": true,
  "total": 5,
  "conversations": [
    {
      "phoneNumber": "573123456789",
      "messageCount": 12,
      "lastMessage": {...},
      "startedAt": "2025-01-15T10:00:00Z",
      "lastActivity": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/conversations/:phoneNumber
Obtiene conversación específica con todos los mensajes.

### GET /api/conversations/:phoneNumber/history
Obtiene historial de conversaciones pasadas (últimos 90 días).

### POST /api/send-message
Envía un mensaje al cliente.

**Body:**
```json
{
  "phoneNumber": "573123456789",
  "message": "Hola, ¿en qué puedo ayudarte?"
}
```

### POST /api/conversations/:phoneNumber/archive
Archiva una conversación.

**Body:**
```json
{
  "advisorNotes": "Cliente interesado en repuestos Toyota"
}
```

### GET /api/statistics
Obtiene estadísticas de la base de datos.

**Respuesta:**
```json
{
  "success": true,
  "statistics": {
    "totalConversations": 150,
    "last7Days": 45,
    "last30Days": 120,
    "totalSizeMB": "12.5",
    "activeInMemory": 5
  }
}
```

## Gestión de Datos

### Almacenamiento en Memoria vs. Disco

**Conversaciones Activas (RAM):**
- Máximo 100 conversaciones simultáneas
- Acceso ultra-rápido
- Se pierden si el servidor se reinicia (no es problema, son temporales)

**Historial Persistente (SQLite en Render Disk):**
- Últimos 90 días de conversaciones archivadas
- Sobrevive reinicios y deploys
- Rotación automática cada 24 horas (elimina conversaciones > 90 días)
- Tamaño estimado: 45-90 MB

### Limpieza Automática

El sistema ejecuta limpieza automática:
1. **Al iniciar:** 10 segundos después del arranque
2. **Periódicamente:** Cada 24 horas a las 3:00 AM

La limpieza elimina:
- Conversaciones archivadas mayores a 90 días
- Sesiones inactivas mayores a 24 horas

## Configuración en Render

### Variables de Entorno Necesarias

Agregar en Render Dashboard → Environment:

```env
# Panel de Asesor
PANEL_USERNAME=tu_usuario_seguro
PANEL_PASSWORD=tu_contraseña_segura

# Otras variables existentes
WHATSAPP_TOKEN=...
PHONE_NUMBER_ID=...
WEBHOOK_VERIFY_TOKEN=...
ECOMMERCE_API_URL=...
ADVISOR_PHONE_NUMBER=...
INACTIVITY_TIMEOUT_MINUTES=20
NODE_ENV=production
```

### Configuración del Disco Persistente

1. Ve a tu servicio en Render Dashboard
2. Settings → Disks → Add Disk
3. Configuración:
   - **Name:** `chatbot-data`
   - **Size:** 2 GB
   - **Mount Path:** `/opt/render/project/src/data/persistent`
4. Guardar y redesplegar

### Health Check

El servidor expone un endpoint de salud:
```
GET /health
```

Render puede usar este endpoint para verificar que el servicio está funcionando.

## Seguridad

### Autenticación
- Basic Auth en todos los endpoints del panel
- Credenciales configurables mediante variables de entorno
- Las credenciales se almacenan en localStorage del navegador (solo en cliente autorizado)

### Protección de Datos
- Solo se registran conversaciones de clientes (no del asesor)
- Los mensajes se truncan a 10,000 caracteres para prevenir ataques
- Las conversaciones se archivan automáticamente después de 500 mensajes
- Rotación automática de datos antiguos (90 días)

### Mejores Prácticas
1. Cambia las credenciales por defecto en producción
2. Usa contraseñas fuertes (mínimo 12 caracteres)
3. No compartas las credenciales del panel
4. Cierra sesión cuando no estés usando el panel
5. Accede solo desde redes seguras

## Solución de Problemas

### El panel no carga
1. Verifica que el servidor esté corriendo
2. Revisa que la URL sea correcta
3. Limpia caché del navegador

### No puedo iniciar sesión
1. Verifica las credenciales en las variables de entorno de Render
2. Asegúrate de usar el usuario y contraseña correctos
3. Revisa los logs del servidor en Render

### No veo conversaciones activas
1. Verifica que haya clientes escribiendo al bot
2. Revisa que el webhook esté configurado correctamente
3. Comprueba los logs del servidor

### Los mensajes no se envían
1. Verifica el token de WhatsApp en variables de entorno
2. Revisa que el `PHONE_NUMBER_ID` sea correcto
3. Comprueba los logs de error en Render

### El historial está vacío
1. Solo se guardan conversaciones archivadas
2. Verifica que el disco de Render esté montado correctamente
3. Revisa los logs de SQLite en el servidor

### WebSocket desconectado
1. Refresca la página del panel
2. Verifica tu conexión a internet
3. Revisa que Render no esté en modo "sleeping" (requiere plan Starter, no Free)

## Monitoreo y Logs

### Ver Logs en Tiempo Real
```bash
# En Render Dashboard
Logs → Tail Logs
```

### Mensajes de Log Importantes

✅ **Inicio exitoso:**
```
✅ Servidor corriendo en puerto 3000
📱 Webhook URL: https://...
💻 Panel de asesor: https://...
✅ Conectado a SQLite en: /opt/render/project/src/data/persistent/conversations.db
```

🔌 **Conexión de asesor:**
```
🔌 Cliente conectado al panel: xyz123
```

📨 **Nuevo mensaje:**
```
📨 Nuevo mensaje recibido: {...}
```

🗑️ **Limpieza automática:**
```
🗑️ Conversaciones eliminadas (>90 días): 15
📊 Estadísticas: {...}
```

## Mantenimiento

### Backup Manual de Base de Datos
Render no permite acceso SSH directo, pero puedes exportar datos mediante la API:

```bash
curl -u admin:password https://tu-app.onrender.com/api/statistics
```

### Monitorear Uso de Disco
Revisa las estadísticas del panel o usa:
```bash
curl -u admin:password https://tu-app.onrender.com/api/statistics
```

Verás `totalSizeMB` que indica el tamaño actual de la base de datos.

### Actualizar Contraseñas
1. Ve a Render Dashboard → tu servicio → Environment
2. Edita `PANEL_USERNAME` y `PANEL_PASSWORD`
3. Guarda y redesplega (Manual Deploy)

## Roadmap / Mejoras Futuras

- [ ] Soporte para múltiples asesores con roles
- [ ] Notificaciones de escritorio
- [ ] Exportar conversaciones a CSV
- [ ] Estadísticas avanzadas (gráficos)
- [ ] Respuestas rápidas predefinidas
- [ ] Modo oscuro
- [ ] Aplicación móvil (PWA)

## Soporte

Si necesitas ayuda con el panel:
1. Revisa esta documentación
2. Consulta los logs en Render
3. Verifica las variables de entorno
4. Contacta al desarrollador

---

**Desarrollado para Zona Repuestera**
Versión 1.0 - Enero 2025
