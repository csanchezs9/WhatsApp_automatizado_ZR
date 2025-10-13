# 👨‍💼 Flujo de Atención con Asesor - Bot WhatsApp

## 📋 Descripción General

El sistema de atención con asesor permite que un cliente sea atendido por un humano cuando necesita ayuda personalizada. Las conversaciones tienen una **ventana de 24 horas** desde el inicio.

## ⏱️ Timeout de 24 Horas

**Regla principal:**
- ✅ Conversación inicia cuando el cliente solicita asesor
- ✅ Tiene **24 horas** de ventana para completar la atención
- ✅ Después de 24 horas, se cierra **automáticamente**
- ✅ Cliente puede volver a contactar cuando quiera (nueva conversación)

## 🔄 Flujo Completo

### **Paso 1: Cliente Solicita Asesor**

```
Cliente → Bot: "2" (Hablar con asesor)
Bot → Cliente: "📝 Cuéntanos tu consulta"
```

### **Paso 2: Cliente Escribe su Consulta**

```
Cliente → Bot: "Necesito llantas rin 15 para Chevrolet Spark"
Bot → Cliente: 
  "✅ Solicitud enviada al asesor
   Hemos recibido tu consulta: 'Necesito llantas...'
   ⏱️ Un asesor se contactará contigo pronto.
   Estate pendiente de la respuesta."
```

### **Paso 3: Asesor Recibe Notificación**

```
Bot → Asesor:
  "🔔 NUEVA SOLICITUD DE ATENCIÓN
   📱 Cliente: +573173745021
   ⏰ Hora: 12/10/2025, 9:30:00 PM
   
   💬 Consulta del cliente:
   'Necesito llantas rin 15 para Chevrolet Spark'
   
   Por favor responde desde WhatsApp Business.
   
   📌 Para finalizar la conversación, envía al cliente:
   '/finalizar' o dile que escriba 'menú' para volver al bot."
```

### **Paso 4: Conversación Activa**

Durante la conversación:

**Si el cliente escribe algo:**
```
Cliente → "¿Ya hay respuesta?"
Bot → Cliente:
  "⏳ En conversación con asesor
   Tu consulta fue enviada. El asesor te responderá pronto.
   💬 Puedes seguir escribiendo y el asesor verá tus mensajes."
```

**Asesor responde directamente:**
```
Asesor → Cliente: "Sí, tenemos llantas Bridgestone rin 15..."
(WhatsApp Business maneja esta comunicación directamente)
```

### **Paso 5: Finalizar Conversación**

#### **Opción A: Asesor finaliza con /finalizar** ⭐ (RECOMENDADO)
```
Asesor → "/finalizar"

Bot → Cliente:
  "✅ Conversación finalizada
   El asesor ha finalizado la atención.
   Gracias por contactarnos. Si necesitas más ayuda, aquí está el menú principal. 👇"
[Muestra menú principal]

Bot → Asesor:
  "✅ Conversación finalizada correctamente
   Cliente: +573001234567
   El bot ha sido reactivado para este cliente."
```

#### **Opción B: Cliente finaliza**
```
Cliente → "menú"
Bot → Cliente:
  "✅ Conversación con asesor finalizada.
   🤖 Bot reactivado. Volviendo al menú principal..."
[Muestra menú principal]
```

#### **Opción C: Timeout automático (24h)** ⚠️ (RESPALDO)
```
--- Después de 24 horas ---
Cliente → "hola"
Bot → Cliente:
  "⏰ Conversación finalizada
   Han pasado 24 horas desde tu última conversación con el asesor.
   La conversación ha sido cerrada automáticamente.
   Si necesitas ayuda nuevamente, con gusto te atenderemos. 👇"
[Muestra menú principal]
```

## ⏱️ Timeouts

| Situación | Timeout | Comportamiento |
|-----------|---------|----------------|
| **Conversación con asesor** | 24 horas | Conversación se cierra automáticamente después de 24h |
| **Navegación con bot** | 7 minutos | Sesión se reinicia por inactividad |

