const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

/**
 * Helper: Responder con un error formateado.
 */
const errorResponse = (statusCode, message) => ({
  statusCode,
  body: JSON.stringify({ error: message }),
});

/**
 * Crear producto
 */
exports.createProduct = async (event) => {
  console.log('Recibiendo solicitud para crear un producto:', event.body);

  try {
    const { codigo, nombre, descripcion, cantidad, precio_unitario, categoria } = JSON.parse(event.body);

    // Validar campos obligatorios
    if (!codigo || !nombre || !cantidad || !precio_unitario || !categoria) {
      return errorResponse(400, 'Todos los campos son obligatorios: codigo, nombre, cantidad, precio_unitario, categoria.');
    }

    // Validar valores numéricos positivos
    if (cantidad < 0 || precio_unitario < 0) {
      return errorResponse(400, 'Los valores de cantidad y precio_unitario deben ser positivos.');
    }

    // Preparar el producto
    const product = {
      codigo,
      nombre,
      descripcion: descripcion || '',
      cantidad,
      precio_unitario,
      categoria,
    };

    // Guardar en DynamoDB
    await dynamoDB.put({ TableName: PRODUCTS_TABLE, Item: product }).promise();

    console.log('Producto creado exitosamente:', product);

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Producto creado exitosamente', product }),
    };
  } catch (error) {
    console.error('Error al crear producto:', error);
    return errorResponse(500, 'Hubo un error interno al crear el producto.');
  }
};

/**
 * Obtener producto por código
 */
exports.getProduct = async (event) => {
  console.log('Recibiendo solicitud para obtener producto:', event.pathParameters);

  try {
    const { codigo } = event.pathParameters;

    if (!codigo) {
      return errorResponse(400, 'El parámetro "codigo" es obligatorio.');
    }

    // Consultar en DynamoDB
    const result = await dynamoDB.get({ TableName: PRODUCTS_TABLE, Key: { codigo } }).promise();

    if (!result.Item) {
      return errorResponse(404, `Producto con código "${codigo}" no encontrado.`);
    }

    console.log('Producto encontrado:', result.Item);

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return errorResponse(500, 'Hubo un error interno al obtener el producto.');
  }
};

/**
 * Listar productos
 */
exports.listProducts = async () => {
  console.log('Recibiendo solicitud para listar productos');

  try {
    // Consultar DynamoDB
    const result = await dynamoDB.scan({ TableName: PRODUCTS_TABLE }).promise();

    console.log('Productos obtenidos:', result.Items);

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error('Error al listar productos:', error);
    return errorResponse(500, 'Hubo un error interno al listar los productos.');
  }
};

/**
 * Actualizar cantidad de producto
 */
exports.updateQuantity = async (event) => {
  console.log('Recibiendo solicitud para actualizar cantidad:', event.body);

  try {
    const { codigo } = event.pathParameters;
    const { cantidad } = JSON.parse(event.body);

    if (!codigo || typeof cantidad !== 'number') {
      return errorResponse(400, 'El parámetro "codigo" y un valor numérico para "cantidad" son obligatorios.');
    }

    if (cantidad < 0) {
      return errorResponse(400, 'El valor de "cantidad" debe ser positivo.');
    }

    // Actualizar la cantidad en DynamoDB
    const result = await dynamoDB.update({
      TableName: PRODUCTS_TABLE,
      Key: { codigo },
      UpdateExpression: 'set cantidad = :cantidad',
      ExpressionAttributeValues: { ':cantidad': cantidad },
      ReturnValues: 'ALL_NEW',
    }).promise();

    console.log('Cantidad actualizada exitosamente:', result.Attributes);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Cantidad actualizada exitosamente', product: result.Attributes }),
    };
  } catch (error) {
    console.error('Error al actualizar cantidad:', error);
    return errorResponse(500, 'Hubo un error interno al actualizar la cantidad del producto.');
  }
};
