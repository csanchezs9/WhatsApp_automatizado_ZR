/**
 * Servicio de Cola de Mensajes para WhatsApp Business API
 *
 * Gestiona el envío de mensajes cuando se acerca al límite de rate (70-90%)
 * Persiste mensajes en BD y los reintenta automáticamente
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const rateLimitMonitor = require('./rateLimitMonitor');

// Ruta de base de datos
const DB_PATH = process.env.NODE_ENV === 'production'
    ? '/opt/render/project/src/data/persistent/conversations.db'
    : path.join(__dirname, '../data/persistent/conversations.db');

// Asegurar que el directorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Conectar a base de datos
const db = new sqlite3.Database(DB_PATH);

// Crear tabla de cola si no existe
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS message_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            to_number TEXT NOT NULL,
            message_type TEXT NOT NULL,
            message_data TEXT NOT NULL,
            priority INTEGER DEFAULT 5,
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            scheduled_at DATETIME,
            processed_at DATETIME
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creando tabla message_queue:', err.message);
        } else {
            console.log('✅ Tabla de cola de mensajes inicializada');
        }
    });

    // Crear índices para optimizar consultas
    db.run(`CREATE INDEX IF NOT EXISTS idx_status ON message_queue(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled ON message_queue(scheduled_at)`);
});

class MessageQueueService {
    constructor() {
        this.isProcessing = false;
        this.processingInterval = null;

        // Iniciar procesamiento automático cada 10 segundos
        this.startAutoProcessing();
    }

    /**
     * Agregar mensaje a la cola
     * @param {string} to - Número de teléfono
     * @param {string} messageType - Tipo: 'text', 'buttons', 'list', 'image', 'document', 'audio'
     * @param {object} messageData - Datos del mensaje
     * @param {number} priority - Prioridad (1=alta, 10=baja)
     * @returns {Promise<number>} ID del mensaje en cola
     */
    async enqueue(to, messageType, messageData, priority = 5) {
        return new Promise((resolve, reject) => {
            const dataJson = JSON.stringify(messageData);

            // Calcular cuándo intentar enviar (si estamos al límite, esperar)
            const usage = rateLimitMonitor.getUsagePercentage();
            let scheduledAt = new Date();

            if (usage >= 90) {
                // Si estamos al 90%, esperar 5 minutos
                scheduledAt = new Date(Date.now() + 5 * 60000);
                console.log(`📊 Cola: Uso al ${usage.toFixed(1)}% - Mensaje programado para ${scheduledAt.toLocaleTimeString()}`);
            } else if (usage >= 70) {
                // Si estamos al 70%, esperar 1 minuto
                scheduledAt = new Date(Date.now() + 60000);
                console.log(`📊 Cola: Uso al ${usage.toFixed(1)}% - Mensaje programado para ${scheduledAt.toLocaleTimeString()}`);
            }

            const sql = `
                INSERT INTO message_queue (to_number, message_type, message_data, priority, scheduled_at)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.run(sql, [to, messageType, dataJson, priority, scheduledAt.toISOString()], function(err) {
                if (err) {
                    console.error('❌ Error encolando mensaje:', err.message);
                    reject(err);
                } else {
                    console.log(`✅ Mensaje encolado: ID=${this.lastID}, tipo=${messageType}, destino=${to}`);
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Procesar mensajes pendientes en la cola
     */
    async processQueue() {
        if (this.isProcessing) {
            return; // Ya hay un proceso ejecutándose
        }

        this.isProcessing = true;

        try {
            // Verificar uso actual
            const stats = rateLimitMonitor.getStats();
            const usage = stats.usagePercentage;

            // Solo procesar si estamos por debajo del 85%
            if (usage >= 85) {
                console.log(`⏸️ Cola pausada: Uso al ${usage}% - Esperando a que baje del 85%`);
                this.isProcessing = false;
                return;
            }

            // Obtener mensajes listos para enviar
            const messages = await this.getPendingMessages(10); // Máximo 10 por vez

            if (messages.length === 0) {
                this.isProcessing = false;
                return;
            }

            console.log(`📤 Procesando ${messages.length} mensajes de la cola...`);

            // Procesar cada mensaje
            for (const msg of messages) {
                try {
                    // Marcar como procesando
                    await this.updateStatus(msg.id, 'processing');

                    // Enviar mensaje
                    const success = await this.sendQueuedMessage(msg);

                    if (success) {
                        // Marcar como enviado
                        await this.updateStatus(msg.id, 'sent', null, new Date());
                        console.log(`✅ Mensaje ${msg.id} enviado exitosamente`);
                    } else {
                        // Incrementar intentos
                        await this.incrementAttempts(msg.id);

                        if (msg.attempts + 1 >= msg.max_attempts) {
                            await this.updateStatus(msg.id, 'failed', 'Máximo de intentos alcanzado');
                            console.error(`❌ Mensaje ${msg.id} falló después de ${msg.max_attempts} intentos`);
                        } else {
                            await this.updateStatus(msg.id, 'pending');
                            console.log(`⚠️ Mensaje ${msg.id} reintentará (intento ${msg.attempts + 1}/${msg.max_attempts})`);
                        }
                    }

                    // Pequeña pausa entre mensajes para no saturar
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`❌ Error procesando mensaje ${msg.id}:`, error);
                    await this.updateStatus(msg.id, 'pending', error.message);
                }
            }

        } catch (error) {
            console.error('❌ Error en processQueue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Obtener mensajes pendientes
     */
    async getPendingMessages(limit = 10) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            const sql = `
                SELECT * FROM message_queue
                WHERE status = 'pending'
                AND scheduled_at <= ?
                ORDER BY priority ASC, created_at ASC
                LIMIT ?
            `;

            db.all(sql, [now, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Parsear message_data de JSON
                    const messages = rows.map(row => ({
                        ...row,
                        message_data: JSON.parse(row.message_data)
                    }));
                    resolve(messages);
                }
            });
        });
    }

    /**
     * Enviar mensaje desde la cola
     */
    async sendQueuedMessage(msg) {
        try {
            // Importar dinámicamente para evitar dependencias circulares
            const whatsappService = require('./whatsappService');
            const { to_number, message_type, message_data } = msg;

            switch (message_type) {
                case 'text':
                    await whatsappService.sendRawTextMessage(to_number, message_data.text);
                    break;

                case 'buttons':
                    await whatsappService.sendRawInteractiveButtons(
                        to_number,
                        message_data.bodyText,
                        message_data.buttons
                    );
                    break;

                case 'list':
                    await whatsappService.sendInteractiveList(
                        to_number,
                        message_data.bodyText,
                        message_data.buttonText,
                        message_data.sections
                    );
                    break;

                case 'image':
                    await whatsappService.sendImage(
                        to_number,
                        message_data.mediaId,
                        message_data.caption
                    );
                    break;

                case 'document':
                    await whatsappService.sendDocument(
                        to_number,
                        message_data.mediaId,
                        message_data.filename,
                        message_data.caption
                    );
                    break;

                case 'audio':
                    await whatsappService.sendAudio(
                        to_number,
                        message_data.mediaId
                    );
                    break;

                default:
                    throw new Error(`Tipo de mensaje no soportado: ${message_type}`);
            }

            return true;
        } catch (error) {
            console.error(`❌ Error enviando mensaje ${msg.id}:`, error);
            return false;
        }
    }

    /**
     * Actualizar estado de mensaje
     */
    async updateStatus(id, status, errorMessage = null, processedAt = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE message_queue
                SET status = ?, error_message = ?, processed_at = ?
                WHERE id = ?
            `;

            db.run(sql, [status, errorMessage, processedAt?.toISOString(), id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Incrementar contador de intentos
     */
    async incrementAttempts(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE message_queue SET attempts = attempts + 1 WHERE id = ?`;
            db.run(sql, [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Iniciar procesamiento automático
     */
    startAutoProcessing() {
        // Procesar cada 10 segundos
        this.processingInterval = setInterval(() => {
            this.processQueue().catch(err => {
                console.error('❌ Error en procesamiento automático de cola:', err);
            });
        }, 10000);

        console.log('✅ Procesamiento automático de cola iniciado (cada 10s)');
    }

    /**
     * Detener procesamiento automático
     */
    stopAutoProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('⏹️ Procesamiento automático de cola detenido');
        }
    }

    /**
     * Obtener estadísticas de la cola
     */
    async getQueueStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    status,
                    COUNT(*) as count
                FROM message_queue
                GROUP BY status
            `;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        pending: 0,
                        processing: 0,
                        sent: 0,
                        failed: 0
                    };

                    rows.forEach(row => {
                        stats[row.status] = row.count;
                    });

                    resolve(stats);
                }
            });
        });
    }

    /**
     * Limpiar mensajes antiguos (más de 7 días)
     */
    async cleanupOldMessages() {
        return new Promise((resolve, reject) => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const sql = `
                DELETE FROM message_queue
                WHERE status IN ('sent', 'failed')
                AND processed_at < ?
            `;

            db.run(sql, [sevenDaysAgo], function(err) {
                if (err) {
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log(`🧹 Limpieza: ${this.changes} mensajes antiguos eliminados de la cola`);
                    }
                    resolve(this.changes);
                }
            });
        });
    }
}

// Singleton instance
const messageQueueService = new MessageQueueService();

// Limpieza automática cada 24 horas
setInterval(() => {
    messageQueueService.cleanupOldMessages().catch(err => {
        console.error('❌ Error en limpieza automática de cola:', err);
    });
}, 24 * 60 * 60 * 1000);

module.exports = messageQueueService;
