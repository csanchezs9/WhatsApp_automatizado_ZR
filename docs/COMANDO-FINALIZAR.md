# 🔚 Comando /finalizar - Asesor

## 📝 Descripción

El comando `/finalizar` permite al asesor cerrar conversaciones de forma rápida y automática. El sistema se adapta automáticamente según cuántos clientes estén activos.

---

## 🎯 ¿Cómo funciona?

### **Escenario 1: Sin clientes activos**
```
Asesor → /finalizar

Bot responde:
"⚠️ No hay conversaciones activas
No se encontró ningún cliente en conversación con asesor."
```

### **Escenario 2: Solo 1 cliente activo** ⚡
```
Asesor → /finalizar

Bot automáticamente:
✅ Cierra la conversación del único cliente
✅ Notifica al cliente
✅ Reactiva el menú del bot
✅ Confirma al asesor
```

### **Escenario 3: Múltiples clientes activos** 📋
```
Asesor → /finalizar

Bot muestra menú interactivo:
┌─────────────────────────────────────┐
│ 🔚 Selecciona qué conversación      │
│    finalizar:                        │
│                                      │
│ 1. +573001234567                     │
│    ⏱️ Hace 5 min                     │
│    💬 "Necesito llantas..."          │
│                                      │
│ 2. +573009876543                     │
│    ⏱️ Hace 12 min                    │
│    💬 "Precio de frenos..."          │
│                                      │
│ 3. +573005555555                     │
│    ⏱️ Hace 3 min                     │
│    💬 "Horarios de atención"         │
│                                      │
│  [Cliente 1]  [Cliente 2]  [Cliente 3] │
└─────────────────────────────────────┘

Asesor hace clic en el botón del cliente que desea cerrar
Bot cierra esa conversación específica ✅
```

---

## 💬 Mensajes que se envían

### **Al Cliente:**
```
✅ Conversación finalizada

El asesor ha finalizado la atención.

Gracias por contactarnos. Si necesitas más ayuda, aquí está el menú principal. 👇

[Menú principal del bot]
```

### **Al Asesor (confirmación):**
```
✅ Conversación finalizada correctamente

Cliente: +573001234567
El bot ha sido reactivado para este cliente.
```

---

## 🎨 Tipos de Menú

### **Hasta 3 clientes: Botones Interactivos**
WhatsApp muestra botones táctiles debajo del mensaje:
```
[Cliente 1 (5m)]  [Cliente 2 (12m)]  [Cliente 3 (3m)]
```

### **Más de 3 clientes: Lista Desplegable**
WhatsApp muestra una lista desplegable:
```
┌─────────────────────────────────────┐
│ Ver conversaciones              [▼] │
└─────────────────────────────────────┘
```
Al hacer clic:
```
Conversaciones activas
├─ +573001234567
│  Hace 5m: Necesito llantas...
├─ +573009876543
│  Hace 12m: Precio de frenos...
├─ +573005555555
│  Hace 3m: Horarios de atención
└─ +573007777777
   Hace 8m: Consulta de stock...
```

---

## ✅ Ventajas del nuevo sistema

1. **Inteligente:** Se adapta automáticamente al número de clientes
2. **Seguro:** No hay riesgo de cerrar la conversación equivocada
3. **Visual:** Ves todos los clientes activos con su información
4. **Rápido:** 1 cliente = cierre inmediato
5. **Fácil:** Solo haces clic en un botón

---

## 🔄 Flujo Completo de Ejemplo

### **Ejemplo con 1 cliente (Cierre Directo):**
```
10:00 - Cliente A: "2" (solicitar asesor)
10:01 - Cliente A: "Necesito llantas para mi carro"
10:02 - Bot notifica al asesor
10:05 - Asesor responde: "Hola, ¿qué modelo de carro tienes?"
10:06 - Cliente A: "Chevrolet Spark 2020"
10:10 - Asesor: "Excelente, te contactamos para coordinar entrega"
10:11 - Asesor: "/finalizar" ⬅️ COMANDO
10:11 - Bot → Cliente A: "✅ Conversación finalizada..."
10:11 - Bot → Asesor: "✅ Conversación finalizada correctamente..."
```

