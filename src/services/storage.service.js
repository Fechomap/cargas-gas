// src/services/storage.service.js
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Crear directorio de almacenamiento si no existe
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const TEMP_DIR = path.resolve(process.cwd(), 'temp');

// Asegurar que los directorios existan
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch (error) {
  logger.error(`Error al crear directorios de almacenamiento: ${error.message}`);
}

/**
 * Servicio para manejo de archivos
 */
class StorageService {
  /**
   * Guarda una foto desde Telegram
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fileId - ID del archivo en Telegram
   * @returns {Promise<string>} - URL o ruta del archivo guardado
   */
  async savePhotoFromTelegram(ctx, fileId) {
    try {
      // Obtener URL del archivo
      const fileUrl = await ctx.telegram.getFileLink(fileId);
      
      // Descargar archivo
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      
      // Generar nombre único
      const uniqueId = uuidv4();
      const fileExt = 'jpg'; // Telegram convierte las imágenes a JPEG
      const fileName = `${uniqueId}.${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      
      // Guardar archivo
      await fsPromises.writeFile(filePath, Buffer.from(buffer));
      
      logger.info(`Foto guardada: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`Error al guardar foto: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Crea un archivo temporal
   * @param {Buffer|string} content - Contenido del archivo
   * @param {string} extension - Extensión del archivo
   * @returns {Promise<Object>} - Información del archivo
   */
  async createTempFile(content, extension) {
    try {
      const uniqueId = uuidv4();
      const fileName = `${uniqueId}.${extension}`;
      const filePath = path.join(TEMP_DIR, fileName);
      
      await fsPromises.writeFile(filePath, content);
      
      return {
        filename: fileName,
        path: filePath
      };
    } catch (error) {
      logger.error(`Error al crear archivo temporal: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Elimina un archivo
   * @param {string} filePath - Ruta del archivo a eliminar
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      await fsPromises.unlink(filePath);
      logger.info(`Archivo eliminado: ${filePath}`);
    } catch (error) {
      logger.error(`Error al eliminar archivo: ${error.message}`);
      // No lanzar error, solo registrar
    }
  }
}

export const storageService = new StorageService();