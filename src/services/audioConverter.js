const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Convertir archivo de audio WebM a M4A (AAC codec)
 * WhatsApp prefiere AAC sobre Opus para mensajes de voz nativos
 *
 * @param {string} inputPath - Ruta del archivo WebM de entrada
 * @param {string} outputPath - Ruta del archivo M4A de salida
 * @returns {Promise<string>} - Ruta del archivo convertido
 */
async function convertWebMToM4A(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Convirtiendo audio a M4A/AAC...');

        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Archivo de entrada no encontrado: ${inputPath}`));
        }

        const args = [
            '-i', inputPath,
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '1',
            '-vn',
            '-y',
            outputPath
        ];

        const process = spawn(ffmpeg, args);
        let stderr = '';

        // Solo capturar stderr para errores (no mostrar todo el output de FFmpeg)
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    console.log(`✅ Audio convertido: ${(stats.size / 1024).toFixed(2)} KB`);
                    resolve(outputPath);
                } else {
                    reject(new Error('Archivo de salida no fue creado'));
                }
            } else {
                console.error('❌ Error en conversión:', stderr.slice(0, 200));
                reject(new Error(`FFmpeg falló con código ${code}`));
            }
        });

        process.on('error', (error) => {
            console.error('❌ Error al ejecutar FFmpeg:', error.message);
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
    const compatibleFormats = ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/mp3'];

    if (compatibleFormats.includes(inputMimeType)) {
        return {
            path: inputPath,
            mimeType: inputMimeType,
            converted: false
        };
    }

    const outputPath = inputPath.replace(/\.[^.]+$/, '_converted.m4a');

    try {
        await convertWebMToM4A(inputPath, outputPath);

        // Eliminar archivo original para ahorrar espacio
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        return {
            path: outputPath,
            mimeType: 'audio/mp4',
            converted: true
        };
    } catch (error) {
        console.error('❌ Error en conversión de audio:', error.message);
        throw error;
    }
}

module.exports = {
    convertAudioForWhatsApp
};
