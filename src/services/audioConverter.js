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
        console.log('🔄 Iniciando conversión de audio a M4A/AAC:');
        console.log(`   → Entrada: ${inputPath}`);
        console.log(`   → Salida: ${outputPath}`);

        // Verificar que el archivo de entrada existe
        if (!fs.existsSync(inputPath)) {
            return reject(new Error(`Archivo de entrada no encontrado: ${inputPath}`));
        }

        // FFmpeg comando para WhatsApp - AAC es el formato preferido
        // -i input: archivo de entrada
        // -c:a aac: codec AAC (nativo de WhatsApp/iPhone)
        // -b:a 128k: bitrate 128kbps (calidad buena para voz)
        // -ar 44100: sample rate 44.1kHz (estándar)
        // -ac 1: mono (voz)
        // -vn: no video
        // -y: sobrescribir
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
    // Si ya es M4A/AAC, no convertir
    const compatibleFormats = ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/mp3'];

    if (compatibleFormats.includes(inputMimeType)) {
        console.log(`✅ Audio ya está en formato compatible: ${inputMimeType}`);
        return {
            path: inputPath,
            mimeType: inputMimeType,
            converted: false
        };
    }

    // Convertir WebM/OGG a M4A (AAC) - formato nativo de WhatsApp
    console.log(`🔄 Audio en formato no compatible (${inputMimeType}), convirtiendo a M4A (AAC)...`);

    const outputPath = inputPath.replace(/\.[^.]+$/, '_converted.m4a');

    try {
        await convertWebMToM4A(inputPath, outputPath);

        // Eliminar archivo original para ahorrar espacio
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            console.log(`🗑️ Archivo original eliminado: ${inputPath}`);
        }

        return {
            path: outputPath,
            mimeType: 'audio/mp4', // M4A usa MIME type audio/mp4
            converted: true
        };
    } catch (error) {
        console.error('❌ Error en conversión de audio:', error);
        throw error;
    }
}

module.exports = {
    convertWebMToM4A,
    convertAudioForWhatsApp
};
