// src/commands/unified-report.command.js - VERSIÓN CON INTERFAZ LIMPIA
import { unifiedReportController } from '../controllers/unified-report.controller.js';
import { isInState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Configuración unificada de comandos de reportes con interfaz limpia
 */
export function setupUnifiedReportCommand(bot) {
  logger.info('Configurando comandos unificados de reportes con interfaz limpia');

  // Comando para marcar todas las cargas como pagadas
  bot.command(['pagar_todas', 'pay_all'], async (ctx) => {
    try {
      logger.info(`Comando para marcar todas como pagadas ejecutado por usuario ${ctx.from.id}`);
      await unifiedReportController.markAllAsPaid(ctx);
    } catch (error) {
      logger.error(`Error al marcar todas como pagadas: ${error.message}`);
      await ctx.reply('❌ Error: No se pudieron marcar las cargas como pagadas.');
    }
  });

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
      
      await unifiedReportController.startReportGeneration(ctx);
    } catch (error) {
      logger.error(`Error en comando /reporte: ${error.message}`);
      await ctx.reply('Error al iniciar el generador de reportes. Intenta nuevamente.');
    }
  });

  // Handler para ignorar clicks en separadores
  bot.action('ignore', async (ctx) => {
    await ctx.answerCbQuery();
  });

  // Handlers específicos para cada filtro con feedback mejorado
  bot.action('filter_date', async (ctx) => {
    logger.info('Callback filter_date recibido');
    if (isInState(ctx, 'report_unified')) {
      await ctx.answerCbQuery('Cargando opciones de fecha...', { show_alert: false });
      await unifiedReportController.handleFilterSelection(ctx, 'date');
    } else {
      logger.warn(`Estado incorrecto para filter_date: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  bot.action('filter_operator', async (ctx) => {
    logger.info('Callback filter_operator recibido');
    if (isInState(ctx, 'report_unified')) {
      await ctx.answerCbQuery('Cargando operadores...', { show_alert: false });
      await unifiedReportController.handleFilterSelection(ctx, 'operator');
    } else {
      logger.warn(`Estado incorrecto para filter_operator: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  bot.action('filter_fuelType', async (ctx) => {
    logger.info('Callback filter_fuelType recibido');
    if (isInState(ctx, 'report_unified')) {
      await ctx.answerCbQuery('Cargando tipos de combustible...', { show_alert: false });
      await unifiedReportController.handleFilterSelection(ctx, 'fuelType');
    } else {
      logger.warn(`Estado incorrecto para filter_fuelType: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  bot.action('filter_paymentStatus', async (ctx) => {
    logger.info('Callback filter_paymentStatus recibido');
    if (isInState(ctx, 'report_unified')) {
      await ctx.answerCbQuery('Cargando estados de pago...', { show_alert: false });
      await unifiedReportController.handleFilterSelection(ctx, 'paymentStatus');
    } else {
      logger.warn(`Estado incorrecto para filter_paymentStatus: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  // Manejador unificado para valores de filtros con validación mejorada
  bot.action(/^filter_value_(.+)$/, async (ctx) => {
    const value = ctx.match[1];
    logger.info(`Callback filter_value recibido con valor: ${value}`);
    
    if (isInState(ctx, 'report_filter_input')) {
      await ctx.answerCbQuery('Aplicando filtro...', { show_alert: false });
      await unifiedReportController.processFilterValue(ctx, value);
    } else {
      logger.warn(`Estado incorrecto para filter_value: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  // Acción de generar reporte con confirmación visual
  bot.action('generate_unified_report', async (ctx) => {
    logger.info('Callback generate_unified_report recibido');
    if (isInState(ctx, 'report_unified')) {
      // Mostrar alerta de confirmación con información sobre filtros
      const filterCount = Object.keys(ctx.session?.data?.filters || {}).length;
      
      if (filterCount === 0) {
        await ctx.answerCbQuery('Generando reporte global...', { show_alert: true });
      } else {
        await ctx.answerCbQuery(`Generando reporte con ${filterCount} filtro(s) aplicado(s)...`, { show_alert: true });
      }
      
      await unifiedReportController.generateReport(ctx);
    } else {
      logger.warn(`Estado incorrecto para generate_unified_report: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  // Limpiar filtros con confirmación visual
  bot.action('clear_filters', async (ctx) => {
    logger.info('Callback clear_filters recibido');
    if (isInState(ctx, 'report_unified')) {
      const filterCount = Object.keys(ctx.session?.data?.filters || {}).length;
      await ctx.answerCbQuery(`Eliminando ${filterCount} filtro(s)...`, { show_alert: true });
      await unifiedReportController.clearFilters(ctx);
    } else {
      logger.warn(`Estado incorrecto para clear_filters: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });

  // Cancelar filtro individual con navegación mejorada
  bot.action('cancel_filter', async (ctx) => {
    logger.info('Callback cancel_filter recibido');
    if (isInState(ctx, 'report_filter_input')) {
      await ctx.answerCbQuery('Cancelado');
      await unifiedReportController.cancelFilter(ctx);
    } else {
      logger.warn(`Estado incorrecto para cancel_filter: ${ctx.session?.state}`);
      await ctx.answerCbQuery('Volviendo...');
      // Intentar volver al menú de reportes
      await unifiedReportController.startReportGeneration(ctx);
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

  logger.info('Comandos unificados de reportes configurados correctamente con interfaz limpia');
}

/**
 * Función auxiliar para limpiar mensajes antiguos de reportes
 * @param {Object} ctx - Contexto de Telegraf
 * @param {Array} messageIds - Array de IDs de mensajes a eliminar
 */
async function cleanupOldReportMessages(ctx, messageIds = []) {
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