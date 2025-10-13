# 🕐 Sistema de Inactividad - Bot WhatsApp Zona Repuestera

## 📋 Descripción General

El bot implementa un sistema de timeout por inactividad que reinicia automáticamente la sesión cuando un usuario no interactúa durante un período determinado.

## ⏱️ Configuración de Tiempos

### Timeouts Definidos

```javascript
const ADVISOR_TIMEOUT = 5 * 60 * 1000;      // 5 minutos
const INACTIVITY_TIMEOUT = 7 * 60 * 1000;   // 7 minutos
```

- **ADVISOR_TIMEOUT:** 5 minutos - Tiempo máximo de espera para respuesta del asesor
- **INACTIVITY_TIMEOUT:** 7 minutos - Tiempo de inactividad antes de reiniciar sesión

### Variables de Entorno

```env
INACTIVITY_TIMEOUT_MINUTES=7
```

## 🔄 Funcionamiento del Sistema

### 1. Seguimiento de Actividad

Cada sesión de usuario almacena un timestamp de última actividad:

```javascript
userSessions[userPhone] = {
  state: 'MAIN_MENU',
  cart: [],
  selectedCategory: null,
  selectedSubcategory: null,
  categoriesList: [],
  subcategoriesList: [],
  lastActivity: Date.now()  // Timestamp de última interacción
};
```

### 2. Actualización de Actividad

La función `updateLastActivity()` se llama cada vez que el usuario envía un mensaje:

```javascript
const updateLastActivity = (userPhone) => {
  if (userSessions[userPhone]) {
    userSessions[userPhone].lastActivity = Date.now();
  }
};
```

### 3. Verificación de Expiración

La función `isSessionExpired()` verifica si han pasado más de 7 minutos:

```javascript
const isSessionExpired = (userPhone) => {
  if (!userSessions[userPhone] || !userSessions[userPhone].lastActivity) {
    return false;
  }
  
  const timeSinceLastActivity = Date.now() - userSessions[userPhone].lastActivity;
  return timeSinceLastActivity > INACTIVITY_TIMEOUT;
};
```

### 4. Manejo de Sesión Expirada

En `handleMenuSelection()`, se verifica la expiración al inicio:

```javascript
// VERIFICAR SI LA SESIÓN EXPIRÓ POR INACTIVIDAD
if (isSessionExpired(userPhone)) {
  console.log(`🔄 Sesión expirada para ${userPhone}. Mostrando menú principal...`);
  // Limpiar modo asesor si estaba activo
  deactivateAdvisorMode(userPhone);
  // Mostrar menú de bienvenida
  await showMainMenu(userPhone);
  return;
}

// Actualizar timestamp de última actividad
updateLastActivity(userPhone);
```

## 📊 Flujo del Sistema

```
Usuario envía mensaje
        ↓
¿Existe sesión activa?
        ↓
   ¿Expiró? (>7 min)
    ↓         ↓
   SÍ        NO
    ↓         ↓
Reiniciar → Actualizar lastActivity
sesión         ↓
    ↓      Procesar mensaje
Mostrar        ↓
menú       Responder
principal
```

## ⚙️ Comportamiento Específico

### Cuando la Sesión Expira

1. ✅ Se limpia el modo asesor si estaba activo
2. ✅ Se reinicia completamente la sesión
3. ✅ Se muestra el menú principal de bienvenida
4. ✅ Se registra en logs la expiración

### Cuando Hay Actividad

1. ✅ Se actualiza el timestamp `lastActivity`
2. ✅ Se procesa normalmente el mensaje del usuario
3. ✅ El contador de inactividad se reinicia a 0

## 🔍 Casos de Uso

### Caso 1: Usuario Navegando Activamente

```
00:00 - Usuario inicia conversación
00:02 - Selecciona categoría → lastActivity actualizado
00:05 - Selecciona subcategoría → lastActivity actualizado
00:06 - Ve productos → lastActivity actualizado

✅ Sesión activa, sin expiración
```

### Caso 2: Usuario AFK (Away From Keyboard)

```
00:00 - Usuario selecciona categoría
00:02 - Usuario sale de WhatsApp (AFK)
00:09 - Usuario regresa y envía mensaje

❌ Sesión expirada (7 minutos transcurridos)
✅ Se muestra menú principal automáticamente
```

