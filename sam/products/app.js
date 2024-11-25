const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// Crear producto
exports.createProduct = async (event) => {
  const { codigo, nombre, descripcion, cantidad, precio_unitario, categoria } = JSON.parse(event.body);

  if (!codigo || !nombre || !cantidad || !precio_unitario || !categoria) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Datos inválidos.' }) };
  }

  const product = { codigo, nombre, descripcion, cantidad, precio_unitario, categoria };

  await dynamoDB.put({ TableName: PRODUCTS_TABLE, Item: product }).promise();

  return { statusCode: 201, body: JSON.stringify(product) };
};

// Obtener producto
exports.getProduct = async (event) => {
  const { codigo } = event.pathParameters;

  const result = await dynamoDB.get({ TableName: PRODUCTS_TABLE, Key: { codigo } }).promise();

  if (!result.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Producto no encontrado.' }) };
  }

  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

// Actualizar cantidad
exports.updateQuantity = async (event) => {
  const { codigo } = event.pathParameters;
  const { cantidad } = JSON.parse(event.body);

  if (typeof cantidad !== 'number') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cantidad inválida.' }) };
  }

  const result = await dynamoDB.update({
    TableName: PRODUCTS_TABLE,
    Key: { codigo },
    UpdateExpression: 'set cantidad = :cantidad',
    ExpressionAttributeValues: { ':cantidad': cantidad },
    ReturnValues: 'ALL_NEW',
  }).promise();

  return { statusCode: 200, body: JSON.stringify(result.Attributes) };
};
