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
        
        const url = `${ECOMMERCE_API_URL}/products/?${params.toString()}`;
        const response = await axios.get(url);
        
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
    const price = product.inventoryprice?.final_price || product.inventoryprice?.base_price || 0;
    const stock = product.inventoryprice?.stock || 0;
    const discount = product.inventoryprice?.discount_percent || 0;
    
    let message = `📦 *${product.description}*\n`;
    message += `🔧 Código: ${product.code}\n`;
    message += `🏷️ Marca: ${product.brand?.name || 'N/A'}\n`;
    message += `📁 Categoría: ${product.category?.name || 'N/A'}`;
    
    if (product.subcategory?.name) {
        message += ` → ${product.subcategory.name}`;
    }
    
    message += `\n💰 Precio: $${price.toLocaleString('es-CO')}`;
    
    if (discount > 0) {
        const originalPrice = product.inventoryprice?.base_price || 0;
        message += ` ~~$${originalPrice.toLocaleString('es-CO')}~~ (-${discount}% OFF)`;
    }
    
    message += `\n📊 Stock: ${stock} unidades`;
    
    // Autos compatibles
    if (product.compatible_cars && product.compatible_cars.length > 0) {
        const cars = product.compatible_cars.slice(0, 3).map(c => `${c.brand?.name} ${c.name}`).join(', ');
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
function formatProductList(products, page = 1, perPage = 5) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedProducts = products.slice(start, end);
    const totalPages = Math.ceil(products.length / perPage);
    
    let message = `🔍 *Resultados de búsqueda*\n`;
    message += `📊 Encontrados: ${products.length} productos\n`;
    message += `📄 Página ${page} de ${totalPages}\n\n`;
    
    paginatedProducts.forEach((product, index) => {
        message += `*${start + index + 1}.* ${product.description}\n`;
        message += `   💰 $${(product.inventoryprice?.final_price || 0).toLocaleString('es-CO')}`;
        
        if (product.inventoryprice?.discount_percent > 0) {
            message += ` (-${product.inventoryprice.discount_percent}% OFF)`;
        }
        
        message += `\n   📊 Stock: ${product.inventoryprice?.stock || 0} unidades\n\n`;
    });
    
    if (totalPages > 1) {
        message += `\n_Responde con el número del producto para ver más detalles_`;
        message += `\n_O "siguiente" para ver más productos_`;
    } else {
        message += `\n_Responde con el número del producto para ver más detalles_`;
    }
    
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
