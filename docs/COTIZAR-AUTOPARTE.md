# 🔍 Cotizar una Autoparte - Nueva Funcionalidad

## 📋 Descripción

Nueva opción en el menú principal del bot que permite a los usuarios buscar autopartes específicas filtradas por:
- **Marca del vehículo** (ej: Chevrolet, Ford, Toyota, etc.)
- **Modelo del vehículo** (ej: Spark, Fiesta, Corolla, etc.)
- **Categoría del repuesto** (ej: Motor, Frenos, Sistema eléctrico, etc.)
- **Subcategoría** (opcional) (ej: Filtros, Pastillas, Alternadores, etc.)

## 🎯 Diferencia con el Catálogo

| Aspecto | Catálogo (Opción 2) | Cotizar Autoparte (Opción 1) |
|---------|---------------------|------------------------------|
| **Filtro principal** | Categoría de producto | Marca + Modelo de vehículo |
| **Búsqueda** | Por tipo de repuesto | Por compatibilidad con vehículo |
| **Uso ideal** | Sé qué repuesto necesito | Sé qué vehículo tengo |
| **Ejemplo** | "Necesito un filtro de aceite" | "Necesito repuestos para mi Chevrolet Spark 2015" |

## 🚀 Flujo de Usuario

### Paso 1: Seleccionar marca de vehículo
```
🚗 SELECCIONA LA MARCA DE TU VEHÍCULO

Tenemos 45 marcas disponibles.

_Selecciona una marca de la lista:_

[Lista interactiva con marcas]
```

### Paso 2: Seleccionar modelo
```
🚙 SELECCIONA EL MODELO DE TU CHEVROLET

Tenemos 12 modelos disponibles.

_Selecciona un modelo de la lista:_

[Lista interactiva con modelos]
```

### Paso 3: Seleccionar categoría
```
📁 SELECCIONA LA CATEGORÍA DEL REPUESTO

¿Qué tipo de repuesto necesitas?

_Selecciona una categoría:_

[Lista interactiva con categorías]
```

### Paso 4: Seleccionar subcategoría (opcional)
```
📂 SELECCIONA LA SUBCATEGORÍA

Categoría: Motor

_Selecciona una subcategoría o omite este filtro:_

[Lista interactiva con subcategorías]
[Opción: ⏭️ Omitir subcategoría]
```

### Paso 5: Ver resultados
```
🔍 Resultados de búsqueda
📊 Encontrados: 23 productos
📄 Página 1 de 5

1. Filtro de Aceite Mann W610/3
   💰 $35,000 (-10% OFF)
   📊 Stock: 15 unidades

2. Filtro de Aceite Fram PH3593A
   💰 $28,500
   📊 Stock: 8 unidades

...

_Responde con el número del producto para ver más detalles_
_O "siguiente" para ver más productos_
```

### Paso 6: Ver detalles de producto
```
📦 Filtro de Aceite Mann W610/3
🔧 Código: FIL-001234
🏷️ Marca: Mann Filter
📁 Categoría: Motor → Filtros
💰 Precio: $35,000 ~~$38,889~~ (-10% OFF)
📊 Stock: 15 unidades
🚗 Compatible: Chevrolet Spark, Chevrolet Beat, Chevrolet Sail

[Botón: 💬 Consultar asesor]
[Botón: 🔍 Nueva búsqueda]
[Botón: 🏠 Volver al menú]
```

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:
- ✅ `src/services/quoteService.js` - Servicio de cotización con API calls

### Archivos Modificados:
- ✅ `src/services/menuService.js`
  - Agregada opción "Cotizar una Autoparte" al menú principal (línea ~834)
  - Agregados 6 nuevos estados: `QUOTE_SELECT_BRAND`, `QUOTE_SELECT_MODEL`, `QUOTE_SELECT_CATEGORY`, `QUOTE_SELECT_SUBCATEGORY`, `QUOTE_VIEW_RESULTS`
  - Agregadas funciones: `startQuoteFlow()`, `showCarBrands()`, `showCarModels()`, `showQuoteCategories()`, `showQuoteSubcategories()`, `searchQuoteProducts()`, `showQuoteProductDetails()`

## 🔌 Endpoints de Backend Utilizados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/v1/car-brands/` | GET | Lista de marcas de vehículos |
| `/api/v1/car-brands/{id}/` | GET | Modelos de una marca específica |
| `/api/v1/categorias/` | GET | Categorías de productos |
| `/api/v1/sub-categorias/?category={id}` | GET | Subcategorías de una categoría |
| `/api/v1/products/?brand={}&model={}&category={}&subcategory={}` | GET | Productos filtrados |

## 💾 Datos de Sesión

Se almacenan en `userSessions[userPhone]`:

```javascript
{
  state: 'QUOTE_SELECT_BRAND', // Estado actual del flujo
  quoteFilters: {
    brand: 1,          // ID de la marca seleccionada
    model: 25,         // ID del modelo seleccionado
    category: 3,       // ID de la categoría seleccionada
    subcategory: 12    // ID de la subcategoría (opcional)
  },
  carBrandsList: [...],      // Cache de marcas
  carModelsList: [...],      // Cache de modelos
  quoteCategoriesList: [...],    // Cache de categorías
  quoteSubcategoriesList: [...], // Cache de subcategorías
  quoteResults: [...],        // Resultados de búsqueda
  quoteResultsPage: 1,       // Página actual de resultados
  lastActivity: Date.now()   // Timestamp de última actividad
}
```

