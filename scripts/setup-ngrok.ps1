# Script para descargar e instalar Ngrok en Windows
# Ejecutar con: powershell -ExecutionPolicy Bypass -File setup-ngrok.ps1

Write-Host "🔧 Instalando Ngrok para Windows..." -ForegroundColor Green

# Crear directorio temporal
$tempDir = "$env:TEMP\ngrok-install"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# URL de descarga de Ngrok para Windows
$ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
$zipPath = "$tempDir\ngrok.zip"
$extractPath = "$env:LOCALAPPDATA\ngrok"

Write-Host "📥 Descargando Ngrok..." -ForegroundColor Yellow

try {
    # Descargar Ngrok
    Invoke-WebRequest -Uri $ngrokUrl -OutFile $zipPath -UseBasicParsing
    
    Write-Host "📦 Extrayendo archivos..." -ForegroundColor Yellow
    
    # Crear directorio de instalación si no existe
    New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
    
    # Extraer ZIP
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    # Agregar al PATH del usuario
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$extractPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$extractPath", "User")
        Write-Host "✅ Ngrok agregado al PATH" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ Ngrok instalado exitosamente en: $extractPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 IMPORTANTE: Cierra y vuelve a abrir PowerShell para usar 'ngrok'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🔑 Próximos pasos:" -ForegroundColor Yellow
    Write-Host "1. Crea una cuenta en: https://dashboard.ngrok.com/signup" -ForegroundColor White
    Write-Host "2. Obtén tu authtoken en: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
    Write-Host "3. Ejecuta: ngrok config add-authtoken TU_TOKEN" -ForegroundColor White
    Write-Host "4. Inicia el túnel: ngrok http 3000" -ForegroundColor White
    Write-Host ""
    
    # Limpiar archivos temporales
    Remove-Item -Path $tempDir -Recurse -Force
    
} catch {
    Write-Host "❌ Error durante la instalación: $_" -ForegroundColor Red
    exit 1
}
