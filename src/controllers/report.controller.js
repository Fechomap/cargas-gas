// src/controllers/report.controller.js
import { Markup } from 'telegraf';
import { reportService } from '../services/report.service.js';
import { unitService } from '../services/unit.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { getReportOptionsKeyboard, getPostOperationKeyboard } from '../views/keyboards.js'; // Import shared keyboards

/**
 * Controlador para gestionar la generación de reportes
 */
class ReportController {
  /**
   * Inicia el flujo de generación de reportes
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startReportGeneration(ctx) {
    try {
      logger.info(`Iniciando generación de reporte para usuario ${ctx.from.id}`);
      
      // Inicializar filtros vacíos en la sesión
      logger.info('Actualizando estado de conversación a report_select_filters');
      await updateConversationState(ctx, 'report_select_filters', {
        filters: {}
      });
      logger.info('Estado actualizado correctamente');
      
      // Obtener el teclado de opciones de reporte usando la función importada
      const { reply_markup } = getReportOptionsKeyboard(ctx.session.data.filters); // Pass current filters
      logger.info(`Teclado generado: ${JSON.stringify(reply_markup)}`);
      
      // Mostrar opciones de filtrado
      await ctx.reply('🔍 *Generación de Reportes* 📊\nSelecciona un filtro o genera el reporte:', {
        parse_mode: 'Markdown',
        reply_markup: reply_markup // Usar el teclado obtenido
      });
      logger.info('Mensaje de opciones de reporte enviado');
    } catch (error) {
      logger.error(`Error al iniciar generación de reporte: ${error.message}`, error);
      await ctx.reply('Ocurrió un error al iniciar la generación del reporte. Por favor, intenta nuevamente.');
      
      // Mostrar botón para volver al menú principal
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    }
  }
  
  /**
   * Maneja la selección de filtro por fecha
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleDateFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando rango de fechas');
      
      // Actualizar estado de conversación
      await updateConversationState(ctx, 'report_select_date_range');
      
      // Mostrar teclado con opciones de rangos predefinidos
      await ctx.reply('Selecciona un rango de fechas:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('📅 Hoy', 'date_range_today')],
          [Markup.button.callback('📅 Esta semana', 'date_range_this_week')],
          [Markup.button.callback('📅 Últimas 2 semanas', 'date_range_last_2_weeks')],
          [Markup.button.callback('📅 Últimas 3 semanas', 'date_range_last_3_weeks')],
          [Markup.button.callback('📅 Este mes', 'date_range_this_month')],
          [Markup.button.callback('📅 Últimos 3 meses', 'date_range_last_3_months')],
          [Markup.button.callback('📅 Fechas personalizadas', 'date_range_custom')],
          [Markup.button.callback('❌ Cancelar', 'cancel_date_filter')]
        ])
      );
    } catch (error) {
      logger.error(`Error en selección de filtro por fecha: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Procesa la fecha inicial del rango
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleDateFromEntry(ctx) {
    try {
      const dateText = ctx.message.text;
      
      // Validar formato de fecha
      const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = dateText.match(dateRegex);
      
      if (!match) {
        return await ctx.reply('Formato de fecha incorrecto. Por favor, usa DD/MM/AAAA:');
      }
      
      const [, day, month, year] = match;
      const date = new Date(year, month - 1, day);
      
      // Verificar que la fecha sea válida
      if (isNaN(date.getTime())) {
        return await ctx.reply('Fecha inválida. Por favor, ingresa una fecha real en formato DD/MM/AAAA:');
      }
      
      // Guardar fecha inicial en la sesión
      ctx.session.data.filters.startDate = date;
      await updateConversationState(ctx, 'report_date_to');
      
      // Solicitar fecha final
      await ctx.reply('Ingresa la fecha final (DD/MM/AAAA):');
    } catch (error) {
      logger.error(`Error en entrada de fecha inicial: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente la fecha inicial (DD/MM/AAAA):');
    }
  }
  
  /**
   * Procesa la fecha final del rango
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleDateToEntry(ctx) {
    try {
      const dateText = ctx.message.text;
      
      // Validar formato de fecha
      const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = dateText.match(dateRegex);
      
      if (!match) {
        return await ctx.reply('Formato de fecha incorrecto. Por favor, usa DD/MM/AAAA:');
      }
      
      const [, day, month, year] = match;
      const date = new Date(year, month - 1, day);
      
      // Verificar que la fecha sea válida
      if (isNaN(date.getTime())) {
        return await ctx.reply('Fecha inválida. Por favor, ingresa una fecha real en formato DD/MM/AAAA:');
      }
      
      // Establecer la hora al final del día para inclusividad
      date.setHours(23, 59, 59, 999);
      
      // Guardar fecha final en la sesión
      ctx.session.data.filters.endDate = date;
      
      // Volver a la selección de filtros
      await updateConversationState(ctx, 'report_select_filters');
      
      // Notificar que el filtro ha sido aplicado
      await ctx.reply(`✅ Filtro de fechas aplicado: ${formatDate(ctx.session.data.filters.startDate)} - ${formatDate(ctx.session.data.filters.endDate)}`);
      
      // Mostrar opciones de filtrado actualizadas
      // Mostrar opciones de filtrado actualizadas usando la función importada
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: getReportOptionsKeyboard(ctx.session.data.filters)
      });
    } catch (error) {
      logger.error(`Error en entrada de fecha final: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente la fecha final (DD/MM/AAAA):');
    }
  }
  
  /**
   * Maneja la selección de filtro por operador
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleOperatorFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando operador');
      
      // Obtener todos los operadores (a partir de las unidades registradas)
      const units = await unitService.getAllActiveUnits();
      const operators = [...new Set(units.map(unit => unit.operatorName))];
      
      if (operators.length === 0) {
        await ctx.reply('No hay operadores registrados.');
        return;
      }
      
      // Crear botones para cada operador
      const buttons = operators.map(operator => 
        [Markup.button.callback(operator, `select_operator_${operator}`)]
      );
      
      // Añadir botón para cancelar
      buttons.push([Markup.button.callback('Cancelar', 'cancel_operator_filter')]);
      
      await updateConversationState(ctx, 'report_select_operator');
      await ctx.reply('Selecciona un operador:', Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error(`Error en selección de filtro por operador: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Procesa la selección de operador
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} operator - Nombre del operador seleccionado
   */
  async handleOperatorSelection(ctx, operator) {
    try {
      // Guardar operador en la sesión
      ctx.session.data.filters.operatorName = operator;
      
      // Volver a la selección de filtros
      await updateConversationState(ctx, 'report_select_filters');
      
      await ctx.answerCbQuery(`Operador seleccionado: ${operator}`);
      await ctx.reply(`✅ Filtro por operador aplicado: ${operator}`);
      
      // Mostrar opciones de filtrado actualizadas usando la función importada
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: getReportOptionsKeyboard(ctx.session.data.filters)
      });
    } catch (error) {
      logger.error(`Error en selección de operador: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Maneja la selección de filtro por tipo de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleFuelTypeFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando tipo de combustible');
      
      await updateConversationState(ctx, 'report_select_fuel_type');
      
      // Opciones de tipo de combustible
      await ctx.reply('Selecciona el tipo de combustible:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('Gas', 'select_fuel_type_gas')],
          [Markup.button.callback('Gasolina', 'select_fuel_type_gasolina')],
          [Markup.button.callback('Cancelar', 'cancel_fuel_type_filter')]
        ])
      );
    } catch (error) {
      logger.error(`Error en selección de filtro por tipo de combustible: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Procesa la selección de tipo de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelType - Tipo de combustible seleccionado
   */
  async handleFuelTypeSelection(ctx, fuelType) {
    try {
      // Guardar tipo de combustible en la sesión
      ctx.session.data.filters.fuelType = fuelType;
      
      // Volver a la selección de filtros
      await updateConversationState(ctx, 'report_select_filters');
      
      await ctx.answerCbQuery(`Tipo de combustible seleccionado: ${fuelType}`);
      await ctx.reply(`✅ Filtro por tipo de combustible aplicado: ${fuelType}`);
      
      // Mostrar opciones de filtrado actualizadas usando la función importada
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: getReportOptionsKeyboard(ctx.session.data.filters)
      });
    } catch (error) {
      logger.error(`Error en selección de tipo de combustible: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Maneja la selección de filtro por estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handlePaymentStatusFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando estatus de pago');
      
      await updateConversationState(ctx, 'report_select_payment_status');
      
      // Opciones de estatus de pago
      await ctx.reply('Selecciona el estatus de pago:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('Pagado', 'select_payment_status_pagada')],
          [Markup.button.callback('No pagado', 'select_payment_status_no_pagada')],
          [Markup.button.callback('Cancelar', 'cancel_payment_status_filter')]
        ])
      );
    } catch (error) {
      logger.error(`Error en selección de filtro por estatus de pago: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Procesa la selección de estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} paymentStatus - Estatus de pago seleccionado
   */
  async handlePaymentStatusSelection(ctx, paymentStatus) {
    try {
      // Guardar estatus de pago en la sesión
      ctx.session.data.filters.paymentStatus = paymentStatus;
      
      // Volver a la selección de filtros
      await updateConversationState(ctx, 'report_select_filters');
      
      await ctx.answerCbQuery(`Estatus de pago seleccionado: ${paymentStatus}`);
      await ctx.reply(`✅ Filtro por estatus de pago aplicado: ${paymentStatus}`);
      
      // Mostrar opciones de filtrado actualizadas usando la función importada
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: getReportOptionsKeyboard(ctx.session.data.filters)
      });
    } catch (error) {
      logger.error(`Error en selección de estatus de pago: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Genera el reporte PDF
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async generatePdfReport(ctx) {
    try {
      await ctx.answerCbQuery('Generando reporte PDF...');
      
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Generando reporte PDF, por favor espera...');
      
      // Generar reporte usando el servicio
      const reportFile = await reportService.generatePdfReport(ctx.session.data.filters);
      
      // Eliminar mensaje de espera
      await ctx.deleteMessage(waitMessage.message_id);
      
      // Enviar el archivo PDF
      await ctx.replyWithDocument({ source: reportFile.path, filename: reportFile.filename });
      
      // Si el reporte es de notas no pagadas, mostrar botón para marcar todas como pagadas
      if (ctx.session.data.filters.paymentStatus === 'no pagada') {
        await ctx.reply('¿Deseas marcar todas las notas del reporte como pagadas?', 
          Markup.inlineKeyboard([
            Markup.button.callback('✅ Marcar todas como pagadas', 'mark_all_as_paid'),
            Markup.button.callback('❌ Cancelar', 'cancel_mark_all')
          ])
        );
      } else {
        // Limpiar estado de conversación
        await updateConversationState(ctx, 'idle', {});
        
        // Mostrar menú post-operación
        await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
        
      }
    } catch (error) {
      logger.error(`Error al generar reporte PDF: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar el reporte PDF. Por favor, intenta nuevamente.');
      
      // Mostrar menú post-operación como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    }
  }
  
  /**
   * Genera el reporte Excel
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async generateExcelReport(ctx) {
    try {
      await ctx.answerCbQuery('Generando reporte Excel...');
      
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Generando reporte Excel, por favor espera...');
      
      // Generar reporte usando el servicio
      const reportFile = await reportService.generateExcelReport(ctx.session.data.filters);
      
      // Eliminar mensaje de espera
      await ctx.deleteMessage(waitMessage.message_id);
      
      // Enviar el archivo Excel
      await ctx.replyWithDocument({ source: reportFile.path, filename: reportFile.filename });
      
      // Si el reporte es de notas no pagadas, mostrar botón para marcar todas como pagadas
      if (ctx.session.data.filters.paymentStatus === 'no pagada') {
        await ctx.reply('¿Deseas marcar todas las notas del reporte como pagadas?', 
          Markup.inlineKeyboard([
            Markup.button.callback('✅ Marcar todas como pagadas', 'mark_all_as_paid'),
            Markup.button.callback('❌ Cancelar', 'cancel_mark_all')
          ])
        );
      } else {
        // Limpiar estado de conversación
        await updateConversationState(ctx, 'idle', {});
        
        // Mostrar menú post-operación
        await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
        
      }
    } catch (error) {
      logger.error(`Error al generar reporte Excel: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar el reporte Excel. Por favor, intenta nuevamente.');
      
      // Mostrar menú post-operación como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    }
  }
  
  /**
   * Marca todas las cargas no pagadas del reporte como pagadas
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async markAllAsPaid(ctx) {
    try {
      await ctx.answerCbQuery('Procesando...');
      
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Procesando cambios...');
      
      // Marcar todas las notas como pagadas usando el servicio
      const count = await reportService.markAllNotesAsPaid(ctx.session.data.filters);
      
      // Eliminar mensaje de espera
      await ctx.deleteMessage(waitMessage.message_id);
      
      // Notificar resultado
      await ctx.reply(`✅ Se han marcado ${count} notas como pagadas correctamente.`);
      
      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});
      
      // Mostrar menú post-operación
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
      
    } catch (error) {
      logger.error(`Error al marcar todas como pagadas: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar el cambio. Por favor, intenta nuevamente.');
      
      // Mostrar menú post-operación como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    }
  }
  
  /**
   * Genera reportes en ambos formatos (PDF y Excel)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async generateGlobalReport(ctx) {
    try {
      await ctx.answerCbQuery('Generando reportes globales...');
 
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Generando reportes PDF y Excel, por favor espera...');
 
      // Generar reporte PDF usando el servicio
      logger.info('Generando reporte PDF...');
      const pdfReport = await reportService.generatePdfReport(ctx.session.data.filters);
      logger.info('Reporte PDF generado correctamente');
 
      // Generar reporte Excel usando el servicio
      logger.info('Generando reporte Excel...');
      const excelReport = await reportService.generateExcelReport(ctx.session.data.filters);
      logger.info('Reporte Excel generado correctamente');
 
      // Eliminar mensaje de espera
      await ctx.deleteMessage(waitMessage.message_id);
 
      // Enviar ambos archivos
      await ctx.reply('✅ Reportes generados correctamente:');
      await ctx.replyWithDocument({ source: pdfReport.path, filename: pdfReport.filename });
      await ctx.replyWithDocument({ source: excelReport.path, filename: excelReport.filename });
 
      // Si el reporte es de notas no pagadas, mostrar botón para marcar todas como pagadas
      if (ctx.session.data.filters.paymentStatus === 'no pagada') {
        await ctx.reply('¿Deseas marcar todas las notas del reporte como pagadas?',
          Markup.inlineKeyboard([
            Markup.button.callback('✅ Marcar todas como pagadas', 'mark_all_as_paid'),
            Markup.button.callback('❌ Cancelar', 'cancel_mark_all')
          ])
        );
      } else {
        // Limpiar estado de conversación
        await updateConversationState(ctx, 'idle', {});
 
        // Mostrar menú post-operación
        await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
      }
    } catch (error) {
      logger.error(`Error al generar reportes globales: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar los reportes. Por favor, intenta nuevamente.');
 
      // Mostrar menú post-operación como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    }
  }
 
  /**
   * Procesa la selección de un rango de fechas predefinido
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} rangeType - Tipo de rango seleccionado
   */
  async handlePredefinedDateRange(ctx, rangeType) {
    try {
      // Calcular fechas según el rango seleccionado
      let startDate = new Date();
      let endDate = new Date();
      
      switch (rangeType) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'this_week':
          const dayOfWeek = startDate.getDay();
          const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate.setDate(startDate.getDate() - diff);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_2_weeks':
          const dayOfWeek2 = startDate.getDay();
          const diff2 = dayOfWeek2 === 0 ? 6 : dayOfWeek2 - 1;
          startDate.setDate(startDate.getDate() - diff2 - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_3_weeks':
          const dayOfWeek3 = startDate.getDay();
          const diff3 = dayOfWeek3 === 0 ? 6 : dayOfWeek3 - 1;
          startDate.setDate(startDate.getDate() - diff3 - 14);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'this_month':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'last_3_months':
          startDate.setMonth(startDate.getMonth() - 2);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }
      
      endDate.setHours(23, 59, 59, 999);
      
      ctx.session.data.filters.startDate = startDate;
      ctx.session.data.filters.endDate = endDate;
      
      await updateConversationState(ctx, 'report_select_filters');
      await ctx.answerCbQuery('Filtro de fechas aplicado');
      await ctx.reply(`✅ Filtro de fechas aplicado: ${formatDate(startDate)} - ${formatDate(endDate)}`);
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: getReportOptionsKeyboard(ctx.session.data.filters)
      });
    } catch (error) {
      logger.error(`Error al procesar rango de fechas predefinido: ${error.message}`);
      await ctx.reply('Ocurrió un error al aplicar el filtro de fechas. Por favor, intenta nuevamente.');
    }
  }
 
  /**
   * Inicia el flujo para ingreso de fechas personalizadas
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateRangeSelection(ctx) {
    try {
      await ctx.answerCbQuery('Ingresando fechas personalizadas');
      await updateConversationState(ctx, 'report_date_from');
      await ctx.reply('Ingresa la fecha inicial (DD/MM/AAAA):');
    } catch (error) {
      logger.error(`Error al iniciar selección de fechas personalizadas: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
    }
  }
}

/**
 * Formatea una fecha para mostrar
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export const reportController = new ReportController();
