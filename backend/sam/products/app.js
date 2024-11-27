const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// Common response headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT'
};

// Response utility functions
const buildResponse = (statusCode, data) => ({
  statusCode,
  headers,
  body: JSON.stringify(data)
});

const successResponse = (data, statusCode = 200) => buildResponse(statusCode, { success: true, data });
const errorResponse = (message, statusCode = 500) => buildResponse(statusCode, { success: false, error: message });

// Validation utility functions
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

const validateQuantity = (cantidad) => {
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new Error('La cantidad debe ser un número entero positivo.');
  }
};

// Main handlers
exports.createProduct = async (event) => {
  console.log('Recibiendo solicitud para crear un producto:', event.body);

  try {
    const product = JSON.parse(event.body);
    validateProduct(product);

    const existingProduct = await dynamoDB.get({
      TableName: PRODUCTS_TABLE,
      Key: { codigo: product.codigo }
    }).promise();

    if (existingProduct.Item) {
      return errorResponse('Código de producto duplicado', 409);
    }

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

exports.getProduct = async (event) => {
  console.log('Recibiendo solicitud para obtener producto:', event.pathParameters);

  try {
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

exports.listProducts = async () => {
  console.log('Recibiendo solicitud para listar productos');

  try {
    const result = await dynamoDB.scan({ TableName: PRODUCTS_TABLE }).promise();
    return successResponse(result.Items);
  } catch (error) {
    console.error('Error al listar productos:', error);
    return errorResponse('Hubo un error interno al listar los productos.');
  }
};

exports.updateQuantity = async (event) => {
  console.log('Recibiendo solicitud para actualizar cantidad:', event.body);

  try {
    const { codigo } = event.pathParameters;
    const { cantidad } = JSON.parse(event.body);

    if (!codigo) return errorResponse('El parámetro "codigo" es obligatorio.', 400);
    validateQuantity(cantidad);

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
