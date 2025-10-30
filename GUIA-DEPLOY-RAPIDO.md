# 🚀 GUÍA DE DEPLOY RÁPIDO

**Tiempo estimado:** 15-20 minutos
**Última actualización:** 29 de Octubre 2025

---

## ✅ PRE-REQUISITOS

Antes de hacer deploy, asegúrate de tener:

- [ ] Cuenta de Render.com (ya tienes una)
- [ ] Token de WhatsApp Business API
- [ ] Phone Number ID de WhatsApp
- [ ] Repositorio Git actualizado
- [ ] Credenciales personalizadas para el panel

---

## 🎯 PASO 1: VERIFICAR VARIABLES DE ENTORNO

En Render Dashboard, verifica que estas variables estén configuradas:

### Variables Requeridas
```bash
WHATSAPP_TOKEN=tu_token_aqui
PHONE_NUMBER_ID=tu_phone_id_aqui
WEBHOOK_VERIFY_TOKEN=tu_token_verificacion
ECOMMERCE_API_URL=https://zonarepuestera.com.co/api/v1
ADVISOR_PHONE_NUMBER=573164088588
PORT=3000
```

### Variables de Panel (IMPORTANTE)
```bash
PANEL_USERNAME=asesor
PANEL_PASSWORD=tu_password_seguro_aqui
```

⚠️ **NO uses las credenciales por defecto en producción**

### Variables Opcionales
```bash
NODE_ENV=production
INACTIVITY_TIMEOUT_MINUTES=20
```

---

## 🎯 PASO 2: VERIFICAR CONFIGURACIÓN DE RENDER

### En el Dashboard de Render:

1. **Service Type:** Web Service ✅
2. **Region:** Oregon (o tu región preferida) ✅
3. **Branch:** main ✅
4. **Root Directory:** wpp/ ✅
5. **Build Command:** `npm install` ✅
6. **Start Command:** `npm start` ✅
7. **Plan:** Starter ($7/mes) ⚠️ NO uses Free plan
8. **Disk:** 1GB persistent disk montado en `/opt/render/project/src/data/persistent` ✅

---

## 🎯 PASO 3: HACER DEPLOY

### Opción A: Deploy Automático (Recomendado)
```bash
# 1. Commit y push de cambios
git add .
git commit -m "Ready for production"
git push origin main

# 2. Render detectará los cambios y hará deploy automáticamente
# 3. Espera 2-3 minutos mientras se despliega
```

### Opción B: Deploy Manual desde Render Dashboard
1. Ve a tu servicio en Render
2. Click en "Manual Deploy"
3. Selecciona la rama "main"
4. Click en "Deploy"
5. Espera 2-3 minutos

---

## 🎯 PASO 4: VERIFICAR QUE EL DEPLOY FUNCIONÓ

### 1. Verificar Logs
En Render Dashboard → Logs, deberías ver:
```
✅ Conectado a SQLite en: /opt/render/project/src/data/persistent/conversations.db
✅ Servidor corriendo en puerto 3000
🌐 Panel de asesor disponible en: https://tu-app.onrender.com
```

### 2. Verificar Health Check
Abre en el navegador:
```
https://tu-app.onrender.com/webhook
```

Deberías ver: `GET method not allowed` (esto es correcto)

### 3. Verificar Panel de Asesor
Abre en el navegador:
```
https://tu-app.onrender.com/
```

Deberías ver la pantalla de login.

**Prueba el login:**
- Usuario: `asesor` (o el que configuraste)
- Password: `tu_password_seguro`

Si ves el panel, ✅ **todo funciona correctamente**.

---

## 🎯 PASO 5: CONFIGURAR WEBHOOK EN META

### 1. Ir a Meta for Developers
```
https://developers.facebook.com/apps/
```

### 2. Seleccionar tu app de WhatsApp Business

### 3. Configurar Webhook

**En la sección de WhatsApp → Configuration:**

- **Callback URL:**
  ```
  https://tu-app.onrender.com/webhook
  ```

- **Verify Token:**
  ```
  el_mismo_que_pusiste_en_WEBHOOK_VERIFY_TOKEN
  ```

- **Click en "Verify and Save"**

### 4. Suscribirse a Mensajes

Marca las siguientes opciones:
- [x] messages
- [x] message_status (opcional)

**Click en "Subscribe"**

---

## 🎯 PASO 6: PROBAR CON UN MENSAJE REAL

