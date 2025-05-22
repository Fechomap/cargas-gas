// src/controllers/report.controller.js
import { Markup } from 'telegraf';
import { reportService } from '../services/report.service.js';
import { unitService } from '../services/unit.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';
import { getReportOptionsKeyboard, getPostOperationKeyboard } from '../views/keyboards.js';

/**
 * Controlador para gestionar la generación de reportes
 */
class ReportController {
  /**
   * Inicia el flujo de generación de reportes
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  // Modificación a src/controllers/report.controller.js

  // Reemplazar el método startReportGeneration con esta versión actualizada:
  async startReportGeneration(ctx) {
    try {
      logger.info(`Iniciando generación de reporte para usuario ${ctx.from.id}`);
      
      // SOLUCIÓN: Preservar filtros existentes o inicializar vacíos si no existen
      const existingFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado preservando los filtros existentes
      logger.info('Actualizando estado de conversación a report_select_filters');
      await updateConversationState(ctx, 'report_select_filters', {
        filters: existingFilters
      });
      logger.info(`Estado actualizado correctamente. Filtros preservados: ${JSON.stringify(existingFilters)}`);
      
      // Obtener el teclado de opciones de reporte pasando los filtros existentes
      const { reply_markup } = getReportOptionsKeyboard(ctx.session.data.filters);
      logger.info(`Teclado generado: ${JSON.stringify(reply_markup)}`);
      
      // Mostrar opciones de filtrado
      let messageText = '🔍 *Generación de Reportes* 📊\n';
      
      // Añadir resumen de filtros aplicados si existen
      if (Object.keys(existingFilters).length > 0) {
        messageText += '\n*Filtros aplicados actualmente:*\n';
        
        if (existingFilters.startDate && existingFilters.endDate) {
          messageText += `• 📅 *Fechas:* ${formatDate(existingFilters.startDate)} - ${formatDate(existingFilters.endDate)}\n`;
        }
        
        if (existingFilters.operatorName) {
          messageText += `• 👤 *Operador:* ${existingFilters.operatorName}\n`;
        }
        
        if (existingFilters.fuelType) {
          messageText += `• ⛽ *Combustible:* ${existingFilters.fuelType}\n`;
        }
        
        if (existingFilters.paymentStatus) {
          messageText += `• 💳 *Estatus de pago:* ${existingFilters.paymentStatus}\n`;
        }
        
        messageText += '\nSelecciona otra opción de filtrado o genera el reporte:';
      } else {
        messageText += 'Selecciona un filtro o genera el reporte:';
      }
      
      // Eliminar el mensaje del menú principal anterior si existe
      if (ctx.session?.data?.mainMenuMessageId) {
        try {
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            ctx.session.data.mainMenuMessageId
          );
          logger.info(`Menú principal anterior eliminado: ${ctx.session.data.mainMenuMessageId}`);
        } catch (deleteError) {
          logger.warn(`No se pudo eliminar el menú principal anterior: ${deleteError.message}`);
        }
      }
      
      // Enviar nuevo mensaje del menú principal
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: reply_markup
      });
      
      // Guardar el ID del nuevo mensaje en la sesión
      if (!ctx.session.data) ctx.session.data = {};
      ctx.session.data.mainMenuMessageId = sentMessage.message_id;
      logger.info(`Nuevo menú principal enviado con ID: ${sentMessage.message_id}`);
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
      
      // Guardar el estado actual y los filtros aplicados
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado de conversación manteniendo los filtros actuales
      await updateConversationState(ctx, 'report_select_date_range', {
        filters: currentFilters
      });
      
      // Mostrar teclado con opciones de rangos predefinidos como submenú temporal
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
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
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
      
      // Guardar fecha inicial en la sesión y mantener los filtros actuales
      ctx.session.data.filters.startDate = date;
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado manteniendo los filtros
      await updateConversationState(ctx, 'report_date_to', {
        filters: currentFilters
      });
      
      // Solicitar fecha final
      await ctx.reply('Ingresa la fecha final (DD/MM/AAAA):');
    } catch (error) {
      logger.error(`Error en entrada de fecha inicial: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente la fecha inicial (DD/MM/AAAA):');
      
      // En caso de error grave, volver al menú principal de reportes
      if (error.message !== 'Invalid date format') {
        await this.startReportGeneration(ctx);
      }
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
      
      // Notificar que el filtro ha sido aplicado
      await ctx.reply(`✅ Filtro de fechas aplicado: ${formatDate(ctx.session.data.filters.startDate)} - ${formatDate(ctx.session.data.filters.endDate)}`);
      
      // Volver directamente al menú principal de reportes con el filtro aplicado
      await this.startReportGeneration(ctx);
    } catch (error) {
      logger.error(`Error en entrada de fecha final: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, ingresa nuevamente la fecha final (DD/MM/AAAA):');
      
      // En caso de error grave, volver al menú principal de reportes
      if (error.message !== 'Invalid date format') {
        await this.startReportGeneration(ctx);
      }
    }
  }
  
  /**
   * Maneja la selección de filtro por operador
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleOperatorFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando operador');
      
      // Guardar el estado actual y los filtros aplicados
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Obtener todos los operadores (a partir de las unidades registradas)
      const units = await unitService.getAllActiveUnits();
      const operators = [...new Set(units.map(unit => unit.operatorName))];
      
      if (operators.length === 0) {
        await ctx.reply('No hay operadores registrados.');
        // Volver al menú principal de reportes si no hay operadores
        return await this.startReportGeneration(ctx);
      }
      
      // Crear botones para cada operador
      const buttons = operators.map(operator => 
        [Markup.button.callback(operator, `select_operator_${operator}`)]
      );
      
      // Añadir botón para cancelar
      buttons.push([Markup.button.callback('Cancelar', 'cancel_operator_filter')]);
      
      // Actualizar estado de conversación manteniendo los filtros actuales
      await updateConversationState(ctx, 'report_select_operator', {
        filters: currentFilters
      });
      
      await ctx.reply('Selecciona un operador:', Markup.inlineKeyboard(buttons));
    } catch (error) {
      logger.error(`Error en selección de filtro por operador: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
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
      
      await ctx.answerCbQuery(`Operador seleccionado: ${operator}`);
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      // Mostrar confirmación de selección
      const confirmMsg = await ctx.reply(`✅ Filtro por operador aplicado: ${operator}`);
      
      // Volver directamente al menú principal de reportes con el filtro aplicado
      await this.startReportGeneration(ctx);
      
      // Opcional: eliminar el mensaje de confirmación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(confirmMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    } catch (error) {
      logger.error(`Error en selección de operador: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
    }
  }
  
  /**
   * Maneja la selección de filtro por tipo de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleFuelTypeFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando tipo de combustible');
      
      // Guardar el estado actual y los filtros aplicados
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado de conversación manteniendo los filtros actuales
      await updateConversationState(ctx, 'report_select_fuel_type', {
        filters: currentFilters
      });
      
      // Opciones de tipo de combustible como submenú temporal
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
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
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
      
      await ctx.answerCbQuery(`Tipo de combustible seleccionado: ${fuelType}`);
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      // Mostrar confirmación de selección
      const confirmMsg = await ctx.reply(`✅ Filtro por tipo de combustible aplicado: ${fuelType}`);
      
      // Volver directamente al menú principal de reportes con el filtro aplicado
      await this.startReportGeneration(ctx);
      
      // Opcional: eliminar el mensaje de confirmación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(confirmMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    } catch (error) {
      logger.error(`Error en selección de tipo de combustible: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
    }
  }
  
  /**
   * Maneja la selección de filtro por estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handlePaymentStatusFilterSelection(ctx) {
    try {
      await ctx.answerCbQuery('Seleccionando estatus de pago');
      
      // Guardar el estado actual y los filtros aplicados
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado de conversación manteniendo los filtros actuales
      await updateConversationState(ctx, 'report_select_payment_status', {
        filters: currentFilters
      });
      
      // Opciones de estatus de pago como submenú temporal
      await ctx.reply('Selecciona el estatus de pago:', 
        Markup.inlineKeyboard([
          [Markup.button.callback('Pagado', 'select_payment_status_pagada')],
          [Markup.button.callback('No pagado', 'select_payment_status_no pagada')],
          [Markup.button.callback('Cancelar', 'cancel_payment_status_filter')]
        ])
      );
    } catch (error) {
      logger.error(`Error en selección de filtro por estatus de pago: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
    }
  }
  
  /**
   * Procesa la selección de estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} paymentStatus - Estatus de pago seleccionado
   */
  async handlePaymentStatusSelection(ctx, paymentStatus) {
    try {
      // Asegurar que el formato sea correcto (doble verificación de seguridad)
      const formattedStatus = paymentStatus === 'no_pagada' ? 'no pagada' : paymentStatus;
      
      // Guardar estatus de pago en la sesión
      ctx.session.data.filters.paymentStatus = formattedStatus;
      
      await ctx.answerCbQuery(`Estatus de pago seleccionado: ${formattedStatus}`);
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
          await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          logger.info(`Submenú de estatus de pago eliminado: ${ctx.callbackQuery.message.message_id}`);
        } catch (err) {
          // El mensaje ya pudo haber sido eliminado o no existe
          logger.warn(`No se pudo eliminar el submenú de estatus de pago: ${err.message}`);
          // Continuar con el flujo normal a pesar del error
        }
      }
      
