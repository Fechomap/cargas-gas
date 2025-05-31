// src/controllers/fuel/saldo.controller.js
import { FuelService } from '../../services/fuel.adapter.service.js';
import { logger } from '../../utils/logger.js';

// Crear instancia del servicio de combustible
const fuelService = new FuelService();

/**
 * Controlador para gestionar saldos de combustible
 */
export class SaldoController {
  /**
   * Obtiene el saldo total pendiente (cargas no pagadas)
   * @param {TelegrafContext} ctx - Contexto de Telegraf (opcional)
   * @returns {Promise<number>} - Monto total pendiente
   */
  async getTotalPendingBalance(ctx = null) {
    try {
      // Si hay contexto, verificar que tiene un tenant
      let tenantId = null;
      
      if (ctx && ctx.tenant) {
        tenantId = ctx.tenant.id;
        logger.info(`Consultando saldo pendiente para tenantId: ${tenantId}`);
      } else if (ctx) {
        logger.warn('No se encontró tenant en el contexto para consultar saldo');
        return 0;
      }
      
      // Iniciar cálculo de saldo
      logger.info('Iniciando cálculo de saldo pendiente');
      
      // Utilizar PostgreSQL para calcular saldo
      const total = await fuelService.getTotalPendingBalance(tenantId);
      
      // Registrar el resultado
      logger.info(`Total calculado desde PostgreSQL: ${total}`);
      
      return total;
    } catch (error) {
      logger.error(`Error al obtener saldo pendiente: ${error.message}`);
      // Si hay error, retornar 0 como valor seguro
      return 0;
    }
  }
  
  /**
   * Formatea una fecha a un string legible
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha formateada
   */
  formatDate(date) {
    if (!date) return 'Fecha no disponible';
    
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(date).toLocaleDateString('es-MX', options);
  }
}
