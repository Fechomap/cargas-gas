// src/commands/reportes/filtros.command.js
import { unifiedReportController } from '../../controllers/unified-report.controller.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para el manejo de filtros en reportes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosFiltros(bot) {
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

  // Manejar selección de valores específicos para filtros
  bot.action(/^filter_value_(.+)$/, async (ctx) => {
    const filterValue = ctx.match[1];
    logger.info(`Selección de valor de filtro: ${filterValue}`);
    
    if (isInState(ctx, 'report_filter_input')) {
      await ctx.answerCbQuery('Aplicando filtro...');
      await unifiedReportController.processFilterValue(ctx, filterValue);
    } else {
      logger.warn(`Estado incorrecto para filter_value: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });
}
