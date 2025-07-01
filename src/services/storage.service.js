// src/services/storage.service.js
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime-types';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/index.js';

// Configuración de directorios locales (fallback)
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

// Configuración de Cloudflare R2
const r2Client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Servicio mejorado para manejo de archivos con Cloudflare R2
 */
class StorageService {
  constructor() {
    this.isR2Available = this.checkR2Configuration();
    logger.info(`Storage Service inicializado. R2 disponible: ${this.isR2Available}`);
  }

  /**
   * Verifica si R2 está correctamente configurado
   * @returns {boolean}
   */
  checkR2Configuration() {
    const requiredEnvs = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
    const missing = requiredEnvs.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      logger.warn(`Variables de entorno R2 faltantes: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Genera una clave de almacenamiento organizada por tenant
   * @param {string} tenantId - ID del tenant
   * @param {string} relatedType - Tipo de relación (fuel, audit, etc)
   * @param {string} fileName - Nombre original del archivo
   * @returns {string}
   */
  generateStorageKey(tenantId, relatedType, fileName) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    
    return `${tenantId}/${year}/${month}/${relatedType}/${timestamp}_${fileName}`;
  }

  /**
   * Calcula el hash MD5 de un buffer
   * @param {Buffer} buffer - Buffer del archivo
   * @returns {string}
   */
  calculateMD5(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Guarda un archivo en R2 con metadatos
   * @param {Buffer} buffer - Contenido del archivo
   * @param {Object} metadata - Metadatos del archivo
   * @returns {Promise<Object>}
   */
  async saveFileToR2(buffer, metadata) {
    try {
      const storageKey = this.generateStorageKey(
        metadata.tenantId,
        metadata.relatedType,
        metadata.fileName
      );

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: storageKey,
        Body: buffer,
        ContentType: metadata.fileType,
        Metadata: {
          tenantId: metadata.tenantId,
          relatedId: metadata.relatedId || '',
          relatedType: metadata.relatedType,
          uploadedBy: metadata.uploadedBy,
          originalName: metadata.fileName,
        },
      });

      await r2Client.send(command);
      
      logger.info(`Archivo subido a R2: ${storageKey}`);
      return { storageKey, success: true };
    } catch (error) {
      logger.error(`Error al subir archivo a R2: ${error.message}`);
      throw error;
    }
  }

  /**
   * Guarda archivo localmente como fallback
   * @param {Buffer} buffer - Contenido del archivo
   * @param {Object} metadata - Metadatos del archivo
   * @returns {Promise<Object>}
   */
  async saveFileLocally(buffer, metadata) {
    try {
      const uniqueId = uuidv4();
      const fileExt = path.extname(metadata.fileName) || '.jpg';
      const fileName = `${uniqueId}${fileExt}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      
      await fsPromises.writeFile(filePath, buffer);
      
      logger.info(`Archivo guardado localmente: ${filePath}`);
      return { storageKey: filePath, success: true };
    } catch (error) {
      logger.error(`Error al guardar archivo localmente: ${error.message}`);
      throw error;
    }
  }

