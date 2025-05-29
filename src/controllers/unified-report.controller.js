// src/controllers/unified-report.controller.js - VERSIÓN CORREGIDA
import { Markup } from 'telegraf';
import { filterService } from '../services/filter.service.js';
import { reportService } from '../services/report.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Controlador unificado para reportes con sistema de filtros simplificado
 */
class UnifiedReportController {
  /**
   * Inicia el flujo de generación de reportes
   */
  async startReportGeneration(ctx) {
    try {
      logger.info(`Iniciando generación de reporte unificada para usuario ${ctx.from.id}`);
      
      // Preservar filtros existentes
      const existingFilters = ctx.session?.data?.filters || {};
      
      await updateConversationState(ctx, 'report_unified', {
        filters: existingFilters
      });
      
      await this.showFilterOptions(ctx);
    } catch (error) {
      logger.error(`Error al iniciar generación de reporte: ${error.message}`);
      await ctx.reply('Error al iniciar la generación del reporte.');
    }
  }

  /**
   * Muestra las opciones de filtros disponibles
   */
  async showFilterOptions(ctx) {
    try {
      logger.info('Iniciando showFilterOptions');
      
      const filters = ctx.session?.data?.filters || {};
      logger.info(`Filtros actuales: ${JSON.stringify(filters)}`);
      
      // Construir mensaje
      let messageText = '🔍 *Generación de Reportes*\n\n';
      
      // Mostrar filtros aplicados
      if (Object.keys(filters).length > 0) {
        messageText += '*Filtros aplicados:*\n';
        const descriptions = filterService.filtersToText(filters);
        descriptions.forEach(desc => messageText += `• ${desc}\n`);
        messageText += '\n';
      }
      
      messageText += 'Selecciona una opción:';
      
      // CORREGIDO: Usar teclado hardcodeado pero con callback_data correctos
      const keyboard = {
        inline_keyboard: [
          [{ text: '📅 Filtrar por Fechas', callback_data: 'filter_date' }],
          [{ text: '👤 Filtrar por Operador', callback_data: 'filter_operator' }],
          [{ text: '⛽ Filtrar por Tipo de combustible', callback_data: 'filter_fuelType' }],
          [{ text: '💰 Filtrar por Estatus de pago', callback_data: 'filter_paymentStatus' }],
          [{ text: '📊 Generar Reporte Global', callback_data: 'generate_unified_report' }],
          [{ text: '❌ Cancelar', callback_data: 'cancel_report' }]
        ]
      };
      
      if (Object.keys(filters).length > 0) {
        // Si hay filtros, cambiar el botón de generar reporte
        keyboard.inline_keyboard[4] = [{ text: '✅ Generar Reporte', callback_data: 'generate_unified_report' }];
        // Y agregar botón de limpiar filtros antes del último botón
        keyboard.inline_keyboard.splice(5, 0, [{ text: '🗑️ Limpiar filtros', callback_data: 'clear_filters' }]);
      }
      
      logger.info(`Teclado construido: ${JSON.stringify(keyboard)}`);
      
      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      logger.info('Mensaje enviado correctamente');
    } catch (error) {
      logger.error(`Error al mostrar opciones de filtros: ${error.message}`, error);
      
      // Fallback ultra simple
      try {
        await ctx.reply('🔍 *Generación de Reportes*\n\nHa ocurrido un error. Selecciona una opción:', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Generar Reporte Global', callback_data: 'generate_unified_report' }],
              [{ text: '❌ Cancelar', callback_data: 'cancel_report' }]
            ]
          }
        });
      } catch (fallbackError) {
        logger.error(`Error en fallback: ${fallbackError.message}`);
        await ctx.reply('Error al mostrar opciones. Intenta nuevamente con /reporte');
      }
    }
  }

  /**
   * Maneja la selección de un filtro específico
   */
  async handleFilterSelection(ctx, filterKey) {
    try {
      logger.info(`Manejando selección de filtro: ${filterKey}`);
      
      // CORREGIDO: Obtener definición usando el servicio
      const definition = filterService.getFilterDefinition(filterKey);
      if (!definition) {
        logger.error(`Filtro no encontrado: ${filterKey}`);
        await ctx.answerCbQuery(`Filtro no encontrado: ${filterKey}`);
        return;
      }

      await ctx.answerCbQuery(`Configurando filtro: ${definition.name}`);
      
      // Guardar el filtro actual en el estado
      ctx.session.data.currentFilter = filterKey;
      await updateConversationState(ctx, 'report_filter_input', ctx.session.data);

      logger.info(`Tipo de filtro: ${definition.type}`);

      switch (definition.type) {
        case 'static_list':
          await this.showStaticOptions(ctx, definition);
          break;
        case 'dynamic_list':
          await this.showDynamicOptions(ctx, definition);
          break;
        case 'date_range':
          await this.showDateOptions(ctx, definition);
          break;
        default:
          logger.warn(`Tipo de filtro no reconocido: ${definition.type}`);
          await ctx.reply('Tipo de filtro no soportado.');
          await this.showFilterOptions(ctx);
      }
    } catch (error) {
      logger.error(`Error al manejar selección de filtro: ${error.message}`, error);
      await ctx.reply('Error al procesar el filtro.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Muestra opciones estáticas (ej: tipo de combustible)
   */
  async showStaticOptions(ctx, definition) {
    try {
      logger.info(`Mostrando opciones estáticas para: ${definition.name}`);
      
      const keyboard = {
        inline_keyboard: definition.options.map(option => 
          [{ text: option.label, callback_data: `filter_value_${option.value}` }]
        )
      };
      
      // Agregar botón de cancelar
      keyboard.inline_keyboard.push([{ text: '❌ Cancelar', callback_data: 'cancel_filter' }]);

      await ctx.reply(`Selecciona ${definition.name}:`, {
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error(`Error al mostrar opciones estáticas: ${error.message}`);
      await ctx.reply('Error al mostrar opciones.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Muestra opciones dinámicas (ej: operadores)
   */
  async showDynamicOptions(ctx, definition) {
    try {
      logger.info(`Mostrando opciones dinámicas para: ${definition.name}`);
      
      const options = await filterService.processDynamicList(definition.dataSource, 'get_options');
      
      if (!options || options.length === 0) {
        await ctx.reply(`No hay opciones disponibles para ${definition.name}.`);
        return this.showFilterOptions(ctx);
      }

      const keyboard = {
        inline_keyboard: options.map(option => 
          [{ text: option.label, callback_data: `filter_value_${option.value}` }]
        )
      };
      
      // Agregar botón de cancelar
      keyboard.inline_keyboard.push([{ text: '❌ Cancelar', callback_data: 'cancel_filter' }]);

      await ctx.reply(`Selecciona ${definition.name}:`, {
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error(`Error al mostrar opciones dinámicas: ${error.message}`);
      await ctx.reply('Error al cargar las opciones.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Muestra opciones de fecha
   */
  async showDateOptions(ctx, definition) {
    try {
      logger.info(`Mostrando opciones de fecha`);
      
      const keyboard = {
        inline_keyboard: definition.options.map(option => 
          [{ text: option.label, callback_data: `filter_value_${option.value}` }]
        )
      };
      
      // Agregar botón de cancelar
      keyboard.inline_keyboard.push([{ text: '❌ Cancelar', callback_data: 'cancel_filter' }]);

      await ctx.reply('Selecciona el rango de fechas:', {
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error(`Error al mostrar opciones de fecha: ${error.message}`);
      await ctx.reply('Error al mostrar opciones de fecha.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Procesa el valor seleccionado para un filtro
   */
  async processFilterValue(ctx, value) {
    try {
      logger.info(`Procesando valor de filtro: ${value}`);
      
      const filterKey = ctx.session.data.currentFilter;
      if (!filterKey) {
        throw new Error('No hay filtro activo');
      }

      logger.info(`Filtro activo: ${filterKey}`);

      // Procesar el valor según el tipo de filtro
      const processedValue = await filterService.processFilterValue(filterKey, value);
      logger.info(`Valor procesado: ${JSON.stringify(processedValue)}`);
      
      // Aplicar filtro
      if (!ctx.session.data.filters) {
        ctx.session.data.filters = {};
      }

      if (filterKey === 'date' && processedValue) {
        ctx.session.data.filters.startDate = processedValue.startDate;
        ctx.session.data.filters.endDate = processedValue.endDate;
        logger.info(`Aplicado filtro de fecha: ${processedValue.startDate} - ${processedValue.endDate}`);
      } else {
        ctx.session.data.filters[filterKey] = processedValue;
        logger.info(`Aplicado filtro ${filterKey}: ${processedValue}`);
      }

      // Limpiar filtro temporal
      delete ctx.session.data.currentFilter;
      
      // CORREGIDO: Cambiar estado de vuelta a report_unified
      await updateConversationState(ctx, 'report_unified', ctx.session.data);
      
      await ctx.answerCbQuery('Filtro aplicado');
      await ctx.reply('✅ Filtro aplicado correctamente');
      
      // Volver a mostrar opciones
      await this.showFilterOptions(ctx);
    } catch (error) {
      logger.error(`Error al procesar valor de filtro: ${error.message}`, error);
      await ctx.reply('Error al aplicar el filtro.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Cancela la selección de filtro y vuelve al menú principal
   */
  async cancelFilter(ctx) {
    try {
      logger.info('Cancelando selección de filtro');
      
      // Limpiar filtro temporal
      if (ctx.session.data && ctx.session.data.currentFilter) {
        delete ctx.session.data.currentFilter;
      }
      
      // Volver al estado de reporte unificado
      await updateConversationState(ctx, 'report_unified', ctx.session.data);
      
      await ctx.answerCbQuery('Filtro cancelado');
      await this.showFilterOptions(ctx);
    } catch (error) {
      logger.error(`Error al cancelar filtro: ${error.message}`);
      await ctx.reply('Error al cancelar filtro.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Genera el reporte con los filtros aplicados
   */
  async generateReport(ctx) {
    try {
      logger.info('Iniciando generación de reporte');
      
      await ctx.answerCbQuery('Generando reportes...');
      
      const filters = ctx.session?.data?.filters || {};
      logger.info(`Filtros para reporte: ${JSON.stringify(filters)}`);
      
      // Mostrar mensaje de espera
      const waitMessage = await ctx.reply('⏳ Generando reportes PDF y Excel...');
      
      try {
        // Generar ambos reportes
        logger.info('Generando reportes PDF y Excel...');
        const [pdfReport, excelReport] = await Promise.all([
          reportService.generatePdfReport(filters),
          reportService.generateExcelReport(filters)
        ]);
        
        logger.info('Reportes generados correctamente');
        
        // Eliminar mensaje de espera
        await ctx.deleteMessage(waitMessage.message_id);
        
        // Enviar archivos
        await ctx.reply('✅ Reportes generados:');
        await ctx.replyWithDocument({ source: pdfReport.path, filename: pdfReport.filename });
        await ctx.replyWithDocument({ source: excelReport.path, filename: excelReport.filename });
        
        // Limpiar estado
        await updateConversationState(ctx, 'idle', {});
        
        // Mostrar opciones post-reporte
        await ctx.reply('¿Qué deseas hacer ahora?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Generar otro reporte', callback_data: 'generate_report' }],
              [{ text: '🏠 Menú principal', callback_data: 'main_menu' }]
            ]
          }
        });
      } catch (reportError) {
        logger.error(`Error al generar reportes: ${reportError.message}`);
        
        // Eliminar mensaje de espera si existe
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch (deleteError) {
          // Ignorar error al eliminar mensaje
        }
        
        await ctx.reply('❌ Error al generar los reportes. Por favor, intenta nuevamente.');
        await this.showFilterOptions(ctx);
      }
    } catch (error) {
      logger.error(`Error al generar reporte: ${error.message}`, error);
      await ctx.reply('Error al generar los reportes.');
      await this.showFilterOptions(ctx);
    }
  }

  /**
   * Limpia todos los filtros aplicados
   */
  async clearFilters(ctx) {
    try {
      logger.info('Limpiando filtros');
      
      ctx.session.data.filters = {};
      await ctx.answerCbQuery('Filtros eliminados');
      await ctx.reply('🗑️ Todos los filtros han sido eliminados');
      await this.showFilterOptions(ctx);
    } catch (error) {
      logger.error(`Error al limpiar filtros: ${error.message}`);
      await ctx.reply('Error al limpiar los filtros.');
    }
  }
}

export const unifiedReportController = new UnifiedReportController();