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

    // Tabla de sesiones de usuario para persistir estado entre reinicios
    db.run(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            phone_number TEXT PRIMARY KEY,
            session_data TEXT NOT NULL,
            last_activity INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Crear índice para búsquedas rápidas
    db.run(`CREATE INDEX IF NOT EXISTS idx_phone_number ON conversations(phone_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON conversations(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_started_at ON conversations(started_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_session_activity ON user_sessions(last_activity)`);

    console.log('✅ Tabla de conversaciones inicializada');
    console.log('✅ Tabla de sesiones de usuario inicializada');
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
            lastActivity: new Date(),
            isWithAdvisor: false
        });
    }

    const conversation = activeConversations.get(phoneNumber);
    conversation.messages.push({
        ...message,
        timestamp: new Date()
    });
    conversation.lastActivity = new Date();

    // Auto-guardar en BD después de cada mensaje (asíncrono, no bloquea)
    saveConversationToDB(phoneNumber).catch(err => {
        console.error('⚠️ Error auto-guardando conversación:', err.message);
    });

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
 * Guardar conversación activa en BD sin eliminarla de memoria
 * Se usa para persistencia durante reinicios del servidor
 */
function saveConversationToDB(phoneNumber) {
    const conversation = activeConversations.get(phoneNumber);
    if (!conversation) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const messagesJson = JSON.stringify(conversation.messages);

        // Intentar UPDATE primero, si no existe hacer INSERT
        db.run(
            `UPDATE conversations
             SET messages = ?,
                 started_at = ?,
                 status = 'active'
             WHERE phone_number = ? AND status = 'active'`,
            [
                messagesJson,
                conversation.startedAt.toISOString(),
                phoneNumber
            ],
            function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    // No existía, hacer INSERT
                    db.run(
                        `INSERT INTO conversations (phone_number, messages, started_at, status)
                         VALUES (?, ?, ?, 'active')`,
                        [
                            phoneNumber,
                            messagesJson,
                            conversation.startedAt.toISOString()
                        ],
                        function(insertErr) {
                            if (insertErr) {
                                reject(insertErr);
                            } else {
                                resolve(this.lastID);
                            }
                        }
                    );
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
}

/**
 * Recuperar conversaciones activas desde la BD al iniciar el servidor
 */
function loadActiveConversationsFromDB() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT phone_number, messages, started_at
             FROM conversations
             WHERE status = 'active'
             ORDER BY started_at DESC`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('❌ Error cargando conversaciones activas:', err.message);
                    reject(err);
                    return;
                }

                let loadedCount = 0;
                rows.forEach(row => {
                    try {
                        const messages = JSON.parse(row.messages);
                        const lastMessage = messages[messages.length - 1];

                        activeConversations.set(row.phone_number, {
                            phoneNumber: row.phone_number,
                            messages: messages,
                            startedAt: new Date(row.started_at),
                            status: 'active',
                            lastActivity: lastMessage ? new Date(lastMessage.timestamp) : new Date(row.started_at),
                            isWithAdvisor: messages.some(m => m.from === 'advisor') // Inferir si está con asesor
                        });
                        loadedCount++;
                    } catch (parseError) {
                        console.error(`⚠️ Error parseando conversación ${row.phone_number}:`, parseError.message);
                    }
                });

                if (loadedCount > 0) {
                    console.log(`✅ Conversaciones activas recuperadas: ${loadedCount}`);
                }
                resolve(loadedCount);
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

// Recuperar conversaciones activas al iniciar el servidor
setTimeout(async () => {
    console.log('🔄 Recuperando conversaciones activas desde BD...');
    try {
        await loadActiveConversationsFromDB();
        console.log('🔄 Limpieza inicial de conversaciones antiguas...');
        await cleanupOldConversations();
        const stats = await getStatistics();
        console.log('📊 Estadísticas iniciales:', stats);
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
    }
}, 3000); // 3 segundos después de iniciar

/**
 * Guardar sesión de usuario en BD
 */
function saveUserSession(phoneNumber, sessionData) {
    return new Promise((resolve, reject) => {
        try {
            const sessionJson = JSON.stringify(sessionData);
            const lastActivity = sessionData.lastActivity || Date.now();

            db.run(
                `INSERT OR REPLACE INTO user_sessions (phone_number, session_data, last_activity, updated_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [phoneNumber, sessionJson, lastActivity],
                function(err) {
                    if (err) {
                        console.error(`❌ Error guardando sesión ${phoneNumber}:`, err.message);
                        console.error('Datos de sesión:', { state: sessionData.state, hasAdvisorSession: !!sessionData.advisorSession });
                        // No rechazar para no bloquear el flujo
                        resolve();
                    } else {
                        resolve();
                    }
                }
            );
        } catch (stringifyError) {
            console.error(`❌ Error al serializar sesión ${phoneNumber}:`, stringifyError.message);
            console.error('Datos problemáticos:', sessionData);
            // No rechazar para no bloquear el flujo
            resolve();
        }
    });
}

/**
 * Cargar sesión de usuario desde BD
 */
function loadUserSession(phoneNumber) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT session_data, last_activity FROM user_sessions WHERE phone_number = ?`,
            [phoneNumber],
            (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    try {
                        const sessionData = JSON.parse(row.session_data);
                        sessionData.lastActivity = row.last_activity;
                        resolve(sessionData);
                    } catch (parseError) {
                        console.error(`⚠️ Error parseando sesión ${phoneNumber}:`, parseError.message);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            }
        );
    });
}

/**
 * Cargar todas las sesiones activas desde BD
 */
function loadAllUserSessions() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT phone_number, session_data, last_activity FROM user_sessions`,
            [],
            (err, rows) => {
                if (err) {
                    console.error('❌ Error cargando sesiones desde BD:', err.message);
                    console.error('Stack:', err.stack);
                    // Devolver objeto vacío para no bloquear el inicio
                    resolve({});
                    return;
                }

                const sessions = {};
                let loadedCount = 0;

                rows.forEach(row => {
                    try {
                        const sessionData = JSON.parse(row.session_data);
                        sessionData.lastActivity = row.last_activity;
                        sessions[row.phone_number] = sessionData;
                        loadedCount++;
                    } catch (parseError) {
                        console.error(`⚠️ Error parseando sesión ${row.phone_number}:`, parseError.message);
                    }
                });

                if (loadedCount > 0) {
                    console.log(`✅ Sesiones de usuario recuperadas: ${loadedCount}`);
                }
                resolve(sessions);
            }
        );
    });
}

/**
 * Eliminar sesión de usuario de BD
 */
function deleteUserSession(phoneNumber) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM user_sessions WHERE phone_number = ?`,
            [phoneNumber],
            function(err) {
                if (err) {
                    console.error(`❌ Error eliminando sesión ${phoneNumber}:`, err.message);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Limpiar sesiones antiguas (más de 24 horas)
 */
function cleanupOldUserSessions() {
    return new Promise((resolve, reject) => {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 horas

        db.run(
            `DELETE FROM user_sessions WHERE last_activity < ?`,
            [cutoffTime],
            function(err) {
                if (err) {
                    console.error('❌ Error limpiando sesiones antiguas:', err.message);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log(`🗑️ Sesiones antiguas eliminadas: ${this.changes}`);
                    }
                    resolve(this.changes);
                }
            }
        );
    });
}

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
    getStatistics,
    saveConversationToDB,
    loadActiveConversationsFromDB,
    // Nuevas funciones para sesiones
    saveUserSession,
    loadUserSession,
    loadAllUserSessions,
    deleteUserSession,
    cleanupOldUserSessions
};
