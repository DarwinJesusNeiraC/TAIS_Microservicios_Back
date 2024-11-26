const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const INVENTORY_TABLE = process.env.INVENTORY_TABLE;
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL;

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

// Create entrada note
exports.createNotaEntrada = async (event) => {
  console.log('Iniciando creación de nota de entrada:', { body: event.body });

  try {
    const data = JSON.parse(event.body);
    validateInput(data);

    // Validate product exists
    try {
      await axios.get(`${PRODUCTS_SERVICE_URL}/${data.codigo}`);
    } catch (error) {
      console.error('Error validando producto:', error);
      return errorResponse(404, `Producto con código ${data.codigo} no encontrado`);
    }

    // Update product quantity
    try {
      await axios.patch(`${PRODUCTS_SERVICE_URL}/${data.codigo}`, { 
        cantidad: data.cantidad 
      });
    } catch (error) {
      console.error('Error actualizando cantidad del producto:', error);
      return errorResponse(500, 'Error al actualizar el inventario del producto');
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

    // Get current product stock
    let product;
    try {
      const response = await axios.get(`${PRODUCTS_SERVICE_URL}/${data.codigo}`);
      product = response.data;
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      return errorResponse(404, `Producto con código ${data.codigo} no encontrado`);
    }

    // Validate stock
    if (product.cantidad < data.cantidad) {
      return errorResponse(422, `Stock insuficiente. Stock actual: ${product.cantidad}`);
    }

    // Update product quantity
    try {
      await axios.patch(`${PRODUCTS_SERVICE_URL}/${data.codigo}`, {
        cantidad: product.cantidad - data.cantidad
      });
    } catch (error) {
      console.error('Error actualizando cantidad del producto:', error);
      return errorResponse(500, 'Error al actualizar el inventario del producto');
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
