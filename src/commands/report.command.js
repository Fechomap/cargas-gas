// src/commands/report.command.js
import { Markup } from 'telegraf';
import { reportController } from '../controllers/report.controller.js';
import { isInState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { getMainKeyboard } from '../views/keyboards.js';


/**
 * Configura los comandos para generación de reportes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupReportCommand(bot) {
  // Comando /reporte
  bot.command('reporte', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} solicitó generación de reporte`);
      
      // CORRECCIÓN: Añadir logs para trazar el flujo
      logger.info('Llamando a reportController.startReportGeneration()');
      await reportController.startReportGeneration(ctx);
      logger.info('Finalizada llamada a startReportGeneration');
    } catch (error) {
      logger.error(`Error en comando reporte: ${error.message}`, error);
      await ctx.reply('Ocurrió un error al iniciar la generación del reporte.');
      
      // Mostrar menú incluso después del error
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });
  
  // Botón para generar reporte
  bot.action('generate_report', async (ctx) => {
    try {
      await ctx.answerCbQuery('Iniciando generación de reporte...');
      await reportController.startReportGeneration(ctx);
    } catch (error) {
      logger.error(`Error al iniciar reporte: ${error.message}`);
      await ctx.answerCbQuery('Error al iniciar reporte');
      await ctx.reply('Ocurrió un error al iniciar la generación del reporte.');
    }
  });
  
  // Filtro por fecha
  bot.action('filter_by_date', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.handleDateFilterSelection(ctx);
    }
  });

  // Cancelar selección de fecha
  bot.action('cancel_date_filter', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      await ctx.answerCbQuery('Selección cancelada');
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      const cancelMsg = await ctx.reply('Selección de fechas cancelada.');
      
      // Volver al menú principal
      await reportController.startReportGeneration(ctx);
      
      // Eliminar mensaje de cancelación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(cancelMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    }
  });

  // Manejar rangos predefinidos
  bot.action('date_range_today', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'today');
    }
  });

  bot.action('date_range_this_week', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'this_week');
    }
  });

  bot.action('date_range_last_2_weeks', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'last_2_weeks');
    }
  });

  bot.action('date_range_last_3_weeks', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'last_3_weeks');
    }
  });

  bot.action('date_range_this_month', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'this_month');
    }
  });

  bot.action('date_range_last_3_months', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handlePredefinedDateRange(ctx, 'last_3_months');
    }
  });

  // Manejar selección de fechas personalizadas
  bot.action('date_range_custom', async (ctx) => {
    if (isInState(ctx, 'report_select_date_range')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de fechas eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de fechas: ${err.message}`);
        }
      }
      
      await reportController.handleCustomDateRangeSelection(ctx);
    }
  });
  
  // Filtro por operador
  bot.action('filter_by_operator', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.handleOperatorFilterSelection(ctx);
    }
  });
  
  // Selección de operador
  bot.action(/^select_operator_(.+)$/, async (ctx) => {
    if (isInState(ctx, 'report_select_operator')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de operadores eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de operadores: ${err.message}`);
        }
      }
      
      const operator = ctx.match[1];
      await reportController.handleOperatorSelection(ctx, operator);
    }
  });
  
  // Cancelar selección de operador
  bot.action('cancel_operator_filter', async (ctx) => {
    if (isInState(ctx, 'report_select_operator')) {
      await ctx.answerCbQuery('Selección cancelada');
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      const cancelMsg = await ctx.reply('Selección de operador cancelada.');
      
      // Volver al menú principal
      await reportController.startReportGeneration(ctx);
      
      // Eliminar mensaje de cancelación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(cancelMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    }
  });
  
  // Filtro por tipo de combustible
  bot.action('filter_by_fuel_type', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.handleFuelTypeFilterSelection(ctx);
    }
  });
  
  // Selección de tipo de combustible
  bot.action(/^select_fuel_type_(gas|gasolina)$/, async (ctx) => {
    if (isInState(ctx, 'report_select_fuel_type')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de tipo de combustible eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de tipo de combustible: ${err.message}`);
        }
      }
      
      const fuelType = ctx.match[1];
      await reportController.handleFuelTypeSelection(ctx, fuelType);
    }
  });
  
  // Cancelar selección de tipo de combustible
  bot.action('cancel_fuel_type_filter', async (ctx) => {
    if (isInState(ctx, 'report_select_fuel_type')) {
      await ctx.answerCbQuery('Selección cancelada');
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      const cancelMsg = await ctx.reply('Selección de tipo de combustible cancelada.');
      
      // Volver al menú principal
      await reportController.startReportGeneration(ctx);
      
      // Eliminar mensaje de cancelación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(cancelMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    }
  });
  
  // Filtro por estatus de pago
  bot.action('filter_by_payment_status', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.handlePaymentStatusFilterSelection(ctx);
    }
  });
  
  // Selección de estatus de pago
  bot.action(/^select_payment_status_(pagada|no pagada)$/, async (ctx) => {
    if (isInState(ctx, 'report_select_payment_status')) {
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de estatus de pago eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          logger.warn(`No se pudo eliminar el submenú de estatus de pago: ${err.message}`);
        }
      }
      
      const paymentStatus = ctx.match[1];
      await reportController.handlePaymentStatusSelection(ctx, paymentStatus);
    }
  });
  
  // Cancelar selección de estatus de pago
  bot.action('cancel_payment_status_filter', async (ctx) => {
    if (isInState(ctx, 'report_select_payment_status')) {
      await ctx.answerCbQuery('Selección cancelada');
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      const cancelMsg = await ctx.reply('Selección de estatus de pago cancelada.');
      
      // Volver al menú principal
      await reportController.startReportGeneration(ctx);
      
      // Eliminar mensaje de cancelación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(cancelMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    }
  });
  
  // Generar reporte PDF
  bot.action('generate_pdf_report', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.generatePdfReport(ctx);
    }
  });
  
  // Generar reporte Excel
  bot.action('generate_excel_report', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.generateExcelReport(ctx);
    }
  });
  
  // Limpiar todos los filtros
  bot.action('clear_all_filters', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await ctx.answerCbQuery('Limpiando filtros...');
      
      // Reset de filtros en la sesión
      ctx.session.data.filters = {};
      
      // Mostrar notificación temporal de que se han limpiado los filtros
      const notificationMsg = await ctx.reply('✅ Todos los filtros han sido eliminados.');
      
      // Actualizar el menú principal sin filtros
      await reportController.startReportGeneration(ctx);
      
      // Eliminar el mensaje de notificación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(notificationMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    }
  });
  
  // Cancelar generación de reporte
  bot.action('cancel_report', async (ctx) => {
    await ctx.answerCbQuery('Generación de reporte cancelada');
    
    // Eliminar el mensaje del menú principal si existe
    if (ctx.session?.data?.mainMenuMessageId) {
      try {
        await ctx.deleteMessage(ctx.session.data.mainMenuMessageId);
        // Eliminar la referencia al mensaje
        ctx.session.data.mainMenuMessageId = null;
      } catch (error) {
        logger.warn(`No se pudo eliminar el mensaje del menú principal: ${error.message}`);
      }
    }
    
    // Eliminar el mensaje actual (botón de cancelar)
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      try {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      } catch (error) {
        logger.warn(`No se pudo eliminar el mensaje de cancelación: ${error.message}`);
      }
    }
    
    await ctx.reply('Has cancelado la generación del reporte.');
    
    // Volver al menú principal
    ctx.telegram.sendMessage(ctx.chat.id, '¿Qué deseas hacer ahora?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Volver al menú principal', callback_data: 'main_menu' }]
        ]
      }
    });
  });
  
  // Marcar todas las notas como pagadas
  bot.action('mark_all_as_paid', async (ctx) => {
    await reportController.markAllAsPaid(ctx);
  });
  
  // Cancelar marcar todas como pagadas
  bot.action('cancel_mark_all', async (ctx) => {
    await ctx.answerCbQuery('Operación cancelada');
    await ctx.reply('Has cancelado la operación. Las notas permanecen sin cambios.');
  });
  
  // Manejar entrada de texto para fechas
  bot.on('text', async (ctx, next) => {
    if (isInState(ctx, 'report_date_from')) {
      await reportController.handleDateFromEntry(ctx);
      return;
    }
    
    if (isInState(ctx, 'report_date_to')) {
      await reportController.handleDateToEntry(ctx);
      return;
    }
    
    return next();
  });

  // Generar reportes globales (PDF y Excel)
  bot.action('generate_global_report', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.generateGlobalReport(ctx);
    }
  });
  
  // Generar reporte por filtros aplicados
  bot.action('generate_filtered_report', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await reportController.generateReportByFilters(ctx);
    }
  });

  // Continuar con más filtros
  bot.action('continue_filtering', async (ctx) => {
    if (isInState(ctx, 'report_select_filters')) {
      await ctx.answerCbQuery('Continuando con más filtros...');
      await reportController.startReportGeneration(ctx);
    }
  });
}