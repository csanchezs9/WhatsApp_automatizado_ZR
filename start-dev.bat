@echo off
echo ====================================
echo    BOT WHATSAPP - DESARROLLO LOCAL
echo ====================================
echo.
echo Iniciando bot en localhost:3000...
echo.

cd /d C:\Users\USER\Documents\AUTwpp\wpp
start "Bot WhatsApp" cmd /k "npm start"

timeout /t 5 /nobreak >nul

echo.
echo Iniciando Ngrok tunnel...
echo.
start "Ngrok Tunnel" cmd /k "C:\ngrok\ngrok.exe http 3000"

timeout /t 3 /nobreak >nul

echo.
echo ====================================
echo   TODO LISTO!
echo ====================================
echo.
echo Bot corriendo en: http://localhost:3000
echo Ngrok dashboard en: http://localhost:4040
echo.
echo Copia la URL de Ngrok y actualiza webhook en Meta
echo.
pause