### **Ejemplo con múltiples clientes (Menú de Selección):**
```
10:00 - Cliente A solicita asesor
10:05 - Cliente B solicita asesor
10:10 - Cliente C solicita asesor
10:15 - Asesor termina de atender a Cliente B
10:16 - Asesor: "/finalizar" ⬅️ COMANDO

Bot muestra menú:
┌─────────────────────────────────────┐
│ 1. +57300123 (15m): "Llantas..."    │
│ 2. +57300456 (10m): "Frenos..."     │
│ 3. +57300789 (5m): "Horarios..."    │
│  [Cliente 1]  [Cliente 2]  [Cliente 3]│
└─────────────────────────────────────┘

10:17 - Asesor hace clic en [Cliente 2]
10:17 - Bot cierra conversación de Cliente B ✅
10:18 - Bot confirma al asesor
10:18 - Cliente A y C siguen activos
```

---

## 🎓 Mejores Prácticas

### ✅ **Cuándo usar /finalizar:**
- Terminaste de resolver todas las dudas del cliente
- El cliente confirmó su pedido o decisión
- La conversación llegó a su conclusión natural
- No hay más preguntas pendientes

### ❌ **Cuándo NO usar /finalizar:**
- El cliente todavía está haciendo preguntas
- Estás esperando información del cliente
- No estás seguro si el cliente quedó satisfecho
- El cliente dijo "déjame pensarlo" (esperar respuesta)

### 💡 **Recomendación:**
Antes de escribir `/finalizar`, siempre pregunta:
```
"¿Hay algo más en lo que pueda ayudarte?"
```

Si el cliente dice "No, gracias" o "Eso es todo", entonces escribe `/finalizar`.

---

## ⚠️ Consideraciones Importantes

### **¿El menú muestra información en tiempo real?**
Sí, cada vez que escribes `/finalizar`, el bot verifica qué clientes están activos EN ESE MOMENTO.

### **¿Qué pasa si un cliente se desconecta mientras veo el menú?**
Si seleccionas un cliente que ya no está activo, el bot te notifica:
```
❌ Error
Ese cliente ya no está en conversación activa.
```

### **¿Puedo cerrar múltiples conversaciones a la vez?**
No, debes cerrar una por una. Esto previene errores y asegura que cada cliente reciba su mensaje de cierre.

### **¿El cliente puede recontactar después?**
Sí, el cliente puede volver a escribir cuando quiera e iniciar una nueva conversación.

---

## 🔧 Detalles Técnicos

### **Archivos modificados:**
- `src/controllers/webhookController.js` - Detección del comando y respuestas interactivas
- `src/services/menuService.js` - Lógica del menú y cierre de conversaciones

### **Funciones principales:**
- `finalizeAdvisorConversation()` - Determina cuántos clientes hay y actúa en consecuencia
- `showClientSelectionMenu()` - Muestra menú interactivo (botones o lista)
- `closeClientConversation()` - Cierra la conversación específica

### **Flujo de estados:**
```
Estado inicial: WITH_ADVISOR
         ↓
Asesor escribe /finalizar
         ↓
Sistema verifica clientes activos
         ↓
   ┌─────┴─────┐
   │           │
0 clientes  1 cliente  >1 clientes
   │           │           │
Notifica   Cierra      Muestra
   │        directo       menú
   │           │           │
   │           ↓           ↓
   │      Cambia a    Asesor
   │     MAIN_MENU   selecciona
   │                      │
   └──────────────────────┘
               ↓
       Estado: MAIN_MENU
```

---

## 📊 Comparación con Versión Anterior

| Aspecto | Versión Anterior | Versión Nueva |
|---------|-----------------|---------------|
| **Selección** | Automática (último cliente) | Manual (asesor elige) |
| **Seguridad** | ⚠️ Podía cerrar cliente equivocado | ✅ 100% preciso |
| **Usabilidad** | Confuso con múltiples clientes | Visual y claro |
| **1 cliente** | Requiere comando | Cierre automático |
| **Múltiples** | Cierra el más reciente | Menú interactivo |

---

## 🆘 Problemas Comunes

### **Problema: "Escribí /finalizar pero no veo el menú"**
**Solución:** 
- Verifica que hayas escrito exactamente `/finalizar` (con barra al inicio)
- Asegúrate de que hay clientes activos (el bot te notificará si no hay ninguno)
- Si solo hay 1 cliente, el bot lo cierra automáticamente (no muestra menú)

