// src/db/connection.js
import mongoose from 'mongoose';
import { dbConfig } from '../../config/database.config.js';
import { logger } from '../utils/logger.js';

// Variable para controlar el estado de la conexión
let isConnected = false;

/**
 * Conecta a la base de datos MongoDB
 * @returns {Promise<mongoose.Connection>} - La conexión a MongoDB
 */
export async function connectToDatabase() {
  // Si estamos en modo PostgreSQL puro, no intentar conectar a MongoDB
  if (dbConfig.mode === 'postgresql') {
    logger.info('Modo PostgreSQL puro: No se conectará a MongoDB');
    return null;
  }
  
  if (isConnected) {
    logger.info('Ya existe una conexión a MongoDB');
    return mongoose.connection;
  }

  try {
    // Verificar que tenemos las variables de entorno necesarias
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME;
    
    if (!mongoUri) {
      logger.warn('La variable de entorno MONGODB_URI no está definida. Saltando conexión a MongoDB.');
      return null;
    }
    
    // Usar await directamente en mongoose.connect
    await mongoose.connect(mongoUri, {
      dbName
    });
    
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
    throw error; // Re-lanzar error para manejo adecuado
  }
}

/**
 * Cierra la conexión a la base de datos
 */
export async function disconnectFromDatabase() {
  if (!isConnected || dbConfig.mode === 'postgresql') {
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