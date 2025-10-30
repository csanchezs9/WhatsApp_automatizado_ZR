# 🔥 Sistema de Promociones Dinámicas

## Descripción
Sistema que permite actualizar el mensaje de promociones del bot de WhatsApp de forma fácil y rápida mediante un comando especial.

## Cómo Usar

### Para el Administrador/Asesor

1. **Ver las promociones actuales:**
   - Cualquier usuario puede ver las promociones seleccionando la opción **"🔥 Promociones"** en el menú principal

2. **Actualizar el mensaje de promociones:**
   
   Desde el número de WhatsApp configurado como asesor, escribe:
   ```
   /actualizar_promo
   ```

3. El bot te pedirá que escribas el nuevo mensaje

4. Escribe el mensaje completo que quieres mostrar. Puedes usar:
   - **Negritas**: `*texto en negrilla*`
   - _Cursivas_: `_texto en cursiva_`
   - Emojis: 🔥 😎 🎉 💰
   - Saltos de línea para organizar el contenido

5. El bot confirmará que el mensaje fue actualizado exitosamente

### Ejemplo de Actualización

```
Asesor: /actualizar_promo

Bot: 📝 ACTUALIZAR MENSAJE DE PROMOCIONES
     Por favor, escribe el nuevo mensaje...

Asesor: 🔥 *PROMOCIONES DE NOVIEMBRE*

        🎉 Descuentos especiales:
        
        🔹 30% OFF en frenos Chevrolet
        🔹 2x1 en filtros de aceite
        🔹 Envío gratis en compras +$150.000
        
        ⏰ Válido hasta el 30 de noviembre
        
        ¡No te lo pierdas! 😎

Bot: ✅ Mensaje de promociones actualizado correctamente
```

## Archivo de Datos

El mensaje se guarda en:
```
src/data/promoMessage.json
```

Contiene:
- `message`: El texto de las promociones
- `lastUpdated`: Fecha y hora de última actualización
- `updatedBy`: Quién lo actualizó

## Seguridad

- ✅ Solo el número configurado como `ADVISOR_PHONE_NUMBER` puede actualizar las promociones
- ✅ Los cambios se guardan automáticamente
- ✅ Si hay error, se usa un mensaje por defecto

## Ventajas

- 📱 **Fácil**: Solo un comando desde WhatsApp
- ⚡ **Rápido**: Cambios en segundos
- 🔄 **Flexible**: Actualiza cuando quieras
- 💾 **Persistente**: Los cambios se guardan en archivo
- 🔒 **Seguro**: Solo el asesor puede cambiar el mensaje
