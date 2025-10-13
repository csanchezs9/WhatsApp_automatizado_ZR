# 🚀 Deploy Rápido en Render.com - Checklist

## ⚡ Paso a Paso (15 minutos)

### 1️⃣ Crear Cuenta (2 min)
- [ ] Ir a https://render.com/
- [ ] Sign Up con GitHub
- [ ] Autorizar acceso

### 2️⃣ Crear Web Service (3 min)
- [ ] Click **"New +"** → **"Web Service"**
- [ ] Conectar repo: `WhatsApp_automatizado_ZR`
- [ ] Configurar:
  ```
  Name: whatsapp-bot-zona-repuestera
  Region: Oregon (US West)
  Branch: main
  Root Directory: wpp  ⚠️ IMPORTANTE
  Environment: Node
  Build Command: npm install
  Start Command: npm start
  ```

### 3️⃣ Seleccionar Plan (1 min)
- [ ] **Instance Type:** Starter ($7/mes)
- [ ] ✅ **NO seleccionar Free** (se duerme)

### 4️⃣ Variables de Entorno (3 min)
Agregar una por una:

```env
WHATSAPP_TOKEN=tu_token_de_meta
WHATSAPP_PHONE_ID=tu_phone_id
WEBHOOK_VERIFY_TOKEN=mi_token_secreto_whatsapp_2024
ECOMMERCE_API_URL=https://zonarepuestera.com.co/api/v1
ADVISOR_PHONE_NUMBER=573164088588
PORT=3000
NODE_ENV=production
```

### 5️⃣ Deploy (3 min)
- [ ] Click **"Create Web Service"**
- [ ] Esperar ~2-3 minutos
- [ ] Ver logs: debe decir "✅ Servidor corriendo en puerto 3000"

### 6️⃣ Copiar URL del Webhook (1 min)
Tu URL será algo como:
```
https://whatsapp-bot-zona-repuestera.onrender.com/webhook
```

### 7️⃣ Configurar en Meta (2 min)
- [ ] Ir a https://developers.facebook.com/
- [ ] Seleccionar tu app de WhatsApp
- [ ] WhatsApp → Configuración → Webhook
- [ ] URL: `https://tu-servicio.onrender.com/webhook`
- [ ] Token: `mi_token_secreto_whatsapp_2024`
- [ ] Click **"Verificar y guardar"**
- [ ] Suscribirse a evento: `messages` ✅

### 8️⃣ Probar (1 min)
- [ ] Enviar mensaje a tu bot de WhatsApp
- [ ] Debe responder con el menú
- [ ] Ver logs en Render (debe mostrar "📱 Mensaje de...")

### 9️⃣ Agregar Método de Pago
- [ ] Account Settings → Billing
- [ ] Add Payment Method
- [ ] Ingresar tarjeta

---

## 🔑 Tokens de Meta (¿Dónde Obtenerlos?)

### WHATSAPP_TOKEN
1. Meta Business Suite
2. Configuración → API de WhatsApp
3. Generar token de acceso permanente
4. Copiar el token (empieza con "EAA...")

### WHATSAPP_PHONE_ID
1. Meta Business Suite
2. API de WhatsApp
3. Copiar el "Phone number ID" (número largo)

### WEBHOOK_VERIFY_TOKEN
- Lo defines tú mismo
- Ejemplo: `mi_token_secreto_whatsapp_2024`
- **DEBE ser el MISMO en Render y en Meta**

---

## ✅ Verificación Final

Después del deploy, verifica:

✅ **Render Dashboard:**
- Service status: "Live" (verde)
- Logs muestran: "✅ Servidor corriendo en puerto 3000"
- URL generada y accesible

✅ **Meta Webhook:**
- Estado: "Verificado" (verde)
- Suscrito a: "messages"

✅ **Prueba Real:**
- Envía mensaje al bot → Recibe menú
- Selecciona opción → Bot responde
- Logs en Render muestran actividad

---

## 💰 Costos

**Plan Starter:** $7 USD/mes
- ✅ Siempre activo (24/7)
- ✅ SSL incluido
- ✅ Auto-deploy
- ✅ Sin límites de requests

**Cobro:** Mensual automático
**Cancelación:** En cualquier momento

---

## 🔄 Actualizar el Bot

```bash
# Hacer cambios en código
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# Render detecta y redeploy automáticamente (2-3 min)
```

---

## 🚨 Problemas Comunes

### "Build Failed"
→ Verifica `Root Directory: wpp`

### "Application Failed to Start"
→ Verifica variables de entorno

### "Webhook no verifica"
→ Verifica que tokens coincidan en Render y Meta

### "Bot no responde"
→ Verifica suscripción a evento `messages` en Meta

---

## 📞 Ayuda

**Docs:** https://render.com/docs  
**Support:** team@render.com  
**Discord:** https://render.com/community

---

## 🎯 Ventajas de Render vs Otras Opciones

✅ **vs Railway:** Similar precio, mismo servicio  
✅ **vs Heroku:** Más barato (Heroku = $10/mes)  
✅ **vs VPS:** Sin configuración manual, SSL automático  
✅ **vs Render Free:** No se duerme (crítico para WhatsApp)

---

¡Listo! Con esto tu bot estará 24/7 activo por $7/mes 🚀
