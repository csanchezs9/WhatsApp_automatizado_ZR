# 📊 Resumen: Deploy en Render.com (Plan Paid)

## ✅ Archivos Creados

1. **`render.yaml`** - Configuración automática de Render
2. **`docs/DEPLOY-RENDER.md`** - Guía completa detallada (50+ páginas)
3. **`DEPLOY-CHECKLIST.md`** - Checklist rápido (15 minutos)

---

## 🎯 Lo Que Necesitas Saber

### 💰 Precio
**$7 USD/mes** (Plan Starter)

### ⚙️ Características
- ✅ Siempre activo 24/7 (NO se duerme)
- ✅ 512 MB RAM
- ✅ SSL/HTTPS automático
- ✅ Auto-deploy desde GitHub
- ✅ Logs en tiempo real
- ✅ Reinicio automático si falla

### 🚀 Tiempo de Setup
**~15 minutos** siguiendo el checklist

---

## 📋 Pasos Principales

### 1. Crear Cuenta
```
https://render.com/ → Sign Up con GitHub
```

### 2. Crear Web Service
```
New + → Web Service → Conectar repo WhatsApp_automatizado_ZR
```

### 3. Configuración Crítica
```
Root Directory: wpp  ⚠️ IMPORTANTE
Instance Type: Starter ($7/mes)
```

### 4. Variables de Entorno
```
WHATSAPP_TOKEN=tu_token
WHATSAPP_PHONE_ID=tu_phone_id
WEBHOOK_VERIFY_TOKEN=mi_token_secreto_whatsapp_2024
ECOMMERCE_API_URL=https://zonarepuestera.com.co/api/v1
ADVISOR_PHONE_NUMBER=573164088588
PORT=3000
NODE_ENV=production
```

### 5. Deploy
```
Create Web Service → Esperar 2-3 minutos → Ver logs
```

### 6. Configurar Webhook en Meta
```
URL: https://tu-servicio.onrender.com/webhook
Token: mi_token_secreto_whatsapp_2024
Suscribirse a: messages
```

### 7. Probar
```
Enviar mensaje al bot → Debe responder con menú
```

---

## 📂 Estructura de Archivos del Proyecto

```
wpp/
├── src/
│   ├── index.js          ✅ Configurado para production
│   ├── controllers/
│   ├── routes/
│   └── services/
├── package.json          ✅ Scripts listos
├── .env.example          (tus .env van en Render)
├── render.yaml           ✅ NUEVO - Config de Render
├── DEPLOY-CHECKLIST.md   ✅ NUEVO - Guía rápida
└── docs/
    └── DEPLOY-RENDER.md  ✅ NUEVO - Guía completa
```

---

## 🔑 Tokens Necesarios (¿Dónde Obtenerlos?)

### WHATSAPP_TOKEN (Token de Acceso)
1. https://developers.facebook.com/
2. Tu App → WhatsApp → Configuración
3. "Generar token de acceso permanente"
4. Copiar (empieza con "EAA...")

### WHATSAPP_PHONE_ID (ID del Teléfono)
1. Misma página de configuración
2. Copiar "Phone number ID" (número largo)

### WEBHOOK_VERIFY_TOKEN (Token de Verificación)
- Lo defines tú mismo
- Ejemplo: `mi_token_secreto_whatsapp_2024`
- **DEBE SER EL MISMO en Render y en Meta**

---

## 🎬 Orden de Ejecución

```mermaid
1. Crear cuenta en Render
   ↓
2. Crear Web Service (conectar GitHub)
   ↓
3. Configurar variables de entorno
   ↓
4. Seleccionar Plan Starter ($7/mes)
   ↓
5. Click "Create Web Service"
   ↓
6. Esperar deploy (~3 min)
   ↓
7. Copiar URL generada
   ↓
8. Configurar webhook en Meta
   ↓
9. Probar enviando mensaje
   ↓
10. ✅ Bot funcionando 24/7
```

---

## ⚠️ Cosas Importantes

### ✅ HACER:
- Poner `Root Directory: wpp` (crítico)
- Seleccionar plan **Starter** ($7/mes)
- Copiar exactamente las variables de entorno
- Verificar que el webhook se valide en Meta
- Suscribirse al evento `messages`

