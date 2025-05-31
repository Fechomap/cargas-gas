// src/services/fuel.adapter.service.js
import { FuelService as PrismaFuelService } from './fuel.prisma.service.js';
import { 
  usePostgreSQLForReads, 
  usePostgreSQLForWrites 
} from '../../config/database.config.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio adaptador para cargas de combustible PostgreSQL
 * según la configuración de base de datos
 */
export class FuelService {
  /**
   * Registra una nueva carga de combustible (método de instancia)
   * @param {Object} fuelData - Datos de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga creada
   */
  async createFuelEntry(fuelData, tenantId) {
    // Llamar al método estático para mantener la misma implementación
    return FuelService.createFuelRecord(fuelData, tenantId);
  }
  
  /**
   * Registra una nueva carga de combustible (método estático)
   * @param {Object} fuelData - Datos de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga creada
   */
  static async createFuelRecord(fuelData, tenantId) {
    try {
      let pgResult = null;
      const errors = [];
      
      // Escribir en PostgreSQL si está configurado
      if (usePostgreSQLForWrites()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          pgResult = await PrismaFuelService.createFuelRecord(fuelData, tenantId);
          logger.info(`Carga registrada en PostgreSQL: ${pgResult.id}`);
        } catch (error) {
          errors.push(`Error al registrar en PostgreSQL: ${error.message}`);
          logger.error(`Error al registrar carga en PostgreSQL: ${error.message}`);
        }
      }
      
      // Verificar si la operación tuvo éxito
      if (!pgResult) {
        throw new Error(`No se pudo registrar la carga en PostgreSQL: ${errors.join(', ')}`);
      }
      
      return pgResult;
    } catch (error) {
      logger.error(`Error en createFuelRecord: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene una carga de combustible por ID
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object|null>} - Carga encontrada o null
   */
  static async getFuelById(fuelId, tenantId) {
    try {
      // Leer de PostgreSQL si está configurado como primario
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          return await PrismaFuelService.getFuelById(fuelId, tenantId);
        } catch (error) {
          logger.error(`Error al obtener carga de PostgreSQL: ${error.message}`);
          throw error;
        }
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en getFuelById: ${error.message}`);
      throw error;
    }
  }

  /**
   * Marca una carga como pagada
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async markAsPaid(fuelId, tenantId) {
    try {
      let pgResult = null;
      const errors = [];
      
      // Actualizar en PostgreSQL si está configurado
      if (usePostgreSQLForWrites()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          pgResult = await PrismaFuelService.markAsPaid(fuelId, tenantId);
          logger.info(`Carga marcada como pagada en PostgreSQL: ${fuelId}`);
        } catch (error) {
          errors.push(`Error al actualizar en PostgreSQL: ${error.message}`);
          logger.error(`Error al marcar carga como pagada en PostgreSQL: ${error.message}`);
        }
      }
      
      // Verificar si la operación tuvo éxito
      if (!pgResult) {
        throw new Error(`No se pudo marcar la carga como pagada en PostgreSQL: ${errors.join(', ')}`);
      }
      
      return pgResult;
    } catch (error) {
      logger.error(`Error en markAsPaid: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca cargas de combustible con filtros
   * @param {Object} filters - Filtros a aplicar
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Array>} - Cargas encontradas
   */
  static async findFuels(filters = {}, tenantId) {
    try {
      // Leer de PostgreSQL si está configurado
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          return await PrismaFuelService.findFuels(filters, tenantId);
        } catch (error) {
          logger.error(`Error al buscar cargas en PostgreSQL: ${error.message}`);
          throw error;
        }
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en findFuels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca una carga de combustible por su número de venta
   * @param {String} saleNumber - Número de venta a buscar
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object|null>} - Carga encontrada o null
   */
  async findBySaleNumber(saleNumber, tenantId) {
    // Llamar al método estático para mantener la misma implementación
    return FuelService.findBySaleNumberStatic(saleNumber, tenantId);
  }
  
  /**
   * Marca una carga como pagada (método de instancia)
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object>} - Carga actualizada
   */
  async markAsPaid(fuelId, tenantId = null) {
    // Llamar al método estático para mantener la misma implementación
    return FuelService.markAsPaid(fuelId, tenantId);
  }

  /**
   * Busca una carga de combustible por su número de venta (método estático)
   * @param {String} saleNumber - Número de venta a buscar
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object|null>} - Carga encontrada o null
   */
  static async findBySaleNumberStatic(saleNumber, tenantId) {
    try {
      // Leer de PostgreSQL si está configurado
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          // Usar el método findFuels con filtro de saleNumber
          const fuels = await PrismaFuelService.findFuels({ saleNumber }, tenantId);
          return fuels && fuels.length > 0 ? fuels[0] : null;
        } catch (error) {
          logger.error(`Error al buscar carga por número de venta en PostgreSQL: ${error.message}`);
          throw error;
        }
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en findBySaleNumberStatic: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene el total de montos no pagados
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<number>} - Monto total pendiente
   */
  static async getTotalUnpaidAmount(tenantId) {
    try {
      logger.info('Iniciando cálculo de saldo pendiente');

      // Obtener monto desde PostgreSQL si está configurado
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          const total = await PrismaFuelService.getTotalUnpaidAmount(tenantId);
          logger.info(`Total calculado desde PostgreSQL: ${total}`);
          return total;
        } catch (error) {
          logger.error(`Error al calcular saldo en PostgreSQL: ${error.message}`);
          throw error;
        }
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en getTotalUnpaidAmount: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * Actualiza la fecha de registro de una carga de combustible
   * @param {String} fuelId - ID de la carga
   * @param {Date} newDate - Nueva fecha
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async updateRecordDate(fuelId, newDate, tenantId) {
    try {
      let pgResult = null;
      const errors = [];
      
      // Actualizar en PostgreSQL si está configurado
      if (usePostgreSQLForWrites()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          pgResult = await PrismaFuelService.updateFuel(
            fuelId, 
            { recordDate: newDate },
            tenantId
          );
          logger.info(`Fecha de carga actualizada en PostgreSQL: ${fuelId}`);
        } catch (error) {
          errors.push(`Error al actualizar fecha en PostgreSQL: ${error.message}`);
          logger.error(`Error al actualizar fecha en PostgreSQL: ${error.message}`);
        }
      }
      
      // Verificar si la operación tuvo éxito
      if (!pgResult) {
        throw new Error(`No se pudo actualizar la fecha en PostgreSQL: ${errors.join(', ')}`);
      }
      
      return pgResult;
    } catch (error) {
      logger.error(`Error en updateRecordDate: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Método de instancia para actualizar la fecha de registro
   * @param {String} fuelId - ID de la carga
   * @param {Date} newDate - Nueva fecha
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Object>} - Carga actualizada
   */
  async updateRecordDate(fuelId, newDate, tenantId) {
    // Llamar al método estático para mantener la misma implementación
    return FuelService.updateRecordDate(fuelId, newDate, tenantId);
  }
  
  /**
   * Obtiene el saldo total pendiente (cargas no pagadas)
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<number>} - Monto total pendiente
   */
  async getTotalPendingBalance(tenantId) {
    // Llamar al método estático para mantener la misma implementación
    return FuelService.getTotalUnpaidAmount(tenantId);
  }
  
  /**
   * Busca una nota por su número de venta (usado en pagos.controller.js)
   * @param {String} saleNumber - Número de venta a buscar
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object|null>} - Carga encontrada o null
   */
  async findBySaleNumber(saleNumber, tenantId) {
    // Llamar al método estático existente para mantener la misma implementación
    return FuelService.findBySaleNumberStatic(saleNumber, tenantId);
  }
  
  /**
   * Alias para createFuelEntry (mantener compatibilidad con código anterior)
   * @param {Object} fuelData - Datos de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga creada
   */
  async saveFuelEntry(fuelData, tenantId) {
    return this.createFuelEntry(fuelData, tenantId);
  }
  
  /**
   * Busca notas que coincidan con un número de venta
   * @param {String} searchQuery - Texto de búsqueda
   * @param {String} tenantId - ID del tenant (solo para PostgreSQL)
   * @returns {Promise<Array>} - Cargas encontradas
   */
  async searchNotesBySaleNumber(searchQuery, tenantId) {
    try {
      logger.info(`Buscando notas con query: ${searchQuery}, tenantId: ${tenantId}`);
      
      // Para PostgreSQL, usamos el método findFuels con un filtro
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        // Buscar con filtro de saleNumber (coincidencia exacta o parcial según implemente la BD)
        const fuels = await PrismaFuelService.findFuels({ saleNumber: searchQuery }, tenantId);
        logger.info(`Encontradas ${fuels.length} notas en PostgreSQL`);
        return fuels;
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en searchNotesBySaleNumber: ${error.message}`);
      throw error;
    }
  }
}
