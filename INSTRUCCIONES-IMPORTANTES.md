# ⚠️ INSTRUCCIONES IMPORTANTES - BOT DE WHATSAPP

## 🚫 REGLA PRINCIPAL: NO MODIFICAR EL E-COMMERCE

**NUNCA, BAJO NINGUNA CIRCUNSTANCIA, modificar el código del e-commerce Django (`vehicles_parts_store-main/`)**

### Razones:
1. El e-commerce está en producción en https://zonarepuestera.com.co
2. Cualquier cambio puede afectar a clientes reales
3. El bot debe **adaptarse al e-commerce**, NO al revés

---

## 📋 Comportamiento del E-commerce (NO CAMBIAR)

### Endpoint de Subcategorías
**URL:** `/api/v1/catalog/sub-categorias/?category={id}`

**Filtros aplicados por el backend (DEJAR ASÍ):**
- Solo muestra subcategorías con productos que tengan:
  - `base_price > 0`
  - `stock > 0`

**Ejemplo:**
- Categoría "Llantas" tiene 5 subcategorías en la BD:
  - Rin 13 ✅ (tiene productos con stock)
  - Rin 14 ❌ (sin productos con stock)
  - Rin 15 ❌ (sin productos con stock)
  - Rin 16 ❌ (sin productos con stock)
  - Rin 17 ❌ (sin productos con stock)

**Resultado de la API:** Solo devuelve Rin 13

---

## ✅ Solución para el Bot

**El bot debe adaptarse a lo que devuelve la API:**

1. Si la API solo devuelve 1 subcategoría → Mostrar esa 1
2. Si la API devuelve 5 subcategorías → Mostrar las 5
3. **No intentar obtener más datos de los que la API proporciona**
4. **No modificar endpoints del e-commerce**

---

## 📝 Modificaciones Permitidas

### ✅ Sí se puede modificar:
- Archivos en `/wpp/` (código del bot de WhatsApp)
- Lógica de navegación del bot
- Mensajes y textos del bot
- Manejo de sesiones
- Timeout e inactividad

### ❌ NO se puede modificar:
- Archivos en `/vehicles_parts_store-main/` (e-commerce Django)
- Views, models, serializers del e-commerce
- Endpoints de la API
- Filtros de productos o categorías
- Base de datos del e-commerce

---

## 🎯 Principio de Diseño

> **"El bot se adapta al e-commerce, nunca al revés"**

Si el e-commerce muestra solo 1 subcategoría, es porque esa es la única con productos disponibles.
El bot debe mostrar exactamente lo que la API devuelve.

---

## 📞 Contactos Configurados

- **Usuario de prueba:** +57 317 374 5021
- **Asesor:** +57 316 4088588
- **Número de prueba WhatsApp:** +1 555 166 6254

---

## 🔧 Timeouts Configurados

- **ADVISOR_CONVERSATION_TIMEOUT:** 24 horas (cierre automático de conversación con asesor)
- **INACTIVITY_TIMEOUT:** 7 minutos (auto-reset de sesión por inactividad solo cuando navega con el bot)

**Importante sobre conversaciones con asesor:**
- Cuando un usuario inicia conversación con asesor, tiene **24 horas** de ventana
- Después de 24 horas, la conversación se cierra automáticamente (mecanismo de seguridad)
- El cliente puede volver a contactar cuando quiera iniciando una nueva conversación

**Formas de finalizar conversación con asesor:**
1. ⭐ **Asesor escribe `/finalizar`** (recomendado) - Cierra automáticamente
2. Cliente escribe "menú", "menu" o "inicio"
3. Timeout de 24 horas (si asesor olvida finalizar)

**Timeout de inactividad (7 minutos):**
- Solo aplica cuando el usuario navega con el bot (sin asesor)
- NO aplica durante conversaciones con asesor
- Cuando el usuario supera 7 minutos de inactividad navegando solo, su sesión se reinicia

---

_Última actualización: 12 de octubre de 2025_
