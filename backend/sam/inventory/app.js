const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// Response handlers
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

const successResponse = (data, message = 'Operation successful') => 
  createResponse(200, {
    success: true,
    message,
    data
  });

const errorResponse = (error, statusCode = 400) => 
  createResponse(statusCode, {
    success: false,
    error: error.message || error
  });

const validateInput = (data) => {
  const { fecha, codigo, cantidad } = data;
  
  if (!fecha || !codigo || !cantidad) {
    throw new Error('Campos requeridos: fecha, codigo, cantidad');
  }
  
  if (typeof cantidad !== 'number' || cantidad <= 0) {
    throw new Error('La cantidad debe ser un número positivo');
  }

  if (!(fecha instanceof Date) && isNaN(new Date(fecha).getTime())) {
    throw new Error('Fecha inválida');
  }

  return true;
};

const createInventoryNote = async (data, tipo) => {
  const nota = {
    id: uuidv4(),
    fecha: new Date(data.fecha).toISOString(),
    codigo: data.codigo,
    cantidad: data.cantidad,
    tipo,
    createdAt: new Date().toISOString()
  };

  await dynamoDB.put({
    TableName: INVENTORY_TABLE,
    Item: nota
  }).promise();

  return nota;
};

const getProduct = async (codigo) => {
  const result = await dynamoDB.get({
    TableName: PRODUCTS_TABLE,
    Key: { codigo }
  }).promise();
  
  if (!result.Item) {
    throw new Error(`Producto con código ${codigo} no encontrado`);
  }
  
  return result.Item;
};

const updateProductQuantity = async (codigo, newQuantity) => {
  await dynamoDB.update({
    TableName: PRODUCTS_TABLE,
    Key: { codigo },
    UpdateExpression: 'set cantidad = :cantidad',
    ExpressionAttributeValues: {
      ':cantidad': newQuantity
    }
  }).promise();
};

const processInventoryNote = async (data, tipo) => {
  const product = await getProduct(data.codigo);
  
  const newQuantity = tipo === 'entrada' 
    ? product.cantidad + data.cantidad
    : product.cantidad - data.cantidad;

  if (tipo === 'salida' && newQuantity < 0) {
    throw new Error(`Stock insuficiente. Stock actual: ${product.cantidad}`);
  }

  await updateProductQuantity(data.codigo, newQuantity);
  const nota = await createInventoryNote(data, tipo);
  
  return {
    nota,
    product: {
      codigo: product.codigo,
      previousQuantity: product.cantidad,
      newQuantity
    }
  };
};

exports.createNotaEntrada = async (event) => {
  try {
    const data = JSON.parse(event.body);
    validateInput(data);

    const result = await processInventoryNote(data, 'entrada');
    return successResponse(result, 'Nota de entrada creada exitosamente');

  } catch (error) {
    console.error('Error procesando nota de entrada:', error);
    return errorResponse(error);
  }
};

exports.createNotaSalida = async (event) => {
  try {
    const data = JSON.parse(event.body);
    validateInput(data);

    const result = await processInventoryNote(data, 'salida');
    return successResponse(result, 'Nota de salida creada exitosamente');

  } catch (error) {
    console.error('Error procesando nota de salida:', error);
    return errorResponse(error);
  }
};
