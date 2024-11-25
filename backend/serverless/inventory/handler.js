const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL;

// Crear nota de entrada
module.exports.createNotaEntrada = async (event) => {
  const { fecha, codigo, cantidad } = JSON.parse(event.body);

  if (!fecha || !codigo || typeof cantidad !== 'number' || cantidad <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Datos inválidos.' }) };
  }

  const id = uuidv4();

  // Actualizar producto en Productos
  await axios.patch(`${PRODUCTS_SERVICE_URL}/${codigo}`, { cantidad });

  // Registrar nota
  const nota = { id, fecha, codigo, cantidad, tipo: 'entrada' };
  await dynamoDB.put({ TableName: INVENTORY_TABLE, Item: nota }).promise();

  return { statusCode: 201, body: JSON.stringify(nota) };
};

// Crear nota de salida
module.exports.createNotaSalida = async (event) => {
  const { fecha, codigo, cantidad } = JSON.parse(event.body);

  if (!fecha || !codigo || typeof cantidad !== 'number' || cantidad <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Datos inválidos.' }) };
  }

  const id = uuidv4();

  // Obtener producto y validar stock
  const productResponse = await axios.get(`${PRODUCTS_SERVICE_URL}/${codigo}`);
  const product = productResponse.data;

  if (!product || product.cantidad < cantidad) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Stock insuficiente.' }) };
  }

  // Actualizar producto en Productos
  await axios.patch(`${PRODUCTS_SERVICE_URL}/${codigo}`, { cantidad: product.cantidad - cantidad });

  // Registrar nota
  const nota = { id, fecha, codigo, cantidad, tipo: 'salida' };
  await dynamoDB.put({ TableName: INVENTORY_TABLE, Item: nota }).promise();

  return { statusCode: 201, body: JSON.stringify(nota) };
};
