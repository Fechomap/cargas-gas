// src/commands/unified-report.command.js - VERSIÓN CORREGIDA
import { unifiedReportController } from '../controllers/unified-report.controller.js';
import { isInState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Configuración unificada de comandos de reportes
 */
export function setupUnifiedReportCommand(bot) {
  logger.info('Configurando comandos unificados de reportes');

  // Comando principal
  bot.command('reporte', async (ctx) => {
    logger.info('Comando /reporte ejecutado');
    await unifiedReportController.startReportGeneration(ctx);
  });

  // CORREGIDO: Handlers específicos para cada filtro
  bot.action('filter_date', async (ctx) => {
    logger.info('Callback filter_date recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.handleFilterSelection(ctx, 'date');
    } else {
      logger.warn(`Estado incorrecto para filter_date: ${ctx.session?.state}`);
    }
  });

  bot.action('filter_operator', async (ctx) => {
    logger.info('Callback filter_operator recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.handleFilterSelection(ctx, 'operator');
    } else {
      logger.warn(`Estado incorrecto para filter_operator: ${ctx.session?.state}`);
    }
  });

  bot.action('filter_fuelType', async (ctx) => {
    logger.info('Callback filter_fuelType recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.handleFilterSelection(ctx, 'fuelType');
    } else {
      logger.warn(`Estado incorrecto para filter_fuelType: ${ctx.session?.state}`);
    }
  });

  bot.action('filter_paymentStatus', async (ctx) => {
    logger.info('Callback filter_paymentStatus recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.handleFilterSelection(ctx, 'paymentStatus');
    } else {
      logger.warn(`Estado incorrecto para filter_paymentStatus: ${ctx.session?.state}`);
    }
  });

  // Manejador unificado para valores de filtros
  bot.action(/^filter_value_(.+)$/, async (ctx) => {
    const value = ctx.match[1];
    logger.info(`Callback filter_value recibido con valor: ${value}`);
    
    if (isInState(ctx, 'report_filter_input')) {
      await unifiedReportController.processFilterValue(ctx, value);
    } else {
      logger.warn(`Estado incorrecto para filter_value: ${ctx.session?.state}`);
    }
  });

  // Acciones de reporte
  bot.action('generate_unified_report', async (ctx) => {
    logger.info('Callback generate_unified_report recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.generateReport(ctx);
    } else {
      logger.warn(`Estado incorrecto para generate_unified_report: ${ctx.session?.state}`);
    }
  });

  bot.action('clear_filters', async (ctx) => {
    logger.info('Callback clear_filters recibido');
    if (isInState(ctx, 'report_unified')) {
      await unifiedReportController.clearFilters(ctx);
    } else {
      logger.warn(`Estado incorrecto para clear_filters: ${ctx.session?.state}`);
    }
  });

  bot.action('cancel_filter', async (ctx) => {
    logger.info('Callback cancel_filter recibido');
    if (isInState(ctx, 'report_filter_input')) {
      await unifiedReportController.cancelFilter(ctx);
    } else {
      logger.warn(`Estado incorrecto para cancel_filter: ${ctx.session?.state}`);
    }
  });

  bot.action('cancel_report', async (ctx) => {
    logger.info('Callback cancel_report recibido');
    await ctx.answerCbQuery('Reporte cancelado');
    await ctx.reply('Generación de reporte cancelada.');
    
    // Volver al menú principal
    await ctx.reply('¿Qué deseas hacer ahora?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Volver al menú principal', callback_data: 'main_menu' }]
        ]
      }
    });
  });

  logger.info('Comandos unificados de reportes configurados correctamente');
}