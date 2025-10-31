# Costos WhatsApp Business API - Zona Repuestera

## Resumen Ejecutivo

La mayoría de los mensajes de nuestra aplicación **NO tienen costo** gracias a la ventana de 24 horas de WhatsApp. Solo se cobran mensajes específicos según el tipo.

---

## Tipos de Mensajes y Precios (Colombia)

| Tipo | Precio USD | Cuándo aplica |
|------|------------|---------------|
| **Conversación iniciada por cliente** | **$0.00** | Cliente escribe primero y respondemos en <24h |
| **Utility** | $0.0008 | Respuestas fuera de ventana (>24h) o notificaciones |
| **Marketing** | $0.0125 | Campañas promocionales iniciadas por nosotros |
| **Authentication** | $0.0008 | Códigos de verificación (no aplicable) |

---

## Regla de la Ventana de 24 Horas

WhatsApp permite **responder gratis** durante 24 horas desde el último mensaje del cliente:

```
✅ GRATIS (nuestro caso típico)
Cliente: "Hola, quiero un pastel"
Nosotros: [respuesta del bot]
Nosotros: [respuesta del asesor]
Nosotros: [envío de fotos, precios, etc.]
→ Todo esto es GRATIS si está dentro de 24h

💰 SE COBRA ($0.0008 c/u)
- Cliente escribió hace 25 horas → ventana expirada
- Enviamos recordatorio de pedido pendiente
- Enviamos confirmación de entrega por template
```

---

## Proyección de Costos Mensual

### Escenario Actual
- **500 clientes activos/mes**
- **90% respondemos en <24h** → Gratis
- **10% requieren seguimiento tardío** (50 conversaciones × 1.5 mensajes) → 75 mensajes pagos

**Costo mensual estimado:** 75 × $0.0008 = **$0.06 USD** (~$240 COP)

### Si enviáramos campañas de marketing
- 500 clientes × 1 mensaje promocional = $6.25 USD por campaña
- 4 campañas/mes = $25 USD/mes adicionales

---

## Descuentos por Volumen

WhatsApp ofrece descuentos automáticos según el volumen mensual:

| Mensajes Utility/mes | Descuento | Precio |
|---------------------|-----------|--------|
| 0 - 100,000 | 0% | $0.0008 |
| 100,001 - 1,000,000 | -5% | $0.00076 |
| 1,000,001+ | -10% | $0.00072 |

---

## Conclusión

**Nuestra aplicación actual tiene costos prácticamente nulos** porque:

1. Los clientes inician la conversación
2. Respondemos inmediatamente (bot + asesor)
3. Todo ocurre dentro de la ventana de 24 horas

**Costo proyectado:** Menos de $1 USD/mes para operación normal.

Solo tendríamos costos significativos si decidimos implementar campañas de marketing masivo o enviar notificaciones automáticas fuera de la ventana de conversación.

---

**Documento generado:** Octubre 2025
**Fuente:** [Meta WhatsApp Business Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
**Fecha de actualización de precios:** Octubre 1, 2025