## 🧪 Pruebas

### Caso 1: Búsqueda completa
1. Seleccionar marca: Chevrolet
2. Seleccionar modelo: Spark
3. Seleccionar categoría: Motor
4. Seleccionar subcategoría: Filtros
5. Ver resultados filtrados
6. Seleccionar producto por número
7. Ver detalles completos

### Caso 2: Búsqueda sin subcategoría
1. Seleccionar marca: Ford
2. Seleccionar modelo: Fiesta
3. Seleccionar categoría: Frenos
4. Omitir subcategoría
5. Ver todos los productos de frenos compatibles

### Caso 3: Sin resultados
1. Seleccionar marca poco común
2. Seleccionar modelo específico
3. Seleccionar categoría específica
4. Recibir mensaje de "No se encontraron productos"
5. Opciones: Nueva búsqueda / Hablar con asesor

## 📊 Características Adicionales

- ✅ **Paginación**: 5 productos por página
- ✅ **Navegación**: Escribir "siguiente" para más resultados
- ✅ **Selección rápida**: Escribir número del producto
- ✅ **Cache**: Listas de marcas y modelos en sesión
- ✅ **Fallback**: Si no hay subcategorías, busca directamente
- ✅ **Botones contextuales**: Consultar asesor, nueva búsqueda, volver al menú

## 🔄 Estados del Flujo

```
MAIN_MENU
   ↓ (usuario selecciona "Cotizar autoparte")
QUOTE_SELECT_BRAND
   ↓ (usuario selecciona marca)
QUOTE_SELECT_MODEL
   ↓ (usuario selecciona modelo)
QUOTE_SELECT_CATEGORY
   ↓ (usuario selecciona categoría)
QUOTE_SELECT_SUBCATEGORY
   ↓ (usuario selecciona subcategoría o omite)
QUOTE_VIEW_RESULTS
   ↓ (usuario selecciona producto)
[Muestra detalles → MAIN_MENU]
```

## 🎨 Formato de Mensajes

### Lista de productos
- Número de producto
- Nombre del producto
- Precio (con descuento si aplica)
- Stock disponible
- Navegación (página actual/total)

### Detalles de producto
- Nombre completo
- Código de producto
- Marca
- Categoría y subcategoría
- Precio (con precio original si hay descuento)
- Porcentaje de descuento
- Stock disponible
- Vehículos compatibles (máximo 3, con "y X más")

## ⚠️ Manejo de Errores

- ❌ Sin conexión al backend → Mensaje de error + Volver al menú
- ❌ Marca sin modelos → Mensaje + Volver a marcas
- ❌ Categoría sin subcategorías → Busca directamente
- ❌ Sin resultados → Mensaje + Opciones (nueva búsqueda / asesor)
- ❌ Selección inválida → Mensaje + Pedir nueva selección

## 📱 Ejemplo de Uso Completo

```
Usuario: [Abre WhatsApp y envía "Hola"]

Bot: 👋 ¡Hola! Soy ZonaBot...
     [Menú con opciones]

Usuario: [Selecciona "🔍 Cotizar una Autoparte"]

Bot: 🔍 COTIZAR AUTOPARTE
     Te ayudaré a encontrar la autoparte que necesitas.
     [Lista de marcas]

Usuario: [Selecciona "Chevrolet"]

Bot: 🚙 SELECCIONA EL MODELO DE TU CHEVROLET
     [Lista de modelos]

Usuario: [Selecciona "Spark"]

Bot: 📁 SELECCIONA LA CATEGORÍA DEL REPUESTO
     [Lista de categorías]

Usuario: [Selecciona "Motor"]

Bot: 📂 SELECCIONA LA SUBCATEGORÍA
     [Lista de subcategorías + Omitir]

Usuario: [Selecciona "Filtros"]

Bot: 🔍 Resultados de búsqueda
     📊 Encontrados: 12 productos
     [Lista paginada de 5 productos]

Usuario: "2"

Bot: 📦 Filtro de Aceite Fram PH3593A
     [Detalles completos del producto]
     [Botones: Consultar asesor / Nueva búsqueda / Volver]
```

## 🚀 Despliegue

La funcionalidad ya está integrada en el bot principal. Para activarla:

1. Asegúrate de que el backend tenga los endpoints activos
2. Reinicia el bot: `npm start`
3. Verifica que Ngrok esté corriendo
4. Prueba enviando un mensaje al bot

## 📝 Notas de Implementación

- Los filtros se aplican acumulativamente (AND)
- La marca del vehículo filtra por compatibilidad del producto
- El modelo filtra por `compatible_cars__id`
- Las categorías y subcategorías filtran por relación directa
- Los productos siempre deben tener stock > 0 y precio > 0

---

**Creado:** 13 de octubre de 2025  
**Versión:** 1.0  
**Estado:** ✅ Implementado y listo para pruebas