### ❌ NO HACER:
- Seleccionar plan "Free" (se duerme cada 15 min)
- Olvidar poner `wpp` como root directory
- Usar tokens diferentes en Render y Meta
- Olvidar suscribirse a eventos en Meta

---

## 📊 Comparación de Planes

| Plan | Precio | RAM | Siempre Activo | Uso |
|------|--------|-----|----------------|-----|
| **Free** | $0 | 512 MB | ❌ (duerme) | Testing |
| **Starter** | $7 | 512 MB | ✅ 24/7 | **RECOMENDADO** |
| Standard | $25 | 2 GB | ✅ 24/7 | Apps grandes |

Para tu bot: **Starter es perfecto** 👍

---

## 🔄 Actualización Automática

Cuando haces cambios:

```bash
# 1. Editar código
vim src/services/menuService.js

# 2. Guardar cambios
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 3. Render detecta el push automáticamente
# 4. Redeploy en 2-3 minutos
# 5. ✅ Bot actualizado sin hacer nada más
```

**Sin SSH, sin comandos, sin complicaciones** 🎉

---

## 📈 Monitoreo

### Dashboard de Render
- Ver CPU/RAM usage en tiempo real
- Logs en vivo
- Historial de deploys
- Métricas de requests

### Ver Logs
```
Dashboard → Tu servicio → Logs (pestaña)
```

Verás en tiempo real:
```
✅ Servidor corriendo en puerto 3000
📱 Mensaje de 573XXXXXXX: Hola
✅ Mensaje enviado
```

---

## 🚨 Solución Rápida de Problemas

| Error | Solución |
|-------|----------|
| Build failed | Verificar `Root Directory: wpp` |
| App failed to start | Revisar variables de entorno |
| Webhook no verifica | Tokens deben coincidir en Render y Meta |
| Bot no responde | Verificar suscripción a `messages` en Meta |

---

## 💳 Método de Pago

### Aceptan:
- ✅ Tarjetas de crédito (Visa, Mastercard, Amex)
- ✅ Tarjetas de débito
- ✅ PayPal (en algunos casos)

### Facturación:
- 📅 Cobro mensual automático
- 📧 Recibes factura por email
- 🔄 Renovación automática
- ❌ Sin contrato (cancelas cuando quieras)

---

## 📞 Soporte

### Si Tienes Problemas:

**Documentación:**
https://render.com/docs

**Discord (Community):**
https://render.com/community

**Email:**
team@render.com

**Status del servicio:**
https://status.render.com/

---

## ✅ Ventajas de Render

1. **Setup super rápido** (15 min)
2. **Sin configuración de servidor** (no necesitas saber Linux)
3. **Auto-deploy** (push y listo)
4. **SSL automático** (HTTPS gratis)
5. **Logs en tiempo real** (debugging fácil)
6. **Reinicio automático** (si falla, se levanta solo)
7. **Precio justo** ($7/mes sin sorpresas)

---

## 🎯 Próximos Pasos

### 1. Ahora:
- [ ] Leer `DEPLOY-CHECKLIST.md`
- [ ] Seguir los 9 pasos
- [ ] Deployment completo

### 2. Después del Deploy:
- [ ] Probar todas las funciones del bot
- [ ] Monitorear logs primeros días
- [ ] Ajustar si es necesario

### 3. Mantenimiento:
- [ ] Revisar logs semanalmente
- [ ] Actualizar código con `git push`
- [ ] Monitorear métricas

---

## 🎉 Resultado Final

Después de seguir la guía tendrás:

✅ Bot activo 24/7  
✅ URL segura con HTTPS  
✅ Deploy automático desde GitHub  
✅ Logs y métricas en tiempo real  
✅ Por solo $7/mes  

**Tu bot estará listo para atender clientes en cualquier momento** 🚀

---

## 📚 Documentos de Referencia

1. **DEPLOY-CHECKLIST.md** - Guía paso a paso (15 min)
2. **docs/DEPLOY-RENDER.md** - Guía completa detallada
3. **render.yaml** - Configuración técnica

**Recomendación:** Empieza con el CHECKLIST para deploy rápido.

---

**Creado:** 19 de enero de 2025  
**Versión:** 1.0  
**Estado:** ✅ Listo para producción
