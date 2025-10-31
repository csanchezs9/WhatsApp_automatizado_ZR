/**
 * Servicio de Respuestas Rápidas
 *
 * Gestiona respuestas predefinidas que el asesor puede usar para responder rápidamente.
 * Cada respuesta tiene un título y un contenido.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

// Crear tabla de respuestas rápidas
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS quick_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL UNIQUE,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Error creando tabla quick_responses:', err.message);
        } else {
            console.log('✅ Tabla de respuestas rápidas inicializada');
        }
    });
});

class QuickResponseService {
    /**
     * Crear una nueva respuesta rápida
     * @param {string} title - Título de la respuesta (ej: "Despedida", "Saludo")
     * @param {string} content - Contenido del mensaje
     * @returns {Promise<object>}
     */
    async createQuickResponse(title, content) {
        // Validar longitud del contenido
        if (content.length > 500) {
            return Promise.reject(new Error('El contenido no puede superar los 500 caracteres'));
        }

        // Verificar límite de 20 respuestas
        const allResponses = await this.getAllQuickResponses();
        if (allResponses.length >= 20) {
            return Promise.reject(new Error('Has alcanzado el límite máximo de 20 respuestas rápidas. Elimina alguna para crear una nueva.'));
        }

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO quick_responses (title, content) VALUES (?, ?)`;

            db.run(sql, [title, content], function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        reject(new Error(`Ya existe una respuesta rápida con el título "${title}"`));
                    } else {
                        reject(err);
                    }
                } else {
                    console.log(`✅ Respuesta rápida creada: "${title}"`);
                    resolve({
                        id: this.lastID,
                        title,
                        content,
                        created_at: new Date().toISOString()
                    });
                }
            });
        });
    }

    /**
     * Obtener todas las respuestas rápidas
     * @returns {Promise<Array>}
     */
    async getAllQuickResponses() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM quick_responses ORDER BY title ASC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Obtener una respuesta rápida por ID
     * @param {number} id
     * @returns {Promise<object|null>}
     */
    async getQuickResponseById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM quick_responses WHERE id = ?`;

            db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Actualizar una respuesta rápida
     * @param {number} id
     * @param {string} title
     * @param {string} content
     * @returns {Promise<object>}
     */
    async updateQuickResponse(id, title, content) {
        // Validar longitud del contenido
        if (content.length > 500) {
            return Promise.reject(new Error('El contenido no puede superar los 500 caracteres'));
        }

        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE quick_responses
                SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(sql, [title, content, id], function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        reject(new Error(`Ya existe una respuesta rápida con el título "${title}"`));
                    } else {
                        reject(err);
                    }
                } else if (this.changes === 0) {
                    reject(new Error('Respuesta rápida no encontrada'));
                } else {
                    console.log(`✅ Respuesta rápida actualizada: "${title}"`);
                    resolve({ id, title, content });
                }
            });
        });
    }

    /**
     * Eliminar una respuesta rápida
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteQuickResponse(id) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM quick_responses WHERE id = ?`;

            db.run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    reject(new Error('Respuesta rápida no encontrada'));
                } else {
                    console.log(`✅ Respuesta rápida eliminada: ID=${id}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Buscar respuestas rápidas por título
     * @param {string} searchTerm
     * @returns {Promise<Array>}
     */
    async searchQuickResponses(searchTerm) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM quick_responses
                WHERE title LIKE ? OR content LIKE ?
                ORDER BY title ASC
            `;
            const term = `%${searchTerm}%`;

            db.all(sql, [term, term], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

// Singleton instance
const quickResponseService = new QuickResponseService();

module.exports = quickResponseService;
