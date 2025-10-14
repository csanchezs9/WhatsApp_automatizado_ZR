# GUIA DE INSTALACION DE NGROK PARA DESARROLLO LOCAL

## Opcion 1: Descarga Manual (RECOMENDADO - 5 minutos)

### Paso 1: Descargar Ngrok
1. Ve a: https://ngrok.com/download
2. Click en "Download for Windows"
3. Se descargara: ngrok-v3-stable-windows-amd64.zip

### Paso 2: Instalar
1. Extrae el archivo ZIP
2. Mueve ngrok.exe a: C:\ngrok\
3. Agrega C:\ngrok\ al PATH de Windows:
   - Windows + R → sysdm.cpl
   - Pestana "Opciones avanzadas"
   - "Variables de entorno"
   - En "Variables del usuario" → Editar "Path"
   - Agregar: C:\ngrok\
   - Aceptar todo

### Paso 3: Configurar Authtoken
1. Crea cuenta en: https://dashboard.ngrok.com/signup
2. Copia tu authtoken de: https://dashboard.ngrok.com/get-started/your-authtoken
3. En PowerShell: ngrok config add-authtoken TU_TOKEN_AQUI

### Paso 4: Probar
```powershell
ngrok http 3000
```

---

## Opcion 2: Instalacion Rapida con PowerShell

### Ejecuta estos comandos uno por uno:

```powershell
# 1. Crear directorio
New-Item -ItemType Directory -Force -Path C:\ngrok

# 2. Descargar Ngrok
Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile "$env:TEMP\ngrok.zip"

# 3. Extraer
Expand-Archive -Path "$env:TEMP\ngrok.zip" -DestinationPath "C:\ngrok" -Force

# 4. Agregar al PATH (temporal para esta sesion)
$env:Path += ";C:\ngrok"

# 5. Verificar instalacion
ngrok version
```

---

## Configuracion para el Proyecto

### 1. Iniciar Bot Local
```powershell
cd C:\Users\USER\Documents\AUTwpp\wpp
npm start
```

### 2. En otra terminal, iniciar Ngrok
```powershell
ngrok http 3000
```

### 3. Copiar URL de Ngrok
Veras algo como:
```
Forwarding  https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:3000
```

### 4. Actualizar Webhook en Meta
1. Ve a: https://developers.facebook.com/
2. Tu App → WhatsApp → Configuracion
3. Webhook URL: https://xxxx-xxxx-xxxx.ngrok-free.app/webhook
4. Verify Token: mi_token_secreto_whatsapp_2024
5. Suscribirse a: messages

---

## Comandos Utiles

### Iniciar tunel basico
```powershell
ngrok http 3000
```

### Con subdominio personalizado (plan de pago)
```powershell
ngrok http 3000 --domain=tu-dominio.ngrok.io
```

### Ver todas las conexiones
```powershell
ngrok http 3000 --log=stdout
```

### Ver dashboard web
Mientras ngrok esta corriendo, ve a: http://localhost:4040

---

## Workflow de Desarrollo

### Terminal 1: Bot Local
```powershell
cd C:\Users\USER\Documents\AUTwpp\wpp
npm start
```

### Terminal 2: Ngrok Tunnel
```powershell
ngrok http 3000
```

### Terminal 3: Git (para guardar cambios)
```powershell
cd C:\Users\USER\Documents\AUTwpp\wpp
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

---

## Ventajas de Ngrok para Desarrollo

✅ Pruebas locales con WhatsApp real
✅ Ver logs en tiempo real
✅ Debugging mas facil
✅ No afecta produccion (Render)
✅ Cambios instantaneos sin deploy
✅ Dashboard con todas las peticiones HTTP

---

## Importante

⚠️ **Ngrok FREE cambia la URL cada vez que reinicias**
- Tendras que actualizar el webhook en Meta cada vez
- Para URL fija necesitas plan de pago ($8/mes)

⚠️ **Nunca subas el .env al repositorio**
- El .env ya esta en .gitignore
- Render tiene sus propias variables de entorno

⚠️ **Produccion siempre en Render**
- Ngrok solo para desarrollo
- Render tiene tu token permanente y esta 24/7

---

## Troubleshooting

### Error: "ngrok no se reconoce como comando"
- Cierra y vuelve a abrir PowerShell
- Verifica que C:\ngrok\ este en el PATH

### Error: "authenticate ngrok"
- Ejecuta: ngrok config add-authtoken TU_TOKEN

### Bot no responde con Ngrok
- Verifica que el bot este corriendo (Terminal 1)
- Verifica que ngrok este activo (Terminal 2)
- Actualiza webhook en Meta con nueva URL de ngrok