      // Mostrar confirmación de selección
      const confirmMsg = await ctx.reply(`✅ Filtro por estatus de pago aplicado: ${formattedStatus}`);
      
      // Volver directamente al menú principal de reportes con el filtro aplicado
      await this.startReportGeneration(ctx);
      
      // Opcional: eliminar el mensaje de confirmación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(confirmMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    } catch (error) {
      logger.error(`Error en selección de estatus de pago: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
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
      const today = new Date();
      let startDate = new Date();
      let endDate = new Date();
      
      // Configurar fechas según el rango seleccionado
      switch (rangeType) {
        case 'today':
          // Hoy (startDate ya está configurado con la fecha actual)
          break;
          
        case 'this_week':
          // Esta semana (desde el domingo hasta hoy)
          const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, etc.
          startDate = new Date(today);
          startDate.setDate(today.getDate() - dayOfWeek); // Retroceder al domingo
          break;
          
        case 'last_2_weeks':
          // Últimas 2 semanas
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 14);
          break;
          
        case 'last_3_weeks':
          // Últimas 3 semanas
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 21);
          break;
          
        case 'this_month':
          // Este mes (desde el primer día del mes actual)
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
          
        case 'last_3_months':
          // Últimos 3 meses
          startDate = new Date(today);
          startDate.setMonth(today.getMonth() - 3);
          break;
          
        default:
          return await ctx.reply('Rango de fechas no válido. Por favor, selecciona otro.');
      }
      
      // Ajustar horas para inclusividad
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      // Guardar fechas en la sesión
      ctx.session.data.filters.startDate = startDate;
      ctx.session.data.filters.endDate = endDate;
      
      await ctx.answerCbQuery(`Fechas seleccionadas: ${formatDate(startDate)} - ${formatDate(endDate)}`);
      
      // Eliminar el mensaje del submenú
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      }
      
      // Mostrar confirmación de selección
      const confirmMsg = await ctx.reply(`✅ Filtro de fechas aplicado: ${formatDate(startDate)} - ${formatDate(endDate)}`);
      
      // Volver directamente al menú principal de reportes con el filtro aplicado
      await this.startReportGeneration(ctx);
      
      // Opcional: eliminar el mensaje de confirmación después de un breve retraso
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(confirmMsg.message_id);
        } catch (err) {
          // Ignorar errores al eliminar mensajes
        }
      }, 2000); // 2 segundos
    } catch (error) {
      logger.error(`Error al seleccionar rango predefinido: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
    }
  }
  
  /**
   * Genera reporte por filtros
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async generateReportByFilters(ctx) {
    try {
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Generando reportes PDF y Excel, por favor espera...');
      
      // Generar reportes usando el servicio (ahora devuelve un array con [pdfReport, excelReport])
      const [pdfReport, excelReport] = await reportService.generateReportByFilters(ctx.session.data.filters);
      
      // Eliminar mensaje de espera
      await ctx.deleteMessage(waitMessage.message_id);
      
      // Enviar confirmación
      await ctx.reply('✅ Reportes generados correctamente:');
      
      // Enviar ambos archivos
      await ctx.replyWithDocument({ source: pdfReport.path, filename: pdfReport.filename });
      await ctx.replyWithDocument({ source: excelReport.path, filename: excelReport.filename });
      
      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});
      
      // Mostrar menú post-operación
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    } catch (error) {
      logger.error(`Error al generar reporte por filtros: ${error.message}`);
      await ctx.reply('Ocurrió un error al generar el reporte. Por favor, intenta nuevamente.');
      
      // Mostrar menú post-operación como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', getPostOperationKeyboard());
    }
  }
  
  /**
   * Inicia el flujo para ingreso de fechas personalizadas
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateRangeSelection(ctx) {
    try {
      await ctx.answerCbQuery('Ingresa fechas personalizadas');
      
      // Guardar los filtros actuales antes de cambiar el estado
      const currentFilters = ctx.session?.data?.filters || {};
      
      // Actualizar estado manteniendo los filtros
      await updateConversationState(ctx, 'report_date_from', {
        filters: currentFilters
      });
      
      await ctx.reply('Ingresa la fecha inicial (DD/MM/AAAA):');
    } catch (error) {
      logger.error(`Error al iniciar selección de fechas personalizadas: ${error.message}`);
      await ctx.reply('Ocurrió un error. Por favor, intenta nuevamente.');
      
      // En caso de error, volver al menú principal de reportes
      await this.startReportGeneration(ctx);
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