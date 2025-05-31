// src/controllers/reportes/generacion.controller.js
import { reportPrismaService } from '../../services/report.prisma.service.js';
import { filterService } from '../../services/filter.service.js';
import { updateConversationState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador para gestionar la generación de reportes
 */
export class GeneracionController {
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
      
      // Mostrar opciones de filtros a través de la instancia de FiltrosController
      // Creamos una instancia temporal para no tener que pasar el controlador
      const filtrosController = await import('./filtros.controller.js').then(m => new m.FiltrosController());
      await filtrosController.showFilterOptions(ctx);
    } catch (error) {
      logger.error(`Error al iniciar generación de reporte: ${error.message}`);
      await ctx.reply('Error al iniciar la generación del reporte.');
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
          // Mostrar opciones de filtro nuevamente
          const filtrosController = await import('./filtros.controller.js').then(m => new m.FiltrosController());
          await filtrosController.showFilterOptions(ctx);
        }
      }
    } catch (error) {
      logger.error(`Error al generar reporte: ${error.message}`, error);
      await ctx.reply('Error al generar los reportes.');
      // Mostrar opciones de filtro nuevamente
      const filtrosController = await import('./filtros.controller.js').then(m => new m.FiltrosController());
      await filtrosController.showFilterOptions(ctx);
    }
  }
}