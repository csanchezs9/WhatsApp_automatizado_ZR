# 🚀 Guía Rápida: /finalizar con Menú Interactivo

## Para el Asesor:

### 📝 Cómo usar:

1. **Terminas de atender a un cliente**
2. **Escribes:** `/finalizar`
3. **El bot responde automáticamente según el caso:**

---

## 📊 3 Casos Posibles:

### **Caso 1: No hay clientes activos**
```
Tú → /finalizar

Bot → ⚠️ No hay conversaciones activas
      No se encontró ningún cliente...
```

---

### **Caso 2: Solo 1 cliente activo** ⚡
```
Tú → /finalizar

Bot → ✅ Conversación finalizada correctamente
      Cliente: +573001234567
      El bot ha sido reactivado...
```
**Nota:** Cierre automático, sin menú.

---

### **Caso 3: Múltiples clientes (2 o más)** 📋
```
Tú → /finalizar

Bot muestra menú:
┌─────────────────────────────────────┐
│ 🔚 Selecciona qué conversación      │
│    finalizar:                        │
│                                      │
│ 1. +573001234567                     │
│    ⏱️ Hace 5 min                     │
│    💬 "Necesito llantas rin 15"     │
│                                      │
│ 2. +573009876543                     │
│    ⏱️ Hace 12 min                    │
│    💬 "Precio de frenos..."          │
│                                      │
│  [Cliente 1 (5m)]  [Cliente 2 (12m)]│
└─────────────────────────────────────┘

Haces clic en el botón del cliente que quieres cerrar

Bot → ✅ Conversación finalizada correctamente
      Cliente: +573001234567
      El bot ha sido reactivado...
```

---

## 🎯 Información que muestra cada cliente:

- ✅ **Número de teléfono**
- ✅ **Tiempo de espera** (en minutos)
- ✅ **Consulta del cliente** (primeras palabras)

---

## ⚡ Ventajas:

- **100% preciso:** Nunca cierras la conversación equivocada
- **Visual:** Ves toda la información de los clientes
- **Rápido:** 1 cliente = cierre automático
- **Seguro:** Siempre confirma qué cliente cerraste

---

## 💡 Tip:

Si tienes muchos clientes activos (más de 3), verás una **lista desplegable** en lugar de botones:

```
┌─────────────────────────────────────┐
│ Ver conversaciones              [▼] │
└─────────────────────────────────────┘
```

Haz clic en "Ver conversaciones" y selecciona el cliente.

---

## ✅ ¡Eso es todo!

Comando simple: `/finalizar`  
El bot hace el resto. 🤖