  /**
   * Guarda un archivo con metadatos completos
   * @param {Buffer} buffer - Contenido del archivo
   * @param {Object} metadata - Metadatos del archivo
   * @returns {Promise<Object>}
   */
  async saveFile(buffer, metadata) {
    try {
      // Validar metadatos requeridos
      const requiredFields = ['tenantId', 'relatedType', 'fileName', 'uploadedBy'];
      const missing = requiredFields.filter(field => !metadata[field]);
      
      if (missing.length > 0) {
        throw new Error(`Metadatos faltantes: ${missing.join(', ')}`);
      }

      // Detectar tipo MIME
      const fileType = mime.lookup(metadata.fileName) || 'application/octet-stream';
      const fileSize = buffer.length;
      const md5Hash = this.calculateMD5(buffer);

      // Intentar guardar en R2, fallback a local
      let storageResult;
      let isR2Storage = false;

      if (this.isR2Available) {
        try {
          storageResult = await this.saveFileToR2(buffer, { ...metadata, fileType });
          isR2Storage = true;
        } catch (r2Error) {
          logger.warn(`R2 falló, usando fallback local: ${r2Error.message}`);
          storageResult = await this.saveFileLocally(buffer, { ...metadata, fileType });
        }
      } else {
        storageResult = await this.saveFileLocally(buffer, { ...metadata, fileType });
      }

      // Guardar metadatos en base de datos
      const fileRecord = await prisma.fileStorage.create({
        data: {
          tenantId: metadata.tenantId,
          relatedId: metadata.relatedId,
          relatedType: metadata.relatedType,
          fileName: metadata.fileName,
          fileType,
          fileSize,
          storageKey: storageResult.storageKey,
          uploadedBy: metadata.uploadedBy,
        },
      });

      logger.info(`Archivo guardado con ID: ${fileRecord.id}, R2: ${isR2Storage}`);

      return {
        id: fileRecord.id,
        storageKey: storageResult.storageKey,
        isR2Storage,
        fileSize,
        fileType,
      };
    } catch (error) {
      logger.error(`Error al guardar archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Genera URL firmada para acceso temporal
   * @param {string} fileId - ID del archivo en BD
   * @param {number} expiresIn - Segundos de expiración (default: 24h)
   * @returns {Promise<string>}
   */
  async getSignedUrl(fileId, expiresIn = 86400) {
    try {
      const fileRecord = await prisma.fileStorage.findUnique({
        where: { id: fileId, isActive: true },
      });

      if (!fileRecord) {
        throw new Error('Archivo no encontrado');
      }

      // Si es almacenamiento local, devolver ruta directa
      if (!this.isR2Available || fileRecord.storageKey.startsWith('/')) {
        return fileRecord.storageKey;
      }

      // Generar URL firmada para R2
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileRecord.storageKey,
      });

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
      
      logger.info(`URL firmada generada para archivo: ${fileId}`);
      return signedUrl;
    } catch (error) {
      logger.error(`Error al generar URL firmada: ${error.message}`);
      throw error;
    }
  }

  /**
   * Guarda una foto desde Telegram (método actualizado)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fileId - ID del archivo en Telegram
   * @param {Object} metadata - Metadatos adicionales
   * @returns {Promise<Object>}
   */
  async savePhotoFromTelegram(ctx, fileId, metadata = {}) {
    try {
      logger.info(`Iniciando guardado de foto desde Telegram. FileID: ${fileId}`);
      
      // Obtener URL del archivo
      const fileUrl = await ctx.telegram.getFileLink(fileId);
      logger.info(`URL obtenida de Telegram: ${fileUrl}`);
      
      // Descargar archivo
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      logger.info(`Archivo descargado. Tamaño: ${buffer.length} bytes`);
      
      // Preparar metadatos
      const fileMetadata = {
        fileName: `telegram_photo_${Date.now()}.jpg`,
        relatedType: 'fuel',
        ...metadata,
      };

      // Guardar archivo usando el nuevo sistema
      const result = await this.saveFile(buffer, fileMetadata);
      
      logger.info(`Foto de Telegram guardada exitosamente: ${result.id}`);
      return result;
    } catch (error) {
      logger.error(`Error al guardar foto de Telegram: ${error.message}`);
      throw error;
    }
  }

  /**
   * Elimina un archivo (borrado lógico)
   * @param {string} fileId - ID del archivo
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      await prisma.fileStorage.update({
        where: { id: fileId },
        data: { isActive: false },
      });
      
      logger.info(`Archivo marcado como eliminado: ${fileId}`);
    } catch (error) {
      logger.error(`Error al eliminar archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista archivos por tenant y filtros
   * @param {string} tenantId - ID del tenant
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>}
   */
  async listFiles(tenantId, filters = {}) {
    try {
      const where = {
        tenantId,
        isActive: true,
        ...filters,
      };

      const files = await prisma.fileStorage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return files;
    } catch (error) {
      logger.error(`Error al listar archivos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea un archivo temporal (método legacy para compatibilidad)
   * @param {Buffer|string} content - Contenido del archivo
   * @param {string} extension - Extensión del archivo
   * @returns {Promise<Object>}
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
}

export const storageService = new StorageService();