### **Regla Importante:**

✅ Conversación con asesor dura máximo **24 horas**
✅ Después de 24h, se cierra automáticamente y se envía mensaje al cliente
✅ Cliente puede iniciar nueva conversación cuando quiera
❌ NO se aplica timeout de 7 minutos mientras está con asesor
✅ La conversación finaliza cuando:
- **Asesor escribe `/finalizar`** (forma recomendada)
- Cliente escribe "menú"
- Pasan 24 horas desde el inicio (mecanismo de seguridad)

## 📊 Estados del Sistema

```
MAIN_MENU
    ↓ (Cliente selecciona "2")
WAITING_ADVISOR_QUERY
    ↓ (Cliente escribe consulta)
WITH_ADVISOR ← SIN TIMEOUT
    ↓ (Cliente escribe "menú")
MAIN_MENU
```

## 💬 Comandos Disponibles

### **Para el Cliente:**

| Comando | Acción |
|---------|--------|
| `menú` | Finaliza conversación con asesor y vuelve al bot |
| `menu` | Igual que "menú" |
| `inicio` | Igual que "menú" |

### **Para el Asesor:**

| Comando | Acción |
|---------|--------|
| `/finalizar` | ⭐ **Finaliza la conversación automáticamente** (recomendado) |

El asesor **debe** responder desde WhatsApp Business. El bot:
- Notifica al asesor cuando hay nueva solicitud
- Mantiene al cliente informado si escribe mientras espera
- Detecta el comando `/finalizar` para cerrar la conversación
- Reactiva el bot cuando el cliente escribe "menú" o después de 24h

## 🎯 Mejores Prácticas para Asesores

### ✅ **Al Iniciar Conversación:**

```
"Hola, soy [Nombre], asesor de Zona Repuestera.
Vi que necesitas [resumen de consulta].
¿En qué más puedo ayudarte?"
```

### ✅ **Durante la Conversación:**

- Responde todas las preguntas del cliente
- Proporciona información detallada
- Ofrece alternativas si es necesario
- Confirma que el cliente está satisfecho

### ✅ **Al Finalizar:**

**Opción 1: Comando /finalizar (Recomendado)**
```
Asesor → "/finalizar"
[Bot cierra automáticamente y notifica al cliente]
```

**Opción 2: Indicar al cliente**
```
"¿Hay algo más en lo que pueda ayudarte?
Si no, puedes escribir 'menú' para volver al bot automático."
```

## 🚨 Consideraciones Importantes

### **1. Timeout de 24 Horas**

La conversación tiene una ventana de 24 horas:
- ✅ Es un **mecanismo de seguridad** para evitar sesiones indefinidas
- ✅ Si el asesor olvida finalizar con `/finalizar`, se cierra automáticamente
- ✅ Después de 24h, el cliente recibe notificación de cierre automático
- ⚠️ **La forma correcta** de finalizar es escribiendo `/finalizar`

### **2. Inactividad NO Aplica**

Mientras el cliente está con asesor:
- ❌ NO se reinicia la sesión por inactividad (7 minutos)
- ❌ NO se pierden datos durante las 24 horas
- ✅ Cliente puede esperar la respuesta del asesor sin presión
- ✅ Conversación se mantiene activa hasta que se finalice manualmente o expiren las 24h

### **3. Múltiples Clientes**

Si varios clientes solicitan asesor:
- Cada uno recibe su propia notificación
- Asesor ve el número de cada cliente
- Puede atender múltiples conversaciones en paralelo
- WhatsApp Business muestra conversaciones separadas

## 🧪 Casos de Uso

### **Caso 1: Conversación Normal con /finalizar**

```
10:00 - Cliente solicita asesor
10:01 - Cliente envía consulta: "Necesito llantas rin 15"
10:05 - Asesor responde
10:06 - Cliente pregunta más detalles
10:08 - Asesor responde con fotos de productos
10:10 - Cliente: "Perfecto, me interesan"
10:11 - Asesor: "Excelente, te ayudo con el pedido"
10:12 - Asesor: "/finalizar"
10:12 - Bot notifica al cliente que la conversación finalizó
10:12 - Bot reactiva y muestra menú principal al cliente
```

