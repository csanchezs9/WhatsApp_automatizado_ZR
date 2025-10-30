# 🚀 Guía de Deployment en Render.com

## 📌 Información del Servicio

**Plataforma:** Render.com  
**Plan:** Starter ($7/mes)  
**Región:** Oregon (USA)  
**Tipo:** Web Service  
**Runtime:** Node.js 18+

---

## ✅ Paso 1: Crear Cuenta en Render

1. Visita: https://render.com/
2. Click en **"Get Started"** o **"Sign Up"**
3. Conecta con tu cuenta de **GitHub**
4. Autoriza el acceso a tus repositorios

---

## ✅ Paso 2: Crear el Web Service

### 2.1 Desde el Dashboard

1. Click en **"New +"** (esquina superior derecha)
2. Selecciona **"Web Service"**

### 2.2 Conectar Repositorio

1. Busca: `WhatsApp_automatizado_ZR`
2. Click en **"Connect"**

### 2.3 Configurar el Servicio

**Name:** `whatsapp-bot-zona-repuestera` (o el que prefieras)  
**Region:** `Oregon (US West)` (mejor latencia para Colombia)  
**Branch:** `main`  
**Root Directory:** `wpp` ⚠️ IMPORTANTE  
**Environment:** `Node`  
**Build Command:** `npm install`  
**Start Command:** `npm start`  

### 2.4 Seleccionar Plan

1. Scroll hasta **"Instance Type"**
2. Selecciona: **"Starter"** ($7/mes)
   - ✅ 512 MB RAM
   - ✅ 0.5 CPU
   - ✅ **Siempre activo (24/7)**
   - ✅ Sin límite de tiempo
   - ✅ SSL/HTTPS incluido

**⚠️ NO selecciones "Free" porque se duerme cada 15 minutos**

---

## ✅ Paso 3: Configurar Variables de Entorno

### 3.1 En la Configuración

Antes de crear el servicio, baja a la sección **"Environment Variables"**

### 3.2 Agregar Variables (una por una)

Click en **"Add Environment Variable"** y agrega:

```env
WHATSAPP_TOKEN=tu_token_de_meta
```

```env
WHATSAPP_PHONE_ID=tu_phone_id
```

```env
WEBHOOK_VERIFY_TOKEN=mi_token_secreto_whatsapp_2024
```

```env
ECOMMERCE_API_URL=https://zonarepuestera.com.co/api/v1
```

```env
ADVISOR_PHONE_NUMBER=573164088588
```

```env
PORT=3000
```

```env
NODE_ENV=production
```

### 3.3 ¿Dónde Obtener los Tokens?

**WHATSAPP_TOKEN:**
- Meta Business Suite → Configuración → API de WhatsApp
- Generar token de acceso permanente

**WHATSAPP_PHONE_ID:**
- Meta Business Suite → API de WhatsApp
- ID del teléfono (número largo)

**WEBHOOK_VERIFY_TOKEN:**
- Lo defines tú (debe coincidir con el que pongas en Meta)
- Usa el mismo: `mi_token_secreto_whatsapp_2024`

---

## ✅ Paso 4: Crear el Servicio

1. Click en **"Create Web Service"** (botón azul)
2. Render comenzará a:
   - ✅ Clonar tu repositorio
   - ✅ Instalar dependencias (`npm install`)
   - ✅ Iniciar tu aplicación (`npm start`)

**⏱️ Esto toma ~2-3 minutos**

---

## ✅ Paso 5: Obtener la URL del Webhook

### 5.1 URL Generada

Después del deploy, verás una URL como:
```
https://whatsapp-bot-zona-repuestera.onrender.com
```

### 5.2 URL del Webhook para WhatsApp

Tu webhook será:
```
https://whatsapp-bot-zona-repuestera.onrender.com/webhook
```

**⚠️ Copia esta URL, la necesitarás para Meta**

---

## ✅ Paso 6: Configurar el Webhook en Meta

