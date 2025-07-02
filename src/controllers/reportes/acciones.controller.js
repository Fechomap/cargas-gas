// src/controllers/reportes/acciones.controller.js
import { reportPrismaService } from '../../services/report.prisma.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador para gestionar acciones relacionadas con reportes
 */
export class AccionesController {
  /**
   * Limpia todos los filtros aplicados
   */
  async clearFilters(ctx) {
    try {
      logger.info('Limpiando filtros');

      ctx.session.data.filters = {};
      await ctx.answerCbQuery('✅ Filtros eliminados');

      // Actualizar el mensaje principal
      const filtrosController = await import('./filtros.controller.js').then(m => new m.FiltrosController());
      await filtrosController.showFilterOptions(ctx, true);
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