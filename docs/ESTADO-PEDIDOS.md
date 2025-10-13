# Consulta de Estado de Pedidos

## Funcionalidad

Este módulo permite a los usuarios consultar el estado de sus pedidos a través del bot de WhatsApp ingresando su correo electrónico.

## Flujo de Usuario

1. Usuario selecciona "📦 Estado de Pedido" del menú principal (opción 8)
2. Bot solicita el correo electrónico usado en la compra
3. Usuario ingresa su email
4. Bot valida el formato del email
5. Bot consulta pedidos en el backend
6. Bot muestra:
   - Lista resumida si hay múltiples pedidos
   - Detalles completos si hay un solo pedido
   - Mensaje si no se encontraron pedidos
7. Usuario puede seleccionar un pedido específico para ver detalles completos

## Información Mostrada

Para cada pedido se muestra:
- **Número de pedido**: ID único
- **Fecha**: Fecha y hora de creación
- **Estado**: Pendiente pago, Pagado, Enviado, Completado, Cancelado
- **Método de envío**: Entrega local o envío con guía
- **Número de guía**: Si está disponible (pedidos enviados)
- **Productos**: Lista con nombre, código, cantidad y precios
- **Totales**: Subtotal, descuento, envío y total
- **Datos del cliente**: Nombre, teléfono y dirección de entrega
- **Notas**: Cualquier nota adicional del pedido

## Configuración del Backend

### Opción 1: Endpoint Público (Recomendado para Bot)

Crear un endpoint específico en `apps/orders/views.py` que permita consultas por email sin autenticación:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q

@api_view(['GET'])
@permission_classes([AllowAny])
def orders_by_email(request):
    """
    Endpoint público para consultar pedidos por email desde el bot de WhatsApp.
    Solo retorna pedidos que NO están en estado 'pending'.
    """
    email = request.query_params.get('email', '').strip().lower()
    
    if not email:
        return Response({'error': 'Email es requerido'}, status=400)
    
    # Validar formato básico de email
    if '@' not in email or '.' not in email.split('@')[1]:
        return Response({'error': 'Email inválido'}, status=400)
    
    # Buscar pedidos por email en customer_billing
    orders = Order.objects.filter(
        customer_billing__email__iexact=email
    ).exclude(
        status='pending'
    ).select_related(
        'shipping_method', 'customer_billing', 'company_billing'
    ).prefetch_related(
        Prefetch(
            'items',
            queryset=OrderItem.objects.select_related('product')
        )
    ).order_by('-created_at')
    
    # Serializar
    serializer = OrderSerializer(orders, many=True)
    return Response({
        'count': orders.count(),
        'results': serializer.data
    })
```

Agregar la ruta en `apps/orders/urls.py`:

```python
urlpatterns = [
    path('', include(router.urls)),
    path('by-email/', orders_by_email, name='orders-by-email'),
    # ... otras rutas
]
```

### Opción 2: Autenticación con Token de Bot

Si prefieres mantener el endpoint protegido, crear un usuario de API específico para el bot:

1. Crear usuario en Django Admin: `whatsapp_bot`
2. Generar token de autenticación
3. Agregar el token al `.env` del bot:
   ```
   ECOMMERCE_API_TOKEN=Token abc123def456...
   ```

4. El bot usará este token para todas las peticiones

### Opción 3: API Key Simple

Agregar validación por API key en el endpoint:

```python
@api_view(['GET'])
@permission_classes([AllowAny])
def orders_by_email(request):
    # Validar API key
    api_key = request.headers.get('X-API-Key', '')
    if api_key != settings.WHATSAPP_BOT_API_KEY:
        return Response({'error': 'No autorizado'}, status=403)
    
    # ... resto del código
```

## Variables de Entorno

En el archivo `.env` del bot:

```bash
# URL del backend de Django (sin /api/v1 al final)
ECOMMERCE_API_URL=http://localhost:8000/api

# Token de autenticación (opcional, según opción elegida)
ECOMMERCE_API_TOKEN=Token abc123...

# O API Key (según opción elegida)
WHATSAPP_BOT_API_KEY=your-secret-key-here
```

## Estados del Bot

- `WAITING_EMAIL_FOR_ORDERS`: Esperando que el usuario ingrese su email
- `VIEWING_ORDER_DETAILS`: Usuario está viendo lista de pedidos y puede seleccionar uno

## Archivos Relacionados

- `src/services/orderService.js`: Servicio para comunicarse con el backend de pedidos
- `src/services/menuService.js`: Lógica del menú y estados del bot
- `apps/orders/models.py`: Modelos de pedidos en Django
- `apps/orders/views.py`: Vistas y endpoints de la API
- `apps/orders/serializers.py`: Serializadores de pedidos

## Mejoras Futuras

1. **Tracking en tiempo real**: Integrar con servicios de mensajería (Servientrega, Coordinadora, etc.)
2. **Notificaciones proactivas**: Enviar mensajes automáticos cuando cambie el estado
3. **Cancelación de pedidos**: Permitir cancelar pedidos desde WhatsApp
4. **Evaluación de pedidos**: Solicitar calificación después de entrega
5. **Historial de cambios**: Mostrar historial completo de estados
6. **Imágenes de productos**: Enviar fotos de los productos en el pedido
7. **Link de rastreo**: Si hay guía, enviar link directo al tracking

## Seguridad

- ✅ Validación de formato de email
- ✅ Solo muestra pedidos confirmados (no pending)
- ⚠️ Considera agregar rate limiting para prevenir abuso
- ⚠️ Considera agregar CAPTCHA o verificación adicional
- ⚠️ Logs de consultas para auditoría

## Testing

Para probar la funcionalidad:

1. Crear un pedido de prueba en el backend con un email conocido
2. Iniciar conversación con el bot en WhatsApp
3. Seleccionar "Estado de Pedido"
4. Ingresar el email usado en el pedido de prueba
5. Verificar que se muestren los detalles correctamente

## Soporte

Si el usuario tiene problemas:
- Verificar que el email sea exactamente el mismo usado en la compra
- Verificar que el pedido no esté en estado "pending"
- Ofrecer contactar con un asesor para ayuda adicional
