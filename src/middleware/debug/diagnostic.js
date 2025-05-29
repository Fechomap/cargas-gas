// src/middleware/debug/diagnostic.js
import { logger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Middleware para diagnóstico y monitoreo
 * @param {Telegraf} bot - Instancia del bot de Telegraf
 * @param {Object} options - Opciones de configuración
 */
export function setupDiagnosticMiddleware(bot, options = {}) {
  const { 
    verbose = false,
    logToFile = true,
    logDir = 'diagnostics'
  } = options;
  
  // Middleware para registrar y diagnosticar todas las actualizaciones
  bot.use(async (ctx, next) => {
    try {
      // Registrar metadatos de la actualización
      const updateType = ctx.updateType || 'desconocido';
      const userId = ctx.from ? ctx.from.id : 'desconocido';
      const updateId = ctx.update?.update_id;
      
      // Crear objeto de diagnóstico
      const diagnostic = {
        timestamp: new Date().toISOString(),
        updateId,
        updateType,
        userId,
        chatId: ctx.chat?.id,
        chatType: ctx.chat?.type,
        tenantId: ctx.tenant?.id,
        tenant: ctx.tenant ? {
          companyName: ctx.tenant.companyName,
          isActive: ctx.tenant.isActive
        } : null
      };
      
      // Añadir detalles específicos según el tipo de actualización
      if (updateType === 'callback_query') {
        diagnostic.callbackData = ctx.callbackQuery.data;
        diagnostic.messageId = ctx.callbackQuery.message?.message_id;
        
        if (verbose) {
          logger.info(`CALLBACK: Usuario ${userId} - Datos: ${ctx.callbackQuery.data}`, diagnostic);
        }
      } else if (updateType === 'message') {
        diagnostic.messageText = ctx.message.text || 'sin texto';
        diagnostic.messageId = ctx.message.message_id;
        
        if (verbose) {
          logger.info(`MENSAJE: Usuario ${userId} - Contenido: ${diagnostic.messageText}`, diagnostic);
        }
      }
      
      // Guardar diagnóstico en archivo si está habilitado
      if (logToFile) {
        await saveDiagnosticToFile(diagnostic, logDir);
      }
      
      // Almacenar diagnóstico en el contexto para referencia
      ctx.diagnostic = diagnostic;
      
      // Medir tiempo de ejecución
      const startTime = Date.now();
      
      // Continuar con el siguiente middleware
      await next();
      
      // Calcular tiempo de procesamiento
      const processingTime = Date.now() - startTime;
      
      // Actualizar diagnóstico con tiempo de procesamiento
      ctx.diagnostic.processingTime = processingTime;
      
      if (verbose) {
        logger.debug(`Actualización ${updateId} procesada en ${processingTime}ms`);
      }
      
    } catch (error) {
      logger.error(`Error en middleware de diagnóstico: ${error.message}`, {
        error: error.stack,
        updateType: ctx.updateType,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id
      });
      
      // Continuar para que otros middlewares puedan manejar el error
      await next();
    }
  });
}

/**
 * Guarda la información de diagnóstico en un archivo
 * @param {Object} diagnostic - Datos de diagnóstico
 * @param {string} logDir - Directorio para archivos de diagnóstico
 */
async function saveDiagnosticToFile(diagnostic, logDir) {
  try {
    // Crear directorio si no existe
    await fs.mkdir(path.resolve(logDir), { recursive: true });
    
    // Generar nombre de archivo con timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `bot-diagnostic-${timestamp}.json`;
    const filePath = path.resolve(logDir, filename);
    
    // Guardar diagnóstico en archivo
    await fs.writeFile(filePath, JSON.stringify(diagnostic, null, 2), 'utf8');
    
    logger.debug(`Diagnóstico guardado: ${filename}`);
  } catch (error) {
    logger.error(`Error al guardar diagnóstico: ${error.message}`, {
      error: error.stack
    });
  }
}
