// src/commands/reportes/generacion.command.js
import { reportController } from '../../controllers/reportes/index.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para la generación de reportes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosGeneracion(bot) {
  // Comando principal /reporte con limpieza de mensajes
  bot.command('reporte', async (ctx) => {
    try {
      logger.info(`Comando /reporte ejecutado por usuario ${ctx.from.id}`);
      
      // Si hay un mensaje previo de reporte, intentar eliminarlo
      const previousMessageId = ctx.session?.data?.mainMessageId;
      if (previousMessageId) {
        try {
          await ctx.deleteMessage(previousMessageId);
          logger.info('Mensaje anterior de reporte eliminado');
        } catch (deleteError) {
          logger.warn('No se pudo eliminar mensaje anterior');
        }
      }
      
      // Eliminar el mensaje del comando si es posible
      try {
        await ctx.deleteMessage();
      } catch (deleteError) {
        // Es normal que falle en algunos casos
        logger.debug('No se pudo eliminar mensaje del comando');
      }
      
      await reportController.startReportGeneration(ctx);
    } catch (error) {
      logger.error(`Error en comando /reporte: ${error.message}`);
      await ctx.reply('Error al iniciar el generador de reportes. Intenta nuevamente.');
    }
  });

  // Generar el reporte final
  bot.action('generate_unified_report', async (ctx) => {
    logger.info('Callback generate_unified_report recibido');
    if (isInState(ctx, 'report_unified')) {
      const filterCount = Object.keys(ctx.session?.data?.filters || {}).length;
      
      if (filterCount === 0) {
        await ctx.answerCbQuery('Generando reporte global...', { show_alert: true });
      } else {
        await ctx.answerCbQuery(`Generando reporte con ${filterCount} filtro(s) aplicado(s)...`, { show_alert: true });
      }
      
      await reportController.generateReport(ctx);
    } else {
      logger.warn(`Estado incorrecto para generate_unified_report: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  // Cancelar todo el proceso de reporte con mensaje limpio
  bot.action('cancel_report', async (ctx) => {
    logger.info('Callback cancel_report recibido');
    
    try {
      await ctx.answerCbQuery('Reporte cancelado');
      
      // Intentar editar el mensaje para mostrar cancelación
      try {
        await ctx.editMessageText(
          '❌ *Generación de reporte cancelada*\n\n' +
          '¿Qué deseas hacer ahora?',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Nuevo reporte', callback_data: 'generate_report' }],
                [{ text: '🏠 Menú principal', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      } catch (editError) {
        await ctx.reply('Generación de reporte cancelada.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Volver al menú principal', callback_data: 'main_menu' }]
            ]
          }
        });
      }
      
      // Limpiar estado y referencias de mensajes
      if (ctx.session) {
        ctx.session.state = 'idle';
        if (ctx.session.data) {
          delete ctx.session.data.mainMessageId;
          delete ctx.session.data.currentFilter;
          // Mantener filtros por si el usuario quiere generar otro reporte
          // delete ctx.session.data.filters;
        }
      }
    } catch (error) {
      logger.error(`Error al cancelar reporte: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, vuelve al menú principal.');
    }
  });
}

/**
 * Función auxiliar para limpiar mensajes antiguos de reportes
 * @param {Object} ctx - Contexto de Telegraf
 * @param {Array} messageIds - Array de IDs de mensajes a eliminar
 */
export async function cleanupOldReportMessages(ctx, messageIds = []) {
  for (const messageId of messageIds) {
    if (messageId) {
      try {
        await ctx.deleteMessage(messageId);
        logger.debug(`Mensaje ${messageId} eliminado`);
      } catch (error) {
        // Es normal que algunos mensajes no se puedan eliminar
        logger.debug(`No se pudo eliminar mensaje ${messageId}: ${error.message}`);
      }
    }
  }
}
