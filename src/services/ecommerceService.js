const axios = require('axios');

const ECOMMERCE_API_URL = process.env.ECOMMERCE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Obtiene las categorías del e-commerce
 * IMPORTANTE: SIN DATOS QUEMADOS - TODO DINÁMICO desde la API
 */
const getCategories = async () => {
  try {
    const url = `${ECOMMERCE_API_URL}/catalog/categorias/`;
    console.log(`🔍 Consultando categorías: ${url}`);

    const response = await axios.get(url, {
      timeout: 10000, // 10 segundos timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });

    console.log(`✅ Categorías obtenidas: ${response.data.length}`);

    if (!response.data || response.data.length === 0) {
      console.warn('⚠️ API devolvió array vacío de categorías');
      throw new Error('No hay categorías disponibles en la API');
    }

    return response.data;
  } catch (error) {
    console.error('❌ ERROR CRÍTICO obteniendo categorías:', {
      message: error.message,
      code: error.code,
      response: error.response?.status,
      data: error.response?.data,
      url: `${ECOMMERCE_API_URL}/catalog/categorias/`
    });

    // NO USAR DATOS DE PRUEBA - Lanzar error para manejo correcto
    throw new Error(`Error conectando con la API de productos: ${error.message}`);
  }
};

/**
 * Obtiene las subcategorías de una categoría
 * IMPORTANTE: SIN DATOS QUEMADOS - TODO DINÁMICO desde la API
 */
const getSubCategories = async (categoryId) => {
  try {
    const url = `${ECOMMERCE_API_URL}/catalog/sub-categorias/?category=${categoryId}`;
    console.log(`🔍 Consultando subcategorías: ${url}`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });

    console.log(`✅ Subcategorías obtenidas para categoría ${categoryId}: ${response.data.length}`);
    return response.data; // Puede ser array vacío si no hay subcategorías

  } catch (error) {
    console.error('❌ ERROR obteniendo subcategorías:', {
      categoryId,
      message: error.message,
      code: error.code,
      response: error.response?.status,
      data: error.response?.data,
      url: `${ECOMMERCE_API_URL}/catalog/sub-categorias/?category=${categoryId}`
    });

    // NO devolver datos de prueba - Lanzar error
    throw new Error(`Error obteniendo subcategorías: ${error.message}`);
  }
};

/**
 * Obtiene los productos de una categoría o subcategoría
 * IMPORTANTE: SIN DATOS QUEMADOS - TODO DINÁMICO desde la API
 */
const getProducts = async (subcategoryId) => {
  try {
    const url = `${ECOMMERCE_API_URL}/products/products/?subcategory=${subcategoryId}`;
    console.log(`🔍 Consultando productos: ${url}`);

    const response = await axios.get(url, {
      timeout: 15000, // 15 segundos para productos (puede ser más pesado)
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WhatsApp-Bot/1.0'
      }
    });

    // La API puede devolver {results: [...]} o directamente [...]
    const products = response.data.results || response.data;

    console.log(`✅ Productos obtenidos para subcategoría ${subcategoryId}: ${products.length}`);

    return products; // Puede ser array vacío si no hay productos

  } catch (error) {
    console.error('❌ ERROR obteniendo productos:', {
      subcategoryId,
      message: error.message,
      code: error.code,
      response: error.response?.status,
      data: error.response?.data,
      url: `${ECOMMERCE_API_URL}/products/products/?subcategory=${subcategoryId}`
    });

    // NO devolver datos de prueba - Lanzar error
    throw new Error(`Error obteniendo productos: ${error.message}`);
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