### 1. Envía un mensaje al número de WhatsApp
```
Hola
```

### 2. Verifica que el bot responda
Deberías recibir el menú principal con opciones interactivas.

### 3. Prueba el panel de asesor
1. Inicia sesión en el panel
2. Selecciona la opción "Hablar con asesor" desde WhatsApp
3. Verifica que la conversación aparezca en el panel
4. Responde desde el panel
5. Verifica que el mensaje llegue a WhatsApp

---

## ✅ CHECKLIST POST-DEPLOY

Después del deploy, verifica:

- [ ] El bot responde mensajes de WhatsApp
- [ ] El menú interactivo funciona
- [ ] Puedes iniciar sesión en el panel
- [ ] Las conversaciones aparecen en el panel
- [ ] Puedes enviar mensajes desde el panel
- [ ] Puedes enviar imágenes desde el panel
- [ ] Puedes grabar y enviar audios desde el panel
- [ ] La búsqueda de productos funciona
- [ ] La consulta de pedidos funciona
- [ ] El modo asesor se activa correctamente

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

### Problema 1: El bot no responde mensajes

**Posibles causas:**
- Webhook no configurado correctamente
- WEBHOOK_VERIFY_TOKEN incorrecto
- WHATSAPP_TOKEN expirado

**Solución:**
```bash
# 1. Verifica logs en Render
# 2. Verifica que el webhook esté suscrito en Meta
# 3. Verifica que las variables de entorno sean correctas
```

---

### Problema 2: No puedo entrar al panel

**Posibles causas:**
- Credenciales incorrectas
- Variables PANEL_USERNAME o PANEL_PASSWORD no configuradas

**Solución:**
```bash
# Verifica en Render → Environment que PANEL_USERNAME y PANEL_PASSWORD estén configurados
# Intenta con las credenciales correctas
```

---

### Problema 3: Los archivos multimedia no se guardan

**Posibles causas:**
- Disco persistente no montado
- Permisos incorrectos

**Solución:**
```bash
# En Render Dashboard → Settings → Disks
# Verifica que haya un disco de 1GB montado en:
# /opt/render/project/src/data/persistent
```

---

### Problema 4: El servidor se reinicia constantemente

**Posibles causas:**
- Error en el código
- Variable de entorno faltante
- Plan Free (se duerme)

**Solución:**
```bash
# 1. Revisa logs en Render para ver el error
# 2. Verifica que TODAS las variables requeridas estén configuradas
# 3. Asegúrate de estar en el plan Starter ($7/mes), NO Free
```

---

## 📊 MONITOREO POST-DEPLOY

### Primeras 24 horas

Monitorea:
- **Logs en Render**: Busca errores
- **Uso de CPU/Memoria**: Debe estar <50%
- **Uso de disco**: Debe estar cerca de 0 MB

### Primera semana

Monitorea:
- **Cantidad de conversaciones**: ¿Cuántas conversaciones activas?
- **Uso de disco**: ¿Está creciendo normalmente?
- **Errores en logs**: ¿Hay errores recurrentes?

### Mensual

- Revisar uso de disco (no debería superar 300-500 MB)
- Hacer respaldo de base de datos
- Revisar logs para optimizaciones

---

## 🔄 ROLLBACK (Si algo sale mal)

Si necesitas volver a una versión anterior:

### Desde Render Dashboard
1. Ve a "Deploys"
2. Encuentra el deploy anterior que funcionaba
3. Click en "⋯" → "Redeploy"

### Desde Git
```bash
# 1. Revertir commit
git revert HEAD
git push origin main

# 2. Render hará deploy automáticamente
```

---

## 📞 CONTACTOS DE EMERGENCIA

### Si algo sale mal:

1. **Revisar logs en Render** (primera opción)
2. **Revisar documentación:**
   - `AUDITORIA-PRE-PRODUCCION.md` - Detalles técnicos
   - `PANEL-ASESOR.md` - Panel de asesor
   - `CLAUDE.md` - Guía completa

3. **Verificar health del servicio:**
   ```
   https://tu-app.onrender.com/webhook
   ```

---

## ✅ DEPLOY EXITOSO

Si llegaste hasta aquí y todo funciona:

🎉 **¡Felicitaciones!** El bot está en producción.

**Siguiente paso:** Capacitar a los asesores en el uso del panel.

---

**Tiempo de deploy:** ~15 minutos
**Última revisión:** 29 de Octubre 2025