### Caso 3: Múltiples Interacciones Espaciadas

```
00:00 - Usuario navega catálogo
00:06 - Usuario envía mensaje (dentro de límite)
00:12 - Usuario envía mensaje (dentro de límite)
00:18 - Usuario envía mensaje (dentro de límite)

✅ Sesión se mantiene activa mientras haya interacción cada <7 min
```

## 🛠️ Integración con Modo Asesor

El sistema de inactividad también afecta el modo asesor:

```javascript
if (isSessionExpired(userPhone)) {
  deactivateAdvisorMode(userPhone);  // Limpia modo asesor
  await showMainMenu(userPhone);
  return;
}
```

Esto asegura que:
- Si un usuario estaba esperando respuesta de asesor
- Y pasan 7 minutos sin actividad
- El modo asesor se desactiva automáticamente
- El usuario ve el menú principal al regresar

## 📝 Logs del Sistema

El sistema genera logs informativos:

```
🔄 Sesión expirada para 573173745021. Mostrando menú principal...
```

Esto ayuda a:
- Monitorear comportamiento de usuarios
- Debuggear problemas de sesión
- Entender patrones de uso

## 🚨 Consideraciones Importantes

### Limitación de WhatsApp Business API

⚠️ **El bot NO puede enviar mensajes proactivos al usuario**

WhatsApp Business API requiere que:
1. El usuario inicie la conversación
2. Las respuestas se envíen dentro de la ventana de 24 horas
3. Los mensajes fuera de ventana requieren templates aprobados (costosos)

**Por esto:**
- ❌ No es posible enviar "advertencias previas" cuando el usuario está AFK
- ✅ Solo se puede notificar cuando el usuario envía un mensaje
- ✅ La verificación de expiración ocurre al recibir mensaje

**Ejemplo práctico:**
```
00:00 - Usuario navega
00:07 - Usuario está AFK (no envía mensaje)
     → Sesión está expirada internamente
00:10 - Usuario regresa y envía "hola"
     → Sistema detecta expiración
     → Reinicia sesión y muestra menú principal
```

### Arquitectura Sin Base de Datos

El sistema usa sesiones en memoria:

```javascript
const userSessions = {};
```

**Implicaciones:**
- ✅ Rápido y eficiente
- ✅ No requiere BD
- ❌ Las sesiones se pierden si el servidor se reinicia
- ❌ No hay persistencia entre reinicios

**Esto es intencional:** Las sesiones de chat son efímeras y no necesitan persistirse.

## 🔧 Configuración y Ajustes

### Cambiar Timeout de Inactividad

1. Modificar constante en `menuService.js`:
```javascript
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;  // 10 minutos
```

2. Actualizar `.env.example`:
```env
INACTIVITY_TIMEOUT_MINUTES=10
```

3. Actualizar documentación correspondiente

### Deshabilitar Sistema de Inactividad

❌ **NO RECOMENDADO** - Las sesiones se acumularían indefinidamente

Si fuera necesario:
```javascript
// En handleMenuSelection(), comentar verificación:
// if (isSessionExpired(userPhone)) { ... }
```

## 📊 Mejoras Futuras Potenciales

### Opción 1: Persistencia en Redis
- Mantener sesiones entre reinicios
- Escalabilidad horizontal
- TTL automático

### Opción 2: Timeouts Configurables por Usuario
- Usuarios frecuentes: timeout más largo
- Usuarios nuevos: timeout estándar

### Opción 3: Analytics de Inactividad
- Registrar patrones de abandono
- Optimizar timeout basado en datos
- Identificar puntos de fricción

---

## 📌 Resumen

| Aspecto | Valor |
|---------|-------|
| **Timeout de inactividad** | 7 minutos |
| **Timeout de asesor** | 5 minutos |
| **Verificación** | Al recibir mensaje |
| **Acción al expirar** | Reiniciar sesión → Menú principal |
| **Persistencia** | En memoria (no persiste) |
| **Logs** | Sí (console.log) |

---

**Última actualización:** 12 de octubre de 2025  
**Versión del sistema:** 1.0 (simplificado - sin advertencias)
