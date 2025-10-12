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
    
    // Datos de prueba si falla la conexión
    console.log('⚠️ Usando datos de prueba');
    return [
      { id: 1, name: 'Motor', product_count: 18, subcategory_count: 3 },
      { id: 2, name: 'Sistema de refrigeración', product_count: 10, subcategory_count: 2 },
      { id: 3, name: 'Caja', product_count: 6, subcategory_count: 4 },
      { id: 4, name: 'Embrague', product_count: 6, subcategory_count: 2 },
      { id: 5, name: 'Suspensión', product_count: 16, subcategory_count: 3 },
      { id: 6, name: 'Frenos', product_count: 7, subcategory_count: 2 },
      { id: 7, name: 'Eléctricos', product_count: 13, subcategory_count: 5 },
      { id: 8, name: 'Carrocería', product_count: 6, subcategory_count: 3 }
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
