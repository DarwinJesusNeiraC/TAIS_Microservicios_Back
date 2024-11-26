const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// Helper functions
const errorResponse = (statusCode, message) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({ error: message })
});

const successResponse = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
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

// Create entrada note
exports.createNotaEntrada = async (event) => {
  console.log('Iniciando creación de nota de entrada:', { body: event.body });

  try {
    const data = JSON.parse(event.body);
    validateInput(data);

    // Validate product exists and update quantity
    try {
      const product = await getProduct(data.codigo);
      await updateProductQuantity(data.codigo, data.cantidad);
    } catch (error) {
      console.error('Error procesando producto:', error);
      return errorResponse(404, error.message);
    }

    const nota = await createInventoryNote(data, 'entrada');
    console.log('Nota de entrada creada exitosamente:', nota);

    return successResponse(201, {
      message: 'Nota de entrada creada exitosamente',
      nota
    });

  } catch (error) {
    console.error('Error procesando nota de entrada:', error);
    return errorResponse(400, error.message);
  }
};

// Create salida note
exports.createNotaSalida = async (event) => {
  console.log('Iniciando creación de nota de salida:', { body: event.body });

  try {
    const data = JSON.parse(event.body);
    validateInput(data);

    // Get current product stock and validate
    let product;
    try {
      product = await getProduct(data.codigo);
      if (product.cantidad < data.cantidad) {
        return errorResponse(422, `Stock insuficiente. Stock actual: ${product.cantidad}`);
      }

      await updateProductQuantity(data.codigo, product.cantidad - data.cantidad);
    } catch (error) {
      console.error('Error procesando producto:', error);
      return errorResponse(404, error.message);
    }

    const nota = await createInventoryNote(data, 'salida');
    console.log('Nota de salida creada exitosamente:', nota);
 
    return successResponse(201, {
      message: 'Nota de salida creada exitosamente',
      nota
    });

  } catch (error) {
    console.error('Error procesando nota de salida:', error);
    return errorResponse(400, error.message);
  }
};
