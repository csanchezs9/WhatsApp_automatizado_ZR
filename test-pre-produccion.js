/**
 * SCRIPT DE PRUEBAS PRE-PRODUCCIÓN
 *
 * Este script verifica funcionalidad crítica antes de deploy
 *
 * USO:
 *   node test-pre-produccion.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(type, message) {
    const timestamp = new Date().toISOString();
    switch (type) {
        case 'success':
            console.log(`${colors.green}✅ [${timestamp}] ${message}${colors.reset}`);
            break;
        case 'error':
            console.log(`${colors.red}❌ [${timestamp}] ${message}${colors.reset}`);
            break;
        case 'warning':
            console.log(`${colors.yellow}⚠️  [${timestamp}] ${message}${colors.reset}`);
            break;
        case 'info':
            console.log(`${colors.blue}ℹ️  [${timestamp}] ${message}${colors.reset}`);
            break;
        default:
            console.log(`[${timestamp}] ${message}`);
    }
}

// ===========================================
// PRUEBA 1: Verificar variables de entorno
// ===========================================
function testEnvironmentVariables() {
    log('info', '--- PRUEBA 1: Variables de Entorno ---');

    const requiredVars = [
        'WHATSAPP_TOKEN',
        'PHONE_NUMBER_ID',
        'WEBHOOK_VERIFY_TOKEN',
        'ECOMMERCE_API_URL',
        'ADVISOR_PHONE_NUMBER',
        'PORT'
    ];

    const optionalVars = [
        'PANEL_USERNAME',
        'PANEL_PASSWORD',
        'NODE_ENV',
        'INACTIVITY_TIMEOUT_MINUTES'
    ];

    let missingRequired = [];
    let missingOptional = [];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingRequired.push(varName);
            log('error', `Variable requerida faltante: ${varName}`);
        } else {
            const value = varName.includes('TOKEN') || varName.includes('PASSWORD')
                ? '***'
                : process.env[varName];
            log('success', `${varName}: ${value}`);
        }
    });

    optionalVars.forEach(varName => {
        if (!process.env[varName]) {
            missingOptional.push(varName);
            log('warning', `Variable opcional no configurada: ${varName} (se usará valor por defecto)`);
        } else {
            const value = varName.includes('PASSWORD')
                ? '***'
                : process.env[varName];
            log('success', `${varName}: ${value}`);
        }
    });

    if (missingRequired.length > 0) {
        log('error', `Faltan ${missingRequired.length} variables REQUERIDAS`);
        return false;
    }

    log('success', 'Todas las variables requeridas están configuradas');
    return true;
}

// ===========================================
// PRUEBA 2: Verificar credenciales del panel
// ===========================================
function testPanelCredentials() {
    log('info', '--- PRUEBA 2: Credenciales del Panel ---');

    const username = process.env.PANEL_USERNAME || 'admin';
    const password = process.env.PANEL_PASSWORD || 'zonarepuestera2025';

    if (username === 'admin' && password === 'zonarepuestera2025') {
        log('warning', 'USANDO CREDENCIALES POR DEFECTO - CAMBIAR EN PRODUCCIÓN');
        log('warning', `Username: ${username}`);
        log('warning', 'Password: *********** (por defecto)');
        return false;
    }

    log('success', `Credenciales personalizadas configuradas (Usuario: ${username})`);
    return true;
}

// ===========================================
// PRUEBA 3: Verificar estructura de directorios
// ===========================================
function testDirectoryStructure() {
    log('info', '--- PRUEBA 3: Estructura de Directorios ---');

    const requiredDirs = [
        'src/data/persistent',
        'src/data/persistent/media',
        'src/public'
    ];

    let allExist = true;

    requiredDirs.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            log('success', `Directorio existe: ${dir}`);

            // Contar archivos en media
            if (dir.includes('media')) {
                const files = fs.readdirSync(fullPath);
                log('info', `  └─ Archivos multimedia: ${files.length}`);
            }
        } else {
            log('error', `Directorio faltante: ${dir}`);
            allExist = false;
        }
    });

    return allExist;
}

// ===========================================
// PRUEBA 4: Verificar base de datos
// ===========================================
function testDatabase() {
    log('info', '--- PRUEBA 4: Base de Datos ---');

    const dbPath = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/src/data/persistent/conversations.db'
        : path.join(__dirname, 'src/data/persistent/conversations.db');

    if (!fs.existsSync(dbPath)) {
        log('warning', 'Base de datos no existe (se creará al iniciar)');
        return true; // No es error, se crea automáticamente
    }

    const stats = fs.statSync(dbPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    log('success', `Base de datos existe: ${dbPath}`);
    log('info', `  └─ Tamaño: ${sizeKB} KB (${sizeMB} MB)`);

    // Alertar si es muy grande
    if (stats.size > 50 * 1024 * 1024) { // 50MB
        log('warning', 'Base de datos muy grande (>50MB) - considerar limpieza');
    }

    return true;
}

// ===========================================
// PRUEBA 5: Verificar archivo de promociones
// ===========================================
function testPromotionsFile() {
    log('info', '--- PRUEBA 5: Archivo de Promociones ---');

    const promoPath = process.env.NODE_ENV === 'production'
        ? '/opt/render/project/src/data/persistent/promoMessage.json'
        : path.join(__dirname, 'src/data/persistent/promoMessage.json');

    if (!fs.existsSync(promoPath)) {
        log('warning', 'Archivo de promociones no existe (se creará con mensaje por defecto)');
        return true;
    }

    try {
        const promoData = JSON.parse(fs.readFileSync(promoPath, 'utf8'));
        log('success', 'Archivo de promociones existe');
        log('info', `  └─ Última actualización: ${promoData.lastUpdated || 'N/A'}`);
        log('info', `  └─ Actualizado por: ${promoData.updatedBy || 'N/A'}`);
        log('info', `  └─ Longitud del mensaje: ${promoData.message?.length || 0} caracteres`);

        if (promoData.message && promoData.message.length > 4000) {
            log('warning', 'Mensaje de promoción muy largo (>4000 caracteres)');
        }

        return true;
    } catch (error) {
        log('error', `Error leyendo archivo de promociones: ${error.message}`);
        return false;
    }
}

// ===========================================
// PRUEBA 6: Verificar conexión a API de e-commerce
// ===========================================
async function testEcommerceAPI() {
    log('info', '--- PRUEBA 6: Conexión a API de E-commerce ---');

    const apiUrl = process.env.ECOMMERCE_API_URL;
    if (!apiUrl) {
        log('error', 'ECOMMERCE_API_URL no configurado');
        return false;
    }

    try {
        log('info', `Probando conexión a: ${apiUrl}/catalog/categorias/`);
        const response = await axios.get(`${apiUrl}/catalog/categorias/`, {
            timeout: 5000
        });

        if (response.status === 200) {
            log('success', 'Conexión exitosa a API de e-commerce');
            log('info', `  └─ Categorías disponibles: ${response.data?.length || 0}`);
            return true;
        } else {
            log('warning', `Respuesta inesperada: ${response.status}`);
            return false;
        }
    } catch (error) {
        log('error', `Error conectando a API: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            log('error', '  └─ No se puede conectar (servidor no responde)');
        }
        return false;
    }
}

// ===========================================
// PRUEBA 7: Verificar uso de disco
// ===========================================
function testDiskUsage() {
    log('info', '--- PRUEBA 7: Uso de Disco ---');

    const persistentPath = path.join(__dirname, 'src/data/persistent');

    function getDirectorySize(dirPath) {
        let totalSize = 0;

        try {
            const files = fs.readdirSync(dirPath);

            files.forEach(file => {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    totalSize += getDirectorySize(filePath);
                } else {
                    totalSize += stats.size;
                }
            });
        } catch (error) {
            log('warning', `Error calculando tamaño: ${error.message}`);
        }

        return totalSize;
    }

    const totalBytes = getDirectorySize(persistentPath);
    const totalKB = (totalBytes / 1024).toFixed(2);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    log('info', `Tamaño total de datos persistentes:`);
    log('info', `  └─ ${totalBytes} bytes`);
    log('info', `  └─ ${totalKB} KB`);
    log('info', `  └─ ${totalMB} MB`);
    log('info', `  └─ ${totalGB} GB`);

    // Alerta si está cerca del límite (1GB en Render)
    const limitGB = 1;
    const usagePercent = (totalGB / limitGB) * 100;

    if (totalGB > 0.8) {
        log('error', `USO CRÍTICO: ${usagePercent.toFixed(1)}% del límite de 1GB`);
        return false;
    } else if (totalGB > 0.5) {
        log('warning', `Uso moderado: ${usagePercent.toFixed(1)}% del límite de 1GB`);
    } else {
        log('success', `Uso bajo: ${usagePercent.toFixed(1)}% del límite de 1GB`);
    }

    return true;
}

// ===========================================
// PRUEBA 8: Verificar retención de datos
// ===========================================
function testDataRetention() {
    log('info', '--- PRUEBA 8: Retención de Datos ---');

    const conversationServicePath = path.join(__dirname, 'src/services/conversationService.js');
    const claudeMdPath = path.join(__dirname, 'CLAUDE.md');

    try {
        const conversationCode = fs.readFileSync(conversationServicePath, 'utf8');
        const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');

        // Buscar retención en código
        const codeMatch = conversationCode.match(/datetime\('now',\s*'-(\\d+)\s*days?'\)/i);
        const codeRetention = codeMatch ? parseInt(codeMatch[1]) : null;

        // Buscar retención en documentación
        const docMatch = claudeMd.match(/(\\d+)[-\\s]day/i);
        const docRetention = docMatch ? parseInt(docMatch[1]) : null;

        log('info', `Retención en código: ${codeRetention || 'NO ENCONTRADO'} días`);
        log('info', `Retención en documentación: ${docRetention || 'NO ENCONTRADO'} días`);

        if (!codeRetention) {
            log('error', 'No se pudo determinar retención en código');
            return false;
        }

        if (codeRetention !== docRetention) {
            log('warning', `INCONSISTENCIA: Código dice ${codeRetention} días, documentación dice ${docRetention} días`);
            return false;
        }

        log('success', `Retención consistente: ${codeRetention} días`);
        return true;

    } catch (error) {
        log('error', `Error verificando retención: ${error.message}`);
        return false;
    }
}

// ===========================================
// EJECUTAR TODAS LAS PRUEBAS
// ===========================================
async function runAllTests() {
    console.log('\n');
    log('info', '========================================');
    log('info', '  PRUEBAS PRE-PRODUCCIÓN');
    log('info', '  WhatsApp Bot - Zona Repuestera');
    log('info', '========================================');
    console.log('\n');

    const results = {
        environment: testEnvironmentVariables(),
        credentials: testPanelCredentials(),
        directories: testDirectoryStructure(),
        database: testDatabase(),
        promotions: testPromotionsFile(),
        ecommerce: await testEcommerceAPI(),
        disk: testDiskUsage(),
        retention: testDataRetention()
    };

    console.log('\n');
    log('info', '========================================');
    log('info', '  RESUMEN DE RESULTADOS');
    log('info', '========================================');
    console.log('\n');

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    Object.entries(results).forEach(([test, result]) => {
        const testName = test.charAt(0).toUpperCase() + test.slice(1);
        if (result === true) {
            log('success', `${testName}: PASÓ`);
            passed++;
        } else {
            log('error', `${testName}: FALLÓ`);
            failed++;
        }
    });

    console.log('\n');
    log('info', `Total: ${passed} pasaron, ${failed} fallaron`);
    console.log('\n');

    if (failed === 0) {
        log('success', '🎉 TODAS LAS PRUEBAS PASARON - Listo para producción!');
    } else {
        log('error', '❌ HAY PROBLEMAS QUE DEBEN RESOLVERSE');
        log('info', 'Revisa el archivo AUDITORIA-PRE-PRODUCCION.md para más detalles');
    }

    console.log('\n');

    process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar pruebas
require('dotenv').config();
runAllTests().catch(error => {
    log('error', `Error ejecutando pruebas: ${error.message}`);
    process.exit(1);
});
