// scripts/setup.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/connection.js';
import { logger } from '../src/utils/logger.js';

/**
 * Script para configurar el entorno inicial
 * - Crea directorios necesarios
 * - Verifica la conexión a la base de datos
 * - Configura colecciones/índices iniciales
 */
async function setup() {
  logger.info('Iniciando configuración inicial...');
  
  try {
    // Crear directorios necesarios
    const directories = [
      'logs',
      'uploads',
      'temp',
      'reports'
    ];
    
    for (const dir of directories) {
      const dirPath = path.resolve(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Directorio creado: ${dirPath}`);
      } else {
        logger.info(`Directorio existente: ${dirPath}`);
      }
    }
    
    // Verificar conexión a la base de datos
    logger.info('Verificando conexión a MongoDB...');
    const connection = await connectToDatabase();
    
    if (connection) {
      logger.info('Conexión a MongoDB establecida correctamente');
      
      // Aquí se pueden crear índices, verificar colecciones, etc.
      
      // Desconectar
      await disconnectFromDatabase();
      logger.info('Configuración inicial completada');
      process.exit(0);
    } else {
      logger.error('No se pudo establecer conexión a MongoDB');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Error durante la configuración inicial: ${error.message}`);
    process.exit(1);
  }
}

setup();