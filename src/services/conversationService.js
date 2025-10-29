const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { deleteMedia } = require('./mediaService');

// Ruta persistente en Render Disk
const DB_PATH = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/data/persistent/conversations.db'
    : path.join(__dirname, '../data/persistent/conversations.db');

// Asegurar que el directorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicializar base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
        console.log('✅ Conectado a SQLite en:', DB_PATH);
    }
});

// Crear tabla si no existe
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            messages TEXT NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME,
            status TEXT DEFAULT 'active',
            advisor_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Crear índice para búsquedas rápidas
    db.run(`CREATE INDEX IF NOT EXISTS idx_phone_number ON conversations(phone_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON conversations(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_started_at ON conversations(started_at)`);

    console.log('✅ Tabla de conversaciones inicializada');
});

// Conversaciones activas en memoria (para rendimiento)
const activeConversations = new Map();

// Límite de conversaciones activas en memoria
const MAX_ACTIVE_CONVERSATIONS = 100;

/**
 * Agregar mensaje a conversación activa
 */
function addMessage(phoneNumber, message) {
    if (!activeConversations.has(phoneNumber)) {
        activeConversations.set(phoneNumber, {
            phoneNumber,
            messages: [],
            startedAt: new Date(),
            status: 'active',
            lastActivity: new Date()
        });
    }

    const conversation = activeConversations.get(phoneNumber);
    conversation.messages.push({
        ...message,
        timestamp: new Date()
    });
    conversation.lastActivity = new Date();

    // Límite de 500 mensajes por conversación
    if (conversation.messages.length > 500) {
        archiveConversation(phoneNumber);
    }

    // Si hay demasiadas conversaciones activas, archivar las más antiguas
    if (activeConversations.size > MAX_ACTIVE_CONVERSATIONS) {
        archiveOldestConversation();
    }

    return conversation;
}

/**
 * Obtener conversación activa
 */
function getActiveConversation(phoneNumber) {
    return activeConversations.get(phoneNumber);
}

/**
 * Obtener todas las conversaciones activas
 */
function getAllActiveConversations() {
    return Array.from(activeConversations.values())
        .sort((a, b) => b.lastActivity - a.lastActivity);
}

/**
 * Archivar conversación (guardar en BD y eliminar de memoria)
 */
function archiveConversation(phoneNumber, advisorNotes = null) {
    const conversation = activeConversations.get(phoneNumber);
    if (!conversation) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const messagesJson = JSON.stringify(conversation.messages);

        db.run(
            `INSERT INTO conversations (phone_number, messages, started_at, ended_at, status, advisor_notes)
             VALUES (?, ?, ?, ?, 'archived', ?)`,
            [
                phoneNumber,
                messagesJson,
                conversation.startedAt.toISOString(),
                new Date().toISOString(),
                advisorNotes
            ],
            function(err) {
                if (err) {
                    console.error('❌ Error al archivar conversación:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ Conversación archivada: ${phoneNumber} (${conversation.messages.length} mensajes)`);
                    activeConversations.delete(phoneNumber);
                    resolve(this.lastID);
                }
            }
        );
    });
}

/**
 * Archivar la conversación más antigua
 */
function archiveOldestConversation() {
    const conversations = Array.from(activeConversations.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);

    if (conversations.length > 0) {
        const [phoneNumber] = conversations[0];
        console.log(`⚠️ Límite alcanzado. Archivando conversación más antigua: ${phoneNumber}`);
        archiveConversation(phoneNumber);
    }
}

/**
 * Obtener historial de conversaciones de un cliente (últimos 20 días)
 */
function getConversationHistory(phoneNumber, limit = 10) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, phone_number, messages, started_at, ended_at, advisor_notes
             FROM conversations
             WHERE phone_number = ?
             AND started_at >= datetime('now', '-20 days')
             ORDER BY started_at DESC
             LIMIT ?`,
            [phoneNumber, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const conversations = rows.map(row => ({
                        id: row.id,
                        phoneNumber: row.phone_number,
                        messages: JSON.parse(row.messages),
                        startedAt: row.started_at,
                        endedAt: row.ended_at,
                        advisorNotes: row.advisor_notes
                    }));
                    resolve(conversations);
                }
            }
        );
    });
}

/**
 * Buscar conversaciones por texto
 */
function searchConversations(searchTerm, limit = 20) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, phone_number, messages, started_at, ended_at
             FROM conversations
             WHERE phone_number LIKE ? OR messages LIKE ?
             AND started_at >= datetime('now', '-20 days')
             ORDER BY started_at DESC
             LIMIT ?`,
            [`%${searchTerm}%`, `%${searchTerm}%`, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const conversations = rows.map(row => ({
                        id: row.id,
                        phoneNumber: row.phone_number,
                        messages: JSON.parse(row.messages),
                        startedAt: row.started_at,
                        endedAt: row.ended_at
                    }));
                    resolve(conversations);
                }
            }
        );
    });
}

