const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

/**
 * Response Helpers
 */
const createResponse = (statusCode, data, message = null) => ({
  statusCode,
  body: JSON.stringify({
    success: statusCode >= 200 && statusCode < 300,
    data,
    message,
    timestamp: new Date().toISOString()
  })
});

const successResponse = (data, message = null, statusCode = 200) => 
  createResponse(statusCode, data, message);

const errorResponse = (statusCode, message, error = null) => 
  createResponse(statusCode, null, message);

/**
 * Validation Helpers
 */
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

/**
 * Database Helpers
 */
const getProductByCode = async (codigo) => {
  const result = await dynamoDB.get({ 
    TableName: PRODUCTS_TABLE, 
    Key: { codigo } 
  }).promise();
  return result.Item;
};

exports.createProduct = async (event) => {
  console.log('Recibiendo solicitud para crear un producto:', event.body);

  try {
    const product = JSON.parse(event.body);
    validateProduct(product);

    const existingProduct = await getProductByCode(product.codigo);
    if (existingProduct) {
      return errorResponse(409, 'Código de producto duplicado');
    }

    await dynamoDB.put({ 
      TableName: PRODUCTS_TABLE, 
      Item: {
        ...product,
        descripcion: product.descripcion || ''
      }
    }).promise();

    return successResponse(product, 'Producto creado exitosamente', 201);
  } catch (error) {
    console.error('Error al crear producto:', error);
    return errorResponse(
      error.statusCode || 500,
      error.message || 'Hubo un error interno al crear el producto.'
    );
  }
};

exports.getProduct = async (event) => {
  console.log('Recibiendo solicitud para obtener producto:', event.pathParameters);

  try {
    const { codigo } = event.pathParameters;
    if (!codigo) {
      return errorResponse(400, 'El parámetro "codigo" es obligatorio.');
    }

    const product = await getProductByCode(codigo);
    if (!product) {
      return errorResponse(404, `Producto con código "${codigo}" no encontrado.`);
    }

    return successResponse(product);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return errorResponse(500, 'Hubo un error interno al obtener el producto.');
  }
};

exports.listProducts = async () => {
  console.log('Recibiendo solicitud para listar productos');

  try {
    const result = await dynamoDB.scan({ TableName: PRODUCTS_TABLE }).promise();
    return successResponse(result.Items);
  } catch (error) {
    console.error('Error al listar productos:', error);
    return errorResponse(500, 'Hubo un error interno al listar los productos.');
  }
};

exports.updateQuantity = async (event) => {
  console.log('Recibiendo solicitud para actualizar cantidad:', event.body);

  try {
    const { codigo } = event.pathParameters;
    const { cantidad } = JSON.parse(event.body);

    if (!codigo || typeof cantidad !== 'number') {
      return errorResponse(400, 'El parámetro "codigo" y un valor numérico para "cantidad" son obligatorios.');
    }

    if (!Number.isInteger(cantidad) || cantidad < 0) {
      return errorResponse(400, 'La cantidad debe ser un número entero positivo.');
    }

    const result = await dynamoDB.update({
      TableName: PRODUCTS_TABLE,
      Key: { codigo },
      UpdateExpression: 'set cantidad = :cantidad',
      ExpressionAttributeValues: { ':cantidad': cantidad },
      ReturnValues: 'ALL_NEW',
    }).promise();

    return successResponse(
      result.Attributes, 
      'Cantidad actualizada exitosamente'
    );
  } catch (error) {
    console.error('Error al actualizar cantidad:', error);
    return errorResponse(500, 'Hubo un error interno al actualizar la cantidad del producto.');
  }
};