### **Problema: "Seleccioné un cliente pero dice que ya no está activo"**
**Solución:**
- El cliente pudo haber escrito "menú" y salirse solo
- Pudo haber pasado el timeout de 24 horas
- Escribe `/finalizar` de nuevo para ver la lista actualizada

### **Problema: "No veo los botones, solo texto"**
**Solución:**
- Asegúrate de estar usando WhatsApp Business actualizado
- Los botones interactivos requieren WhatsApp Business API configurado
- Si tienes más de 3 clientes, verás una lista desplegable en lugar de botones

### **Problema: "Quiero cerrar todos los clientes a la vez"**
**Solución:**
- Por seguridad, el sistema requiere cerrar uno por uno
- Escribe `/finalizar`, selecciona un cliente
- Repite el proceso para cada cliente que desees cerrar

---

## 📱 Capturas de Pantalla (Ejemplo Visual)

### **Botones (1-3 clientes):**
```
┌────────────────────────────────────────┐
│ 🔚 Selecciona qué conversación         │
│    finalizar:                           │
│                                         │
│ 1. +573001234567                        │
│    ⏱️ Hace 5 min                        │
│    💬 "Necesito llantas rin 15"        │
│                                         │
│ 2. +573009876543                        │
│    ⏱️ Hace 12 min                       │
│    💬 "Precio de frenos para..."       │
│                                         │
├─────────────────────────────────────────┤
│  [Cliente 1 (5m)]  [Cliente 2 (12m)]   │
└─────────────────────────────────────────┘
```

### **Lista (4+ clientes):**
```
┌────────────────────────────────────────┐
│ 🔚 Tienes 5 conversaciones activas     │
│                                         │
│ Selecciona cuál deseas finalizar:      │
│                                         │
├─────────────────────────────────────────┤
│     Ver conversaciones              [▼]│
└─────────────────────────────────────────┘
        ↓ (al hacer clic)
┌────────────────────────────────────────┐
│ Conversaciones activas                 │
├────────────────────────────────────────┤
│ ○ +573001234567                        │
│   Hace 5m: Necesito llantas rin 15     │
├────────────────────────────────────────┤
│ ○ +573009876543                        │
│   Hace 12m: Precio de frenos para...   │
├────────────────────────────────────────┤
│ ○ +573005555555                        │
│   Hace 3m: Horarios de atención        │
├────────────────────────────────────────┤
│ ○ +573007777777                        │
│   Hace 8m: Consulta de stock           │
├────────────────────────────────────────┤
│ ○ +573002222222                        │
│   Hace 15m: Necesito repuesto para...  │
└────────────────────────────────────────┘
```

---

## ✨ Ventajas del Nuevo Sistema

| Característica | Beneficio |
|----------------|-----------|
| **Adaptativo** | Se ajusta automáticamente al número de clientes |
| **Seguro** | Imposible cerrar la conversación equivocada |
| **Informativo** | Ves tiempo de espera y consulta de cada cliente |
| **Rápido** | 1 cliente = sin menú, cierre directo |
| **Visual** | Botones táctiles fáciles de usar |
| **Escalable** | Funciona con 1 o 100 clientes |

---

## 🎯 Resumen Rápido

```
/finalizar → 
    ↓
¿Cuántos clientes?
    ↓
  ┌─────┴─────┐
  │     │     │
  0     1    2+
  │     │     │
 Aviso Cierra Menú
       auto   elige
```

**Recuerda:** Este comando es solo para el asesor. Los clientes finalizan escribiendo "menú".

---

**Solución:**
- Asegúrate de escribir exactamente `/finalizar` (sin espacios extras)
- Verifica que escribiste desde el número de asesor configurado
- Revisa que haya un cliente activo en conversación

### **Problema:** "Se cerró la conversación del cliente equivocado"

**Solución:**
Actualmente el bot cierra la conversación del último cliente que solicitó asesor. Si tienes múltiples clientes simultáneos, este es el comportamiento esperado. Para más control, puedes pedirle al cliente específico que escriba "menú".

---

**Última actualización:** 12 de octubre de 2025  
**Versión:** 1.0
