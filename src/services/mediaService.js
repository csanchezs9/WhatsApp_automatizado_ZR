const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const rateLimitMonitor = require('./rateLimitMonitor');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

// Directorio para guardar archivos multimedia
// Usar process.cwd() en lugar de __dirname para evitar problemas con rutas relativas
const MEDIA_DIR = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/data/persistent/media'
    : path.join(process.cwd(), 'src/data/persistent/media');

// Crear directorio si no existe
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    console.log('📁 Directorio de media creado:', MEDIA_DIR);
}

/**
 * Obtener URL de descarga de un archivo multimedia de WhatsApp
 * @param {string} mediaId - ID del archivo multimedia
 * @returns {Promise<object>} - Información del archivo (url, mime_type, etc)
 */
async function getMediaUrl(mediaId) {
    try {
        // Registrar llamada API
        rateLimitMonitor.trackCall('media_download');

        const response = await axios.get(`${WHATSAPP_API_URL}/${mediaId}`, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            }
        });

        return response.data;
    } catch (error) {
        console.error('❌ Error obteniendo URL de media:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Descargar archivo multimedia de WhatsApp
 * @param {string} mediaUrl - URL del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<string>} - Path local del archivo descargado
 */
async function downloadMedia(mediaUrl, mimeType) {
    try {
        // Registrar llamada API
        rateLimitMonitor.trackCall('media_download');

        const response = await axios.get(mediaUrl, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            },
            responseType: 'arraybuffer'
        });

        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const extension = mime.extension(mimeType) || 'bin';
        const filename = `${timestamp}.${extension}`;
        const filepath = path.join(MEDIA_DIR, filename);

        // Guardar archivo
        fs.writeFileSync(filepath, response.data);

        console.log(`✅ Archivo descargado: ${filename} (${mimeType})`);

        // Retornar path relativo para guardar en BD
        return `media/${filename}`;
    } catch (error) {
        console.error('❌ Error descargando media:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Procesar mensaje multimedia de WhatsApp
 * @param {object} message - Mensaje de WhatsApp
 * @returns {Promise<object>} - Información del archivo procesado
 */
async function processMediaMessage(message) {
    const messageType = message.type;
    let mediaId = null;
    let caption = null;
    let filename = null;

    // Extraer mediaId según el tipo
    switch (messageType) {
        case 'image':
            mediaId = message.image.id;
            caption = message.image.caption || null;
            break;
        case 'document':
            mediaId = message.document.id;
            caption = message.document.caption || null;
            filename = message.document.filename || null;
            break;
        case 'audio':
            mediaId = message.audio.id;
            break;
        case 'video':
            mediaId = message.video.id;
            caption = message.video.caption || null;
            break;
        default:
            throw new Error(`Tipo de media no soportado: ${messageType}`);
    }

    // Obtener URL de descarga
    const mediaInfo = await getMediaUrl(mediaId);
    const { url, mime_type } = mediaInfo;

    // Descargar archivo
    const localPath = await downloadMedia(url, mime_type);

    return {
        type: messageType,
        mediaId: mediaId,
        mimeType: mime_type,
        localPath: localPath,
        caption: caption,
        filename: filename,
        size: mediaInfo.file_size || null
    };
}

/**
 * Obtener path completo de un archivo
 * @param {string} relativePath - Path relativo (ej: "media/12345.jpg")
 * @returns {string} - Path absoluto
 */
function getMediaFullPath(relativePath) {
    // Usar rutas absolutas correctas según el entorno
    const baseDir = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/src/data/persistent'
        : path.join(process.cwd(), 'src/data/persistent');

    return path.join(baseDir, relativePath);
}

/**
 * Verificar si un archivo existe
 * @param {string} relativePath - Path relativo
 * @returns {boolean}
 */
function mediaExists(relativePath) {
    const fullPath = getMediaFullPath(relativePath);
    return fs.existsSync(fullPath);
}

/**
 * Eliminar archivo multimedia
 * @param {string} relativePath - Path relativo
 */
function deleteMedia(relativePath) {
    try {
        const fullPath = getMediaFullPath(relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`🗑️ Archivo eliminado: ${relativePath}`);
        }
    } catch (error) {
        console.error('❌ Error eliminando archivo:', error.message);
    }
}

module.exports = {
    processMediaMessage,
    getMediaFullPath,
    mediaExists,
    deleteMedia,
    MEDIA_DIR
};