/**
 * Rotación automática: Eliminar conversaciones mayores a 20 días
 * IMPORTANTE: También elimina archivos multimedia asociados
 */
function cleanupOldConversations() {
    return new Promise((resolve, reject) => {
        // Primero, obtener las conversaciones que se van a eliminar para borrar sus archivos
        db.all(
            `SELECT messages FROM conversations WHERE started_at < datetime('now', '-20 days')`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('❌ Error al obtener conversaciones antiguas:', err.message);
                    reject(err);
                    return;
                }

                // Extraer todos los archivos multimedia de las conversaciones
                let mediaFilesDeleted = 0;
                rows.forEach(row => {
                    try {
                        const messages = JSON.parse(row.messages);
                        messages.forEach(msg => {
                            // Si el mensaje tiene archivo multimedia, eliminarlo
                            if (msg.mediaPath && (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video')) {
                                deleteMedia(msg.mediaPath);
                                mediaFilesDeleted++;
                            }
                        });
                    } catch (parseError) {
                        console.error('⚠️ Error parseando mensajes:', parseError.message);
                    }
                });

                if (mediaFilesDeleted > 0) {
                    console.log(`🗑️ Archivos multimedia eliminados: ${mediaFilesDeleted}`);
                }

                // Ahora sí, eliminar las conversaciones de la BD
                db.run(
                    `DELETE FROM conversations WHERE started_at < datetime('now', '-20 days')`,
                    function(err) {
                        if (err) {
                            console.error('❌ Error al limpiar conversaciones antiguas:', err.message);
                            reject(err);
                        } else {
                            if (this.changes > 0) {
                                console.log(`🗑️ Conversaciones eliminadas (>20 días): ${this.changes}`);
                            }
                            resolve(this.changes);
                        }
                    }
                );
            }
        );
    });
}

/**
 * Obtener estadísticas de la base de datos
 */
function getStatistics() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT
                COUNT(*) as total_conversations,
                COUNT(CASE WHEN started_at >= datetime('now', '-7 days') THEN 1 END) as last_7_days,
                COUNT(CASE WHEN started_at >= datetime('now', '-30 days') THEN 1 END) as last_30_days,
                SUM(LENGTH(messages)) as total_size_bytes
             FROM conversations`,
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        totalConversations: row.total_conversations,
                        last7Days: row.last_7_days,
                        last30Days: row.last_30_days,
                        totalSizeMB: (row.total_size_bytes / (1024 * 1024)).toFixed(2),
                        activeInMemory: activeConversations.size
                    });
                }
            }
        );
    });
}

// Rotación automática cada 24 horas
setInterval(async () => {
    console.log('🔄 Ejecutando limpieza automática de conversaciones...');
    try {
        await cleanupOldConversations();
        const stats = await getStatistics();
        console.log('📊 Estadísticas:', stats);
    } catch (error) {
        console.error('❌ Error en limpieza automática:', error);
    }
}, 24 * 60 * 60 * 1000); // 24 horas

// Limpieza inicial al arrancar (10 segundos después)
setTimeout(async () => {
    console.log('🔄 Limpieza inicial de conversaciones...');
    try {
        await cleanupOldConversations();
        const stats = await getStatistics();
        console.log('📊 Estadísticas iniciales:', stats);
    } catch (error) {
        console.error('❌ Error en limpieza inicial:', error);
    }
}, 10000);

// Cerrar base de datos al terminar proceso
process.on('SIGINT', () => {
    console.log('\n🔄 Archivando conversaciones activas antes de cerrar...');

    const archivePromises = Array.from(activeConversations.keys()).map(phoneNumber =>
        archiveConversation(phoneNumber)
    );

    Promise.all(archivePromises).then(() => {
        db.close((err) => {
            if (err) {
                console.error('❌ Error al cerrar BD:', err.message);
            } else {
                console.log('✅ Base de datos cerrada correctamente');
            }
            process.exit(0);
        });
    });
});

module.exports = {
    addMessage,
    getActiveConversation,
    getAllActiveConversations,
    archiveConversation,
    getConversationHistory,
    searchConversations,
    cleanupOldConversations,
    getStatistics
};
