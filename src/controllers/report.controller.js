// src/controllers/report.controller.js
import { Markup } from 'telegraf';
import { reportService } from '../services/report.service.js';
import { unitService } from '../services/unit.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

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
      // Inicializar filtros vacíos en la sesión
      await updateConversationState(ctx, 'report_select_filters', {
        filters: {}
      });
      
      // Mostrar opciones de filtrado
      await ctx.reply('🔍 *Generación de Reportes* 📊', {
        parse_mode: 'Markdown',
        reply_markup: this.getFilterOptionsKeyboard()
      });
    } catch (error) {
      logger.error(`Error al iniciar generación de reporte: ${error.message}`);
      await ctx.reply('Ocurrió un error al iniciar la generación del reporte. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Maneja la selección de filtro por fecha
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleDateFilterSelection(ctx) {
    try {
      await updateConversationState(ctx, 'report_date_from');
      await ctx.answerCbQuery('Seleccionando rango de fechas');
      
      // Para simplificar, solicitar fechas en formato texto
      await ctx.reply('Ingresa la fecha inicial (DD/MM/AAAA):');
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
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: this.getFilterOptionsKeyboard(ctx.session.data.filters)
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
      
      // Mostrar opciones de filtrado actualizadas
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: this.getFilterOptionsKeyboard(ctx.session.data.filters)
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
      
      // Mostrar opciones de filtrado actualizadas
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: this.getFilterOptionsKeyboard(ctx.session.data.filters)
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
      
      // Mostrar opciones de filtrado actualizadas
      await ctx.reply('¿Deseas aplicar más filtros o generar el reporte?', {
        reply_markup: this.getFilterOptionsKeyboard(ctx.session.data.filters)
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
      }
    } catch (error) {
      logger.error(`Error al generar reporte PDF: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar el reporte PDF. Por favor, intenta nuevamente.');
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
      }
    } catch (error) {
      logger.error(`Error al generar reporte Excel: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar el reporte Excel. Por favor, intenta nuevamente.');
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
    } catch (error) {
      logger.error(`Error al marcar todas como pagadas: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar el cambio. Por favor, intenta nuevamente.');
    }
  }
  
  /**
   * Obtiene el teclado de opciones de filtrado
   * @param {Object} filters - Filtros actuales
   * @returns {Object} - Teclado con opciones de filtrado
   */
  getFilterOptionsKeyboard(filters = {}) {
    const buttons = [];
    
    // Opción de filtro por fecha
    const dateFilterText = filters.startDate ? 
      `📅 Cambiar fechas (${formatDate(filters.startDate)} - ${formatDate(filters.endDate)})` : 
      '📅 Filtrar por fechas';
    buttons.push([Markup.button.callback(dateFilterText, 'filter_by_date')]);
    
    // Opción de filtro por operador
    const operatorFilterText = filters.operatorName ? 
      `👤 Cambiar operador (${filters.operatorName})` : 
      '👤 Filtrar por operador';
    buttons.push([Markup.button.callback(operatorFilterText, 'filter_by_operator')]);
    
    // Opción de filtro por tipo de combustible
    const fuelTypeFilterText = filters.fuelType ? 
      `⛽ Cambiar tipo (${filters.fuelType})` : 
      '⛽ Filtrar por tipo de combustible';
    buttons.push([Markup.button.callback(fuelTypeFilterText, 'filter_by_fuel_type')]);
    
    // Opción de filtro por estatus de pago
    const paymentStatusFilterText = filters.paymentStatus ? 
      `💰 Cambiar estatus (${filters.paymentStatus})` : 
      '💰 Filtrar por estatus de pago';
    buttons.push([Markup.button.callback(paymentStatusFilterText, 'filter_by_payment_status')]);
    
    // Botones para generar reportes
    buttons.push([
      Markup.button.callback('📄 Generar PDF', 'generate_pdf_report'),
      Markup.button.callback('📊 Generar Excel', 'generate_excel_report')
    ]);
    
    // Botón para limpiar filtros
    if (Object.keys(filters).length > 0) {
      buttons.push([Markup.button.callback('🗑️ Limpiar todos los filtros', 'clear_all_filters')]);
    }
    
    // Botón para cancelar
    buttons.push([Markup.button.callback('❌ Cancelar', 'cancel_report')]);
    
    return Markup.inlineKeyboard(buttons);
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