### **Caso 2: Cliente Finaliza Manualmente**

```
10:00 - Cliente solicita asesor
10:01 - Cliente: "Necesito aceite"
10:05 - Asesor: "Tenemos Shell Helix y Mobil 1..."
10:10 - Cliente: "Gracias, ya me decidí. Voy a pensarlo"
10:11 - Cliente: "menú"
10:11 - Bot reactiva y muestra menú principal
```

### **Caso 3: Cliente Impaciente**

```
10:00 - Cliente solicita asesor
10:01 - Cliente: "Necesito llantas urgente"
10:03 - Cliente: "hola?"
10:03 - Bot: "⏳ En conversación con asesor..."
10:05 - Cliente: "siguen ahí?"
10:05 - Bot: "⏳ En conversación con asesor..."
10:06 - Asesor: "Hola, disculpa la demora..."
[Conversación continúa normalmente]
10:15 - Asesor: "/finalizar"
10:15 - Bot cierra conversación y reactiva menú
```

### **Caso 4: Conversación Larga (Dentro de 24h)**

```
10:00 - Cliente solicita asesor
10:01 - Cliente: "Necesito repuestos para mi carro"
10:10 - Asesor responde
10:15 - Cliente pregunta sobre varios productos
10:30 - Asesor envía cotización
10:45 - Cliente pide tiempo para decidir
11:00 - Asesor: "Ok, aquí estaré"
--- 5 horas después (dentro de las 24h) ---
16:00 - Cliente: "Ya decidí, quiero comprar"
16:01 - Asesor: "Perfecto, ¿cuál producto?"
[Conversación continúa]
16:10 - Asesor: "/finalizar"
16:10 - Bot cierra conversación

✅ Dentro de 24h, todo funciona perfectamente
```

### **Caso 5: Asesor Olvida Finalizar (Timeout 24h)**

```
Día 1, 10:00 - Cliente solicita asesor
Día 1, 10:01 - Cliente: "Necesito aceite"
Día 1, 10:05 - Asesor responde con opciones
Día 1, 10:10 - Cliente: "Gracias, lo pensaré"
--- Asesor olvida escribir /finalizar ---
--- Cliente nunca escribe "menú" ---
--- Pasan 24 horas ---
Día 2, 10:15 - Cliente: "hola"
Día 2, 10:15 - Bot: "⏰ Conversación finalizada
                     Han pasado 24 horas desde tu última conversación con el asesor.
                     La conversación ha sido cerrada automáticamente."
Día 2, 10:15 - Bot muestra menú principal

✅ Mecanismo de seguridad evita sesiones indefinidas en el servidor
✅ Cliente puede iniciar nueva conversación cuando quiera
```

## 📈 Ventajas de Este Diseño

| Ventaja | Beneficio |
|---------|-----------|
| **Comando /finalizar** | Asesor cierra conversación con un solo mensaje |
| **Timeout de seguridad** | Evita sesiones indefinidas si asesor olvida finalizar |
| **Cliente siempre atendido** | Si solicita asesor, recibe atención humana dentro de 24h |
| **Conversaciones flexibles** | Cliente puede esperar respuesta sin presión de 7 min |
| **Cierre controlado** | Asesor decide cuándo finalizar o timeout hace limpieza automática |
| **Sin sobrecarga del servidor** | Máximo 24h por conversación, después se limpian automáticamente |

## 🔧 Configuración

Variables de entorno:
```env
ADVISOR_PHONE_NUMBER=573164088588
INACTIVITY_TIMEOUT_MINUTES=7  # Solo aplica cuando NO está con asesor
```

**Nota:** El timeout de 24 horas para conversaciones con asesor está hardcodeado en `menuService.js` como `ADVISOR_CONVERSATION_TIMEOUT`.

---

**Última actualización:** 12 de octubre de 2025  
**Versión:** 3.0 (Con comando /finalizar y timeout 24h)
