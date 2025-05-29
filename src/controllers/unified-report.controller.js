// src/controllers/unified-report.controller.js - VERSIÓN PARA POSTGRESQL
import { Markup } from 'telegraf';
import { filterService } from '../services/filter.service.js';
import { reportPrismaService } from '../services/report.prisma.service.js';
import { updateConversationState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Controlador unificado para reportes con PostgreSQL
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
        filters: existingFilters,
        mainMessageId: null // Para guardar el ID del mensaje principal
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
  async showFilterOptions(ctx, isEdit = false) {
    try {
      logger.info('Iniciando showFilterOptions');
      
      const filters = ctx.session?.data?.filters || {};
      logger.info(`Filtros actuales: ${JSON.stringify(filters)}`);
      
      // Construir mensaje
      let messageText = '📊 *GENERADOR DE REPORTES*\n';
      messageText += '━━━━━━━━━━━━━━━━━━━━\n\n';
      
      // Mostrar filtros aplicados con formato mejorado
      if (Object.keys(filters).length > 0) {
        messageText += '✅ *Filtros Activos:*\n';
        const descriptions = filterService.filtersToText(filters);
        descriptions.forEach(desc => messageText += `   ${desc}\n`);
        messageText += '\n';
      } else {
        messageText += '💡 *Sin filtros aplicados*\n';
        messageText += '_Se generará un reporte global_\n\n';
      }
      
      messageText += '📌 *Selecciona una opción:*';
      
      // Construir teclado con estado visual de filtros
      const hasDateFilter = filters.startDate && filters.endDate;
      const hasOperatorFilter = !!filters.operator;
      const hasFuelTypeFilter = !!filters.fuelType;
      const hasPaymentStatusFilter = !!filters.paymentStatus;
      
      const keyboard = {
        inline_keyboard: [
          [{ 
            text: `${hasDateFilter ? '✅' : '⬜'} Filtrar por Fechas`, 
            callback_data: 'filter_date' 
          }],
          [{ 
            text: `${hasOperatorFilter ? '✅' : '⬜'} Filtrar por Operador`, 
            callback_data: 'filter_operator' 
          }],
          [{ 
            text: `${hasFuelTypeFilter ? '✅' : '⬜'} Filtrar por Tipo de combustible`, 
            callback_data: 'filter_fuelType' 
          }],
          [{ 
            text: `${hasPaymentStatusFilter ? '✅' : '⬜'} Filtrar por Estatus de pago`, 
            callback_data: 'filter_paymentStatus' 
          }]
        ]
      };
      
      // Separador visual
      keyboard.inline_keyboard.push([{ text: '━━━━━━━━━━━━━━━━━━━━', callback_data: 'ignore' }]);
      
      // Botones de acción
      if (Object.keys(filters).length > 0) {
        keyboard.inline_keyboard.push([{ 
          text: '🚀 GENERAR REPORTE', 
          callback_data: 'generate_unified_report' 
        }]);
        keyboard.inline_keyboard.push([{ 
          text: '🗑️ Limpiar todos los filtros', 
          callback_data: 'clear_filters' 
        }]);
      } else {
        keyboard.inline_keyboard.push([{ 
          text: '📊 Generar Reporte Global', 
          callback_data: 'generate_unified_report' 
        }]);
      }
      
      keyboard.inline_keyboard.push([{ 
        text: '❌ Cancelar', 
        callback_data: 'cancel_report' 
      }]);
      
      logger.info(`Teclado construido: ${JSON.stringify(keyboard)}`);
      
      // Decidir si editar o enviar nuevo mensaje
      if (isEdit && ctx.session.data.mainMessageId && ctx.callbackQuery) {
        try {
          await ctx.editMessageText(messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          logger.info('Mensaje principal editado correctamente');
        } catch (editError) {
          logger.warn(`No se pudo editar mensaje: ${editError.message}`);
          // Si no se puede editar, enviar nuevo
          const sentMessage = await ctx.reply(messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          ctx.session.data.mainMessageId = sentMessage.message_id;
        }
      } else {
        // Enviar nuevo mensaje y guardar ID
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        ctx.session.data.mainMessageId = sentMessage.message_id;
        logger.info(`Nuevo mensaje principal creado con ID: ${sentMessage.message_id}`);
      }
      
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
      
      // Responder al callback inmediatamente
      await ctx.answerCbQuery('Cargando opciones...');
      
      // Obtener definición del filtro
      const definition = filterService.getFilterDefinition(filterKey);
      if (!definition) {
        logger.error(`Filtro no encontrado: ${filterKey}`);
        await ctx.answerCbQuery(`Filtro no encontrado: ${filterKey}`);
        return;
      }

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
          await this.showFilterOptions(ctx, true);
      }
    } catch (error) {
      logger.error(`Error al manejar selección de filtro: ${error.message}`, error);
      await ctx.reply('Error al procesar el filtro.');
      await this.showFilterOptions(ctx, true);
    }
  }

  /**
   * Muestra opciones estáticas (ej: tipo de combustible) - EDITANDO EL MENSAJE
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
      keyboard.inline_keyboard.push([{ text: '↩️ Volver', callback_data: 'cancel_filter' }]);

      const messageText = `${definition.icon} *Selecciona ${definition.name}:*`;
      
      // Intentar editar el mensaje existente
      try {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } catch (editError) {
        logger.warn(`No se pudo editar mensaje: ${editError.message}`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      logger.error(`Error al mostrar opciones estáticas: ${error.message}`);
      await ctx.reply('Error al mostrar opciones.');
      await this.showFilterOptions(ctx, true);
    }
  }

  /**
   * Muestra opciones dinámicas (ej: operadores) - EDITANDO EL MENSAJE
   */
  async showDynamicOptions(ctx, definition) {
    try {
      logger.info(`Mostrando opciones dinámicas para: ${definition.name}`);
      
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        await ctx.editMessageText(
          '❌ Error al obtener opciones: No se pudo identificar el grupo.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const options = await filterService.processDynamicList(definition.dataSource, 'get_options', ctx.tenant.id);
      
      if (!options || options.length === 0) {
        await ctx.editMessageText(
          `⚠️ No hay opciones disponibles para ${definition.name}.`,
          { parse_mode: 'Markdown' }
        );
        
        // Esperar un momento y volver
        setTimeout(() => this.showFilterOptions(ctx, true), 1500);
        return;
      }

      const keyboard = {
        inline_keyboard: options.map(option => 
          [{ text: option.label, callback_data: `filter_value_${option.value}` }]
        )
      };
      
      // Agregar botón de cancelar
      keyboard.inline_keyboard.push([{ text: '↩️ Volver', callback_data: 'cancel_filter' }]);

      const messageText = `${definition.icon} *Selecciona ${definition.name}:*`;
      
      // Intentar editar el mensaje existente
      try {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } catch (editError) {
        logger.warn(`No se pudo editar mensaje: ${editError.message}`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      logger.error(`Error al mostrar opciones dinámicas: ${error.message}`);
      await ctx.reply('Error al cargar las opciones.');
      await this.showFilterOptions(ctx, true);
    }
  }

  /**
   * Muestra opciones de fecha - EDITANDO EL MENSAJE
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
      keyboard.inline_keyboard.push([{ text: '↩️ Volver', callback_data: 'cancel_filter' }]);

      const messageText = '📅 *Selecciona el rango de fechas:*';
      
      // Intentar editar el mensaje existente
      try {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } catch (editError) {
        logger.warn(`No se pudo editar mensaje: ${editError.message}`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      logger.error(`Error al mostrar opciones de fecha: ${error.message}`);
      await ctx.reply('Error al mostrar opciones de fecha.');
      await this.showFilterOptions(ctx, true);
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
      
      // Cambiar estado de vuelta a report_unified
      await updateConversationState(ctx, 'report_unified', ctx.session.data);
      
      await ctx.answerCbQuery('✅ Filtro aplicado');
      
      // Volver a mostrar opciones EDITANDO el mensaje
      await this.showFilterOptions(ctx, true);
    } catch (error) {
      logger.error(`Error al procesar valor de filtro: ${error.message}`, error);
      await ctx.reply('Error al aplicar el filtro.');
      await this.showFilterOptions(ctx, true);
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
      
      await ctx.answerCbQuery('Cancelado');
      
      // Volver a mostrar opciones EDITANDO el mensaje
      await this.showFilterOptions(ctx, true);
    } catch (error) {
      logger.error(`Error al cancelar filtro: ${error.message}`);
      await ctx.reply('Error al cancelar filtro.');
      await this.showFilterOptions(ctx, true);
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
      logger.info(`Filtros originales: ${JSON.stringify(filters)}`);
      
      // Mapear filtros para la base de datos
      const mappedFilters = filterService.mapFiltersForDatabase(filters);
      logger.info(`Filtros mapeados para DB: ${JSON.stringify(mappedFilters)}`);
      
      // Actualizar mensaje con estado de generación
      try {
        await ctx.editMessageText(
          '⏳ *Generando reportes...*\n\n' +
          '📄 Procesando PDF...\n' +
          '📊 Procesando Excel...\n\n' +
          '_Por favor espera un momento_',
          { parse_mode: 'Markdown' }
        );
      } catch (editError) {
        logger.warn('No se pudo editar mensaje para mostrar progreso');
      }
      
      try {
        // Verificar que el contexto tiene un tenant
        if (!ctx.tenant) {
          logger.error('No se encontró tenant en el contexto');
          return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
        }
        
        // Obtener el tenantId del contexto
        const tenantId = ctx.tenant.id;
        logger.info(`Generando reportes para tenant: ${tenantId}`);
        
        // Generar ambos reportes usando PostgreSQL
        logger.info('Generando reportes PDF y Excel...');
        const [pdfReport, excelReport] = await Promise.all([
          reportPrismaService.generatePdfReport(mappedFilters, tenantId),
          reportPrismaService.generateExcelReport(mappedFilters, tenantId)
        ]);
        
        logger.info('Reportes generados correctamente');
        
        // Actualizar mensaje con éxito
        try {
          await ctx.editMessageText(
            '✅ *Reportes generados exitosamente*\n\n' +
            '📄 PDF listo\n' +
            '📊 Excel listo\n\n' +
            '_Enviando archivos..._',
            { parse_mode: 'Markdown' }
          );
        } catch (editError) {
          logger.warn('No se pudo editar mensaje de éxito');
        }
        
        // Enviar archivos
        await ctx.replyWithDocument({ 
          source: pdfReport.path, 
          filename: pdfReport.filename 
        }, {
          caption: '📄 Reporte en formato PDF'
        });
        
        await ctx.replyWithDocument({ 
          source: excelReport.path, 
          filename: excelReport.filename 
        }, {
          caption: '📊 Reporte en formato Excel'
        });
        
        // Limpiar estado pero mantener filtros
        const currentFilters = ctx.session.data.filters;
        await updateConversationState(ctx, 'idle', { filters: currentFilters });
        
        // Mostrar opciones post-reporte
        await ctx.reply('✅ *Reportes enviados correctamente*\n\n¿Qué deseas hacer ahora?', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Generar otro reporte', callback_data: 'generate_report' }],
              [{ text: '🏠 Menú principal', callback_data: 'main_menu' }]
            ]
          }
        });
      } catch (reportError) {
        logger.error(`Error al generar reportes: ${reportError.message}`);
        
        // Actualizar mensaje con error
        try {
          await ctx.editMessageText(
            '❌ *Error al generar reportes*\n\n' +
            'Por favor, intenta nuevamente.',
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Reintentar', callback_data: 'generate_unified_report' }],
                  [{ text: '↩️ Volver', callback_data: 'generate_report' }],
                  [{ text: '❌ Cancelar', callback_data: 'cancel_report' }]
                ]
              }
            }
          );
        } catch (editError) {
          await ctx.reply('❌ Error al generar los reportes. Por favor, intenta nuevamente.');
          await this.showFilterOptions(ctx);
        }
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
      await ctx.answerCbQuery('✅ Filtros eliminados');
      
      // Actualizar el mensaje principal
      await this.showFilterOptions(ctx, true);
    } catch (error) {
      logger.error(`Error al limpiar filtros: ${error.message}`);
      await ctx.reply('Error al limpiar los filtros.');
    }
  }

  /**
   * Marca todas las cargas no pagadas como pagadas
   */
  async markAllAsPaid(ctx) {
    try {
      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        logger.error('No se encontró tenant en el contexto');
        return ctx.reply('Error: No se pudo identificar el grupo. Por favor, contacte al administrador.');
      }
      
      const tenantId = ctx.tenant.id;
      const filters = { tenantId };
      
      await ctx.reply('⏳ Procesando pagos...');
      
      // Marcar todas las cargas no pagadas como pagadas
      const result = await reportPrismaService.markAllAsPaid(filters, tenantId);
      
      return ctx.reply(`✅ Operación completada: ${result.message}`);
    } catch (error) {
      logger.error(`Error al marcar como pagadas: ${error.message}`);
      return ctx.reply(`❌ Error: ${error.message}`);
    }
  }
}

export const unifiedReportController = new UnifiedReportController();