### 6.1 Ir a Meta for Developers

1. Visita: https://developers.facebook.com/
2. Ve a **"Mis Aplicaciones"**
3. Selecciona tu app de WhatsApp Business

### 6.2 Configurar Webhook

1. En el menú lateral: **WhatsApp → Configuración**
2. Busca la sección **"Webhook"**
3. Click en **"Editar"** o **"Configurar"**

### 6.3 Ingresar Datos

**URL de devolución de llamadas:**
```
https://whatsapp-bot-zona-repuestera.onrender.com/webhook
```

**Token de verificación:**
```
mi_token_secreto_whatsapp_2024
```

### 6.4 Verificar

1. Click en **"Verificar y guardar"**
2. Meta enviará una petición GET a tu webhook
3. Si todo está bien, verás: ✅ **"Webhook verificado"**

### 6.5 Suscribirse a Eventos

1. Click en **"Administrar"** (en campos de webhook)
2. Marca estas opciones:
   - ✅ `messages`
   - ✅ `message_status` (opcional)
3. Click en **"Guardar"**

---

## ✅ Paso 7: Verificar que Funciona

### 7.1 Ver Logs en Render

1. En Render, ve a tu servicio
2. Click en **"Logs"** (pestaña superior)
3. Deberías ver:
```
✅ Servidor corriendo en puerto 3000
📱 Webhook URL: http://localhost:3000/webhook
🔑 Verify Token: mi_token_secreto_whatsapp_2024
```

### 7.2 Probar el Bot

1. Abre WhatsApp en tu teléfono
2. Envía un mensaje al número de tu bot
3. Deberías recibir el menú principal

### 7.3 Verificar en Logs de Render

Deberías ver mensajes como:
```
📱 Mensaje de 573XXXXXXX: Hola
✅ Mensaje enviado
```

---

## ✅ Paso 8: Configuración del Plan de Pago

### 8.1 Agregar Método de Pago

1. En Render, ve a **"Account Settings"**
2. Click en **"Billing"**
3. Click en **"Add Payment Method"**
4. Ingresa tu tarjeta de crédito/débito

### 8.2 Confirmar Plan Starter

1. Ve a tu servicio
2. Click en **"Settings"** (pestaña)
3. Baja a **"Instance Type"**
4. Verifica que dice: **"Starter - $7/month"**

### 8.3 Ciclo de Facturación

- 💳 Se cobra mensualmente
- 📅 Primer cobro: Inmediato
- 🔄 Renovación: Automática cada mes
- ⚠️ Puedes cancelar cuando quieras (sin penalización)

---

## 🔧 Configuraciones Adicionales Recomendadas

### Health Check

En **Settings → Health & Alerts:**

**Health Check Path:** `/webhook`  
**Health Check Protocol:** `GET`

Esto permite que Render verifique que tu bot está activo.

### Auto-Deploy

Por defecto, Render hace **auto-deploy** cuando haces `git push`:

1. Haces cambios en tu código local
2. `git push origin main`
3. Render detecta el cambio
4. Redeploy automático (2-3 minutos)

**Puedes desactivar auto-deploy si quieres control manual:**
- Settings → Build & Deploy → Auto-Deploy: OFF

### Custom Domain (Opcional)

Si quieres usar tu propio dominio:

1. Settings → Custom Domains
2. Click en **"Add Custom Domain"**
3. Ingresa tu dominio (ej: `bot.zonarepuestera.com`)
4. Sigue las instrucciones para configurar DNS

---

## 📊 Monitoreo y Mantenimiento

### Ver Métricas

**Dashboard → Metrics:**
- 📈 CPU Usage
- 💾 Memory Usage
- 🌐 Request Count
- ⏱️ Response Time

### Ver Logs en Tiempo Real

```bash
# Desde terminal (opcional)
render logs --service whatsapp-bot-zona-repuestera --tail
```

O desde el dashboard: **Logs** (se actualizan en tiempo real)

