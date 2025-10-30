const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Convertir archivo de audio WebM a OGG (Opus codec)
 * para compatibilidad con WhatsApp Business API
 *
 * @param {string} inputPath - Ruta del archivo WebM de entrada
 * @param {string} outputPath - Ruta del archivo OGG de salida
 * @returns {Promise<string>} - Ruta del archivo convertido
 */
async function convertWebMToOgg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Iniciando conversión de audio:');
        console.log(`   → Entrada: ${inputPath}`);
        console.log(`   → Salida: ${outputPath}`);

        // Verificar que el archivo de entrada existe
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Archivo de entrada no encontrado: ${inputPath}`));
        }

        // FFmpeg comando para WhatsApp Business API:
        // -i input.webm: archivo de entrada
        // -c:a libopus: codec de audio Opus
        // -b:a 64k: bitrate de 64kbps (calidad aceptable para voz)
        // -ar 48000: sample rate 48kHz (estándar Opus)
        // -ac 1: mono (voz)
        // -vn: no video
        // -y: sobrescribir archivo de salida
        const args = [
            '-i', inputPath,
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-ar', '48000',
            '-ac', '1',
            '-vn',
            '-y',
            outputPath
        ];

        console.log(`   → Comando FFmpeg: ${ffmpeg} ${args.join(' ')}`);

        const process = spawn(ffmpeg, args);

        let stderr = '';
        let stdout = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('[FFmpeg stdout]:', data.toString());
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('[FFmpeg stderr]:', data.toString());
        });

        process.on('close', (code) => {
            if (code === 0) {
                // Conversión exitosa
                console.log('✅ Conversión completada exitosamente');
                console.log(`   → Archivo generado: ${outputPath}`);

                // Verificar que el archivo de salida existe
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    console.log(`   → Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
                    resolve(outputPath);
                } else {
                    reject(new Error('Archivo de salida no fue creado'));
                }
            } else {
                // Error en conversión
                console.error('❌ Error en conversión de audio:');
                console.error(`   → Código de salida: ${code}`);
                console.error(`   → FFmpeg stderr: ${stderr}`);
                reject(new Error(`FFmpeg falló con código ${code}: ${stderr}`));
            }
        });

        process.on('error', (error) => {
            console.error('❌ Error al ejecutar FFmpeg:', error);
            reject(error);
        });
    });
}

/**
 * Convertir archivo de audio a formato compatible con WhatsApp
 * Detecta el formato de entrada y convierte automáticamente
 *
 * @param {string} inputPath - Ruta del archivo de entrada
 * @param {string} inputMimeType - MIME type del archivo
 * @returns {Promise<{path: string, mimeType: string}>} - Info del archivo convertido
 */
async function convertAudioForWhatsApp(inputPath, inputMimeType) {
    // Si ya es un formato compatible, no convertir
    const compatibleFormats = ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/aac', 'audio/m4a'];

    if (compatibleFormats.includes(inputMimeType)) {
        console.log(`✅ Audio ya está en formato compatible: ${inputMimeType}`);
        return {
            path: inputPath,
            mimeType: inputMimeType,
            converted: false
        };
    }

    // Si es WebM o formato no compatible, convertir a OGG
    console.log(`🔄 Audio en formato no compatible (${inputMimeType}), convirtiendo a OGG...`);

    const outputPath = inputPath.replace(/\.[^.]+$/, '_converted.ogg');

    try {
        await convertWebMToOgg(inputPath, outputPath);

        // Eliminar archivo original para ahorrar espacio
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            console.log(`🗑️ Archivo original eliminado: ${inputPath}`);
        }

        return {
            path: outputPath,
            mimeType: 'audio/ogg',
            converted: true
        };
    } catch (error) {
        console.error('❌ Error en conversión de audio:', error);
        throw error;
    }
}

module.exports = {
    convertWebMToOgg,
    convertAudioForWhatsApp
};
