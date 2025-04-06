// src/db/connection.js
import mongoose from 'mongoose';
import { dbConfig } from '../../config/db.config.js';
import { logger } from '../utils/logger.js';

// Variable para controlar el estado de la conexión
let isConnected = false;

/**
 * Conecta a la base de datos MongoDB
 * @returns {Promise<mongoose.Connection>} - La conexión a MongoDB
 */
export async function connectToDatabase() {
  if (isConnected) {
    logger.info('Ya existe una conexión a MongoDB');
    return mongoose.connection;
  }

  try {
    await mongoose.connect(dbConfig.uri, dbConfig.options);
    
    isConnected = true;
    logger.info('Conexión exitosa a MongoDB');
    
    mongoose.connection.on('error', (err) => {
      logger.error('Error en la conexión a MongoDB:', err);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('Desconexión de MongoDB');
      isConnected = false;
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error('Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

/**
 * Cierra la conexión a la base de datos
 */
export async function disconnectFromDatabase() {
  if (!isConnected) {
    return;
  }
  
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Desconexión exitosa de MongoDB');
  } catch (error) {
    logger.error('Error al desconectar de MongoDB:', error);
  }
}