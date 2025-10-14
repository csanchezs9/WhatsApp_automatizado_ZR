# INICIO RAPIDO - NGROK + BOT LOCAL

## 1. Configurar Ngrok (SOLO UNA VEZ)

### Obtener Authtoken:
1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copia tu authtoken
3. Ejecuta en PowerShell:

```powershell
C:\ngrok\ngrok.exe config add-authtoken TU_TOKEN_AQUI
```

---

## 2. Workflow Diario de Desarrollo

### Terminal 1: Iniciar Bot Local
```powershell
cd C:\Users\USER\Documents\AUTwpp\wpp
npm start
```

### Terminal 2: Iniciar Ngrok
```powershell
C:\ngrok\ngrok.exe http 3000
```

Veras algo como:
```
Session Status    online
Forwarding        https://xxxx-yyyy-zzzz.ngrok-free.app -> http://localhost:3000
```

### 3. Actualizar Webhook en Meta

1. Copia la URL de "Forwarding": https://xxxx-yyyy-zzzz.ngrok-free.app
2. Ve a: https://developers.facebook.com/
3. Tu App → WhatsApp → Configuracion → Webhook
4. Editar y poner:
   - URL: https://xxxx-yyyy-zzzz.ngrok-free.app/webhook
   - Token: mi_token_secreto_whatsapp_2024
5. Guardar

### 4. Probar
Envia mensaje de WhatsApp al bot y deberia responder!

---

## Ver Dashboard de Ngrok

Mientras ngrok esta corriendo, abre:
http://localhost:4040

Veras TODAS las peticiones HTTP en tiempo real!

---

## Comandos Rapidos

### Iniciar ngrok
```powershell
C:\ngrok\ngrok.exe http 3000
```

### Ver version
```powershell
C:\ngrok\ngrok.exe version
```

### Ver configuracion
```powershell
C:\ngrok\ngrok.exe config check
```

---

## Recordatorios Importantes

⚠️ La URL de ngrok CAMBIA cada vez que reinicias
⚠️ Debes actualizar el webhook en Meta cada vez
⚠️ Ngrok FREE no guarda URLs fijas
⚠️ Produccion sigue en Render (no se afecta)
