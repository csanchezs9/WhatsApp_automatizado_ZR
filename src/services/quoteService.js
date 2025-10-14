const axios = require('axios');

const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'https://zonarepuestera.com.co/api/v1';

/**
 * Obtiene todas las marcas de vehículos disponibles
 */
async function getCarBrands() {
    try {
        const response = await axios.get(`${ECOMMERCE_API_URL}/vehicles/car-brands/`);
        return {
            success: true,
            data: response.data.results || response.data
        };
    } catch (error) {
        console.error('❌ Error obteniendo marcas de vehículos:', error.response?.data || error.message);
        return {
            success: false,
            error: 'No se pudieron obtener las marcas de vehículos'
        };
    }
}

/**
 * Obtiene los modelos de una marca específica
 */
async function getCarModels(brandId) {
    try {
        const url = `${ECOMMERCE_API_URL}/vehicles/car-models/?brand=${brandId}`;
        console.log(`🔍 Consultando modelos: ${url}`);
        const response = await axios.get(url);
        console.log('📦 Respuesta de modelos:', JSON.stringify(response.data, null, 2));
        
        return {
            success: true,
            data: response.data || []
        };
    } catch (error) {
        console.error('❌ Error obteniendo modelos:', error.response?.data || error.message);
        return {
            success: false,
            error: 'No se pudieron obtener los modelos'
        };
    }
}

/**
 * Obtiene las categorías de productos disponibles para una marca y modelo
 * @param {number} brandId - ID de la marca
 * @param {number} modelId - ID del modelo
 */
async function getCategories(brandId, modelId) {
    try {
        const url = `${ECOMMERCE_API_URL}/catalog/categorias/?brand=${brandId}&model=${modelId}`;
        console.log(`🔍 Consultando categorías: ${url}`);
        const response = await axios.get(url);
        console.log('📦 Respuesta de categorías:', JSON.stringify(response.data, null, 2));
        return {
            success: true,
            data: response.data.results || response.data
        };
    } catch (error) {
        console.error('❌ Error obteniendo categorías:', error.response?.data || error.message);
        return {
            success: false,
            error: 'No se pudieron obtener las categorías'
        };
    }
}

/**
 * Obtiene las subcategorías disponibles para una categoría, marca y modelo específicos
 * @param {number} categoryId - ID de la categoría
 * @param {number} brandId - ID de la marca
 * @param {number} modelId - ID del modelo
 */
async function getSubcategories(categoryId, brandId, modelId) {
    try {
        const url = `${ECOMMERCE_API_URL}/catalog/sub-categorias/?category=${categoryId}&brand=${brandId}&model=${modelId}`;
        console.log(`🔍 Consultando subcategorías: ${url}`);
        const response = await axios.get(url);
        console.log('📦 Respuesta de subcategorías:', JSON.stringify(response.data, null, 2));
        return {
            success: true,
            data: response.data.results || response.data
        };
    } catch (error) {
        console.error('❌ Error obteniendo subcategorías:', error.response?.data || error.message);
        return {
            success: false,
            error: 'No se pudieron obtener las subcategorías'
        };
    }
}

/**
 * Busca productos según los filtros aplicados
 */
async function searchProducts(filters = {}) {
    try {
        const params = new URLSearchParams();
        
        if (filters.brand) params.append('brand', filters.brand);
        if (filters.model) params.append('model', filters.model);
        if (filters.category) params.append('category', filters.category);
        if (filters.subcategory) params.append('subcategory', filters.subcategory);
        
        const url = `${ECOMMERCE_API_URL}/products/products/?${params.toString()}`;
        console.log(`🔍 Buscando productos: ${url}`);
        const response = await axios.get(url);
        console.log(`📦 Encontrados: ${response.data.count || 0} productos`);
        
        return {
            success: true,
            data: response.data.results || response.data,
            count: response.data.count || (response.data.results || response.data).length
        };
    } catch (error) {
        console.error('❌ Error buscando productos:', error.response?.data || error.message);
        return {
            success: false,
            error: 'No se pudieron buscar los productos'
        };
    }
}

/**
 * Formatea la información de un producto para WhatsApp
 */
function formatProduct(product) {
    // El serializer devuelve los campos directamente, no en inventoryprice
    const price = product.discounted_price || product.base_price || 0;
    const stock = product.stock || 0;
    const basePrice = product.base_price || 0;
    const savings = product.savings || 0;
    
    let message = `📦 *${product.description || product.name}*\n`;
    message += `🔧 Código: ${product.code}\n`;
    message += `🏷️ Marca: ${product.brand || 'N/A'}\n`;
    message += `📁 Categoría: ${product.category || 'N/A'}`;
    
    if (product.subcategory?.name) {
        message += ` → ${product.subcategory.name}`;
    }
    
    message += `\n💰 Precio: $${Math.round(price).toLocaleString('es-CO')}`;
    
    if (savings > 0) {
        message += ` ~~$${Math.round(basePrice).toLocaleString('es-CO')}~~ (AHORRO: $${Math.round(savings).toLocaleString('es-CO')})`;
    }
    
    message += `\n📊 Stock: ${stock} unidades`;
    
    // Autos compatibles (vienen como array de strings)
    if (product.compatible_cars && product.compatible_cars.length > 0) {
        const cars = product.compatible_cars.slice(0, 3).join(', ');
        message += `\n🚗 Compatible: ${cars}`;
        if (product.compatible_cars.length > 3) {
            message += ` y ${product.compatible_cars.length - 3} más`;
        }
    }
    
    return message;
}

/**
 * Formatea una lista de productos para WhatsApp
 */
function formatProductList(products, page = 1, perPage = 10, filters = {}) {
    const maxDisplay = 10; // Máximo de productos a mostrar
    const displayProducts = products.slice(0, maxDisplay);
    const hasMore = products.length > maxDisplay;
    
    let message = `🔍 *Resultados de búsqueda*\n`;
    message += `📊 Encontrados: ${products.length} productos\n\n`;
    
    displayProducts.forEach((product, index) => {
        const price = product.discounted_price || product.base_price || 0;
        const savings = product.savings || 0;
        
        message += `*${index + 1}.* ${product.description || product.name}\n`;
        message += `   💰 $${Math.round(price).toLocaleString('es-CO')}`;
        
        if (savings > 0) {
            message += ` (AHORRO: $${Math.round(savings).toLocaleString('es-CO')})`;
        }
        
        message += `\n   📊 Stock: ${product.stock || 0} unidades\n\n`;
    });
    
    if (hasMore) {
        // Construir URL del catálogo con filtros
        let catalogUrl = 'https://zonarepuestera.com.co/catalogo';
        const params = [];
        
        if (filters.brand) params.push(`marca=${filters.brand}`);
        if (filters.model) params.push(`modelo=${filters.model}`);
        if (filters.category) params.push(`categoria=${filters.category}`);
        if (filters.subcategory) params.push(`subcategoria=${filters.subcategory}`);
        
        if (params.length > 0) {
            catalogUrl += '?' + params.join('&');
        }
        
        message += `\n📱 *Mostrando primeros ${maxDisplay} de ${products.length} productos*\n\n`;
        message += `🌐 Para ver todos los productos disponibles, ingresa aquí:\n`;
        message += `${catalogUrl}\n\n`;
    }
    
    message += `\n_Responde con el número del producto para ver más detalles_`;
    
    return message;
}

module.exports = {
    getCarBrands,
    getCarModels,
    getCategories,
    getSubcategories,
    searchProducts,
    formatProduct,
    formatProductList
};
