// This file handles CRUD operations for products in a DynamoDB table
// It provides endpoints for creating, reading, and updating product information

// Initialize AWS services and environment variables
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// CORS and API Gateway response headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT'
};

// Response Helper Functions
// Builds a standardized API response with proper headers and body format
const buildResponse = (statusCode, data) => ({
  statusCode,
  headers,
  body: JSON.stringify(data)
});

// Creates a success response with optional status code
const successResponse = (data, statusCode = 200) => buildResponse(statusCode, { success: true, data });
// Creates an error response with optional status code
const errorResponse = (message, statusCode = 500) => buildResponse(statusCode, { success: false, error: message });

// Validation Functions
// Validates all required fields and data types for a product
const validateProduct = (product) => {
  const { codigo, nombre, cantidad, precio_unitario, categoria } = product;
  
  if (!codigo || !nombre || !cantidad || !precio_unitario || !categoria) {
    throw new Error('Todos los campos son obligatorios: codigo, nombre, cantidad, precio_unitario, categoria.');
  }

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new Error('La cantidad debe ser un número entero positivo.');
  }

  if (typeof precio_unitario !== 'number' || precio_unitario < 0 || !(/^\d+(\.\d{0,2})?$/).test(precio_unitario.toString())) {
    throw new Error('El precio unitario debe ser un número positivo con máximo 2 decimales.');
  }
};

// Validates that quantity is a positive integer
const validateQuantity = (cantidad) => {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new Error('La cantidad debe ser un número entero positivo.');
  }
};

// API Handlers

// Creates a new product in the database
// Validates input and checks for duplicate product codes
exports.createProduct = async (event) => {
  console.log('Recibiendo solicitud para crear un producto:', event.body);

  try {
    // Parse and validate incoming product data
    const product = JSON.parse(event.body);
    validateProduct(product);

    // Check for existing product with same code
    const existingProduct = await dynamoDB.get({
      TableName: PRODUCTS_TABLE,
      Key: { codigo: product.codigo }
    }).promise();

    if (existingProduct.Item) {
      return errorResponse('Código de producto duplicado', 409);
    }

    // Save product with optional description
    await dynamoDB.put({ 
      TableName: PRODUCTS_TABLE, 
      Item: { ...product, descripcion: product.descripcion || '' }
    }).promise();

    return successResponse({ message: 'Producto creado exitosamente', product }, 201);
  } catch (error) {
    console.error('Error al crear producto:', error);
    return errorResponse(error.message, error.name === 'ValidationError' ? 400 : 500);
  }
};

// Retrieves a single product by its code
exports.getProduct = async (event) => {
  console.log('Recibiendo solicitud para obtener producto:', event.pathParameters);

  try {
    // Extract and validate product code
    const { codigo } = event.pathParameters;
    if (!codigo) return errorResponse('El parámetro "codigo" es obligatorio.', 400);

    const result = await dynamoDB.get({ TableName: PRODUCTS_TABLE, Key: { codigo } }).promise();
    if (!result.Item) return errorResponse(`Producto con código "${codigo}" no encontrado.`, 404);

    return successResponse(result.Item);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return errorResponse('Hubo un error interno al obtener el producto.');
  }
};

// Retrieves all products from the database
exports.listProducts = async () => {
  console.log('Recibiendo solicitud para listar productos');

  try {
    // Scan entire table for all products
    const result = await dynamoDB.scan({ TableName: PRODUCTS_TABLE }).promise();
    return successResponse(result.Items);
  } catch (error) {
    console.error('Error al listar productos:', error);
    return errorResponse('Hubo un error interno al listar los productos.');
  }
};

// Updates the quantity of an existing product
exports.updateQuantity = async (event) => {
  console.log('Recibiendo solicitud para actualizar cantidad:', event.body);

  try {
    // Extract parameters and validate quantity
    const { codigo } = event.pathParameters;
    const { cantidad } = JSON.parse(event.body);

    if (!codigo) return errorResponse('El parámetro "codigo" es obligatorio.', 400);
    validateQuantity(cantidad);

    // Update product quantity and return updated item
    const result = await dynamoDB.update({
      TableName: PRODUCTS_TABLE,
      Key: { codigo },
      UpdateExpression: 'set cantidad = :cantidad',
      ExpressionAttributeValues: { ':cantidad': cantidad },
      ReturnValues: 'ALL_NEW',
    }).promise();

    return successResponse({ 
      message: 'Cantidad actualizada exitosamente', 
      product: result.Attributes 
    });
  } catch (error) {
    console.error('Error al actualizar cantidad:', error);
    return errorResponse(error.message, error.name === 'ValidationError' ? 400 : 500);
  }
};
