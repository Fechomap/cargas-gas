// src/commands/reportes/acciones.command.js
import { unifiedReportController } from '../../controllers/unified-report.controller.js';
import { isInState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para acciones especiales en reportes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosAcciones(bot) {
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
  
  // Acción para formato de descarga de reporte
  bot.action(/^report_format_(.+)$/, async (ctx) => {
    const format = ctx.match[1]; // pdf o excel
    logger.info(`Formato de reporte seleccionado: ${format}`);
    
    if (isInState(ctx, 'report_format_selection')) {
      await ctx.answerCbQuery(`Generando reporte en formato ${format.toUpperCase()}...`);
      await unifiedReportController.generateReportWithFormat(ctx, format);
    } else {
      logger.warn(`Estado incorrecto para report_format: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });
  
  // Acción para enviar el reporte por correo
  bot.action('send_report_email', async (ctx) => {
    logger.info('Solicitud para enviar reporte por correo');
    if (isInState(ctx, 'report_delivery_option')) {
      await ctx.answerCbQuery('Preparando envío por correo...');
      await unifiedReportController.requestEmailForReport(ctx);
    } else {
      logger.warn(`Estado incorrecto para send_report_email: ${ctx.session?.state}`);
      await ctx.answerCbQuery('⚠️ Sesión expirada. Usa /reporte para comenzar de nuevo.');
    }
  });
  
  // Manejar entrada de texto para correo electrónico
  bot.on('text', async (ctx, next) => {
    if (isInState(ctx, 'report_email_input')) {
      logger.info(`Recibido correo para envío de reporte: ${ctx.message.text}`);
      await unifiedReportController.handleEmailInput(ctx, ctx.message.text);
      return;
    }
    // Continuar con siguiente middleware si no estamos en estado de entrada de correo
    return next();
  });
}