### Reiniciar Manualmente

Si necesitas reiniciar:
1. Dashboard → Manual Deploy
2. Click en **"Clear build cache & deploy"**

---

## 🚨 Solución de Problemas

### Problema 1: "Build Failed"

**Solución:**
1. Verifica que `Root Directory` sea `wpp`
2. Verifica `package.json` en la carpeta `wpp`
3. Revisa logs de build

### Problema 2: "Application Failed to Start"

**Solución:**
1. Verifica que `PORT` esté en variables de entorno
2. Verifica que tu código use `process.env.PORT`
3. Revisa logs de runtime

### Problema 3: Webhook No Verifica

**Solución:**
1. Verifica que la URL sea correcta (con `/webhook`)
2. Verifica que `WEBHOOK_VERIFY_TOKEN` coincida en Render y Meta
3. Revisa logs para ver la petición GET de verificación

### Problema 4: Bot No Responde

**Solución:**
1. Verifica que estés suscrito a eventos `messages` en Meta
2. Verifica logs en Render (busca "Mensaje de...")
3. Verifica que `WHATSAPP_TOKEN` sea válido (no expirado)

---

## 💰 Costos Detallados

### Plan Starter

**Precio:** $7 USD/mes

**Incluye:**
- ✅ 512 MB RAM
- ✅ 0.5 vCPU
- ✅ Siempre activo (24/7)
- ✅ SSL/HTTPS automático
- ✅ Auto-deploy desde GitHub
- ✅ 100 GB bandwidth/mes (más que suficiente)
- ✅ Logs ilimitados
- ✅ Reinicio automático en caso de error

**Sin cargos extra por:**
- ❌ Requests
- ❌ Bandwidth (hasta 100GB)
- ❌ Builds/Deploys

---

## 🔄 Actualizaciones del Bot

### Flujo de Actualización

1. Haces cambios en tu código local
2. Guardas: `git add .`
3. Commit: `git commit -m "feat: nueva funcionalidad"`
4. Push: `git push origin main`
5. **Render detecta el cambio automáticamente**
6. Redeploy en ~2-3 minutos
7. ✅ Bot actualizado sin downtime

### Ver Historial de Deploys

Dashboard → **Deploys**
- Ver todos los deploys anteriores
- Rollback a versión anterior si algo falla

---

## 📞 Soporte de Render

**Documentación:** https://render.com/docs  
**Discord:** https://render.com/community  
**Email:** team@render.com  
**Status:** https://status.render.com/

---

## ✅ Checklist Final

Antes de considerar el deployment completo, verifica:

- [ ] Servicio creado en Render con plan Starter ($7/mes)
- [ ] Todas las variables de entorno configuradas
- [ ] Root Directory configurado como `wpp`
- [ ] Deploy exitoso (logs sin errores)
- [ ] URL del servicio generada
- [ ] Webhook configurado en Meta
- [ ] Webhook verificado correctamente
- [ ] Suscrito a eventos `messages` en Meta
- [ ] Método de pago agregado
- [ ] Prueba enviando mensaje al bot
- [ ] Bot responde con menú
- [ ] Logs muestran actividad

---

## 🎉 ¡Listo!

Tu bot está deployado en Render.com con:
- ✅ Disponibilidad 24/7
- ✅ SSL/HTTPS incluido
- ✅ Auto-deploy desde GitHub
- ✅ Logs en tiempo real
- ✅ Reinicio automático
- ✅ Por solo $7/mes

---

## 🔗 Enlaces Útiles

**Tu Dashboard de Render:**
https://dashboard.render.com/

**Tu Servicio (después de crear):**
https://dashboard.render.com/web/[tu-service-id]

**Documentación Node.js en Render:**
https://render.com/docs/deploy-node-express-app

**Meta for Developers:**
https://developers.facebook.com/

---

**Fecha:** 19 de enero de 2025  
**Versión:** 1.0  
**Plataforma:** Render.com Starter Plan
