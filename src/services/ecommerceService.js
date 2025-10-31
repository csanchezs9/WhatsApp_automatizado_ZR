const axios = require('axios');

const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Obtiene las categorías del e-commerce
 */
const getCategories = async () => {
  try {
    const response = await axios.get(`${ECOMMERCE_API_URL}/catalog/categorias/`);
    console.log(`📦 Categorías obtenidas: ${response.data.length}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo categorías:', error.message);

    // Datos de prueba con IDs REALES de la API (actualizados 2025)
    console.log('⚠️ Usando datos de prueba con IDs reales');
    return [
      { id: 262, name: 'Motor', product_count: 719, subcategory_count: 18 },
      { id: 263, name: 'Sistema de refrigeración', product_count: 205, subcategory_count: 10 },
      { id: 256, name: 'Caja', product_count: 40, subcategory_count: 6 },
      { id: 259, name: 'Embrague', product_count: 52, subcategory_count: 6 },
      { id: 264, name: 'Suspensión', product_count: 991, subcategory_count: 16 },
      { id: 261, name: 'Frenos', product_count: 193, subcategory_count: 7 },
      { id: 258, name: 'Eléctricos', product_count: 131, subcategory_count: 13 },
      { id: 257, name: 'Carrocería', product_count: 29, subcategory_count: 6 },
      { id: 260, name: 'Filtros', product_count: 129, subcategory_count: 7 }
    ];
  }
};

/**
 * Obtiene las subcategorías de una categoría
 */
const getSubCategories = async (categoryId) => {
  try {
    const response = await axios.get(`${ECOMMERCE_API_URL}/catalog/sub-categorias/?category=${categoryId}`);
    console.log(`📂 Subcategorías obtenidas para categoría ${categoryId}: ${response.data.length}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo subcategorías:', error.message);
    return [];
  }
};

/**
 * Obtiene los productos de una categoría o subcategoría
 */
const getProducts = async (subcategoryId) => {
  try {
    const url = `${ECOMMERCE_API_URL}/products/products/?subcategory=${subcategoryId}`;
    
    const response = await axios.get(url);
    console.log(`🔧 Productos obtenidos para subcategoría ${subcategoryId}: ${response.data.results?.length || response.data.length || 0}`);
    
    // La API puede devolver {results: [...]} o directamente [...]
    return response.data.results || response.data;
  } catch (error) {
    console.error('Error obteniendo productos:', error.message);
    return [];
  }
};

/**
 * Crea una orden en el e-commerce
 */
const createOrder = async (orderData) => {
  try {
    // Implementar cuando conectes con Django
    /*
    const response = await axios.post(`${ECOMMERCE_API_URL}/orders/`, orderData);
    return response.data;
    */

    console.log('Orden creada (simulación):', orderData);
    return {
      id: Math.floor(Math.random() * 10000),
      status: 'pending',
      total: orderData.total
    };
  } catch (error) {
    console.error('Error creando orden:', error.message);
    throw error;
  }
};

module.exports = {
  getCategories,
  getSubCategories,
  getProducts,
  createOrder
};
