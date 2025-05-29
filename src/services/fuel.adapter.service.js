// src/services/fuel.adapter.service.js
import { Fuel } from '../models/fuel.model.js';
import { FuelService as PrismaFuelService } from './fuel.prisma.service.js';
import { 
  useMongoDBForReads, 
  useMongoDBForWrites, 
  usePostgreSQLForReads, 
  usePostgreSQLForWrites 
} from '../../config/database.config.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio adaptador para cargas de combustible que permite usar MongoDB y/o PostgreSQL
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
      let mongoResult = null;
      let pgResult = null;
      const errors = [];
      
      // Escribir en MongoDB si está configurado
      if (useMongoDBForWrites()) {
        try {
          mongoResult = await Fuel.create(fuelData);
          logger.info(`Carga registrada en MongoDB: ${mongoResult._id}`);
        } catch (error) {
          errors.push(`Error al registrar en MongoDB: ${error.message}`);
          logger.error(`Error al registrar carga en MongoDB: ${error.message}`);
        }
      }
      
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
      
      // Verificar si al menos una operación tuvo éxito
      if (!mongoResult && !pgResult) {
        throw new Error(`No se pudo registrar la carga en ninguna base de datos: ${errors.join(', ')}`);
      }
      
      // Priorizar PostgreSQL si está configurado como primario para lecturas
      return usePostgreSQLForReads() && pgResult ? pgResult : mongoResult;
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
  static async getFuelById(fuelId, tenantId = null) {
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
          // Si falla PostgreSQL y MongoDB está habilitado, intentar con MongoDB
          if (useMongoDBForReads()) {
            logger.info('Intentando obtener carga de MongoDB como fallback');
          } else {
            throw error;
          }
        }
      }
      
      // Leer de MongoDB si está configurado o como fallback
      if (useMongoDBForReads()) {
        try {
          return await Fuel.findById(fuelId).populate('unitId');
        } catch (error) {
          logger.error(`Error al obtener carga de MongoDB: ${error.message}`);
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
  static async markAsPaid(fuelId, tenantId = null) {
    try {
      let mongoResult = null;
      let pgResult = null;
      const errors = [];
      
      // Actualizar en MongoDB si está configurado
      if (useMongoDBForWrites()) {
        try {
          const fuel = await Fuel.findById(fuelId);
          if (fuel) {
            mongoResult = await fuel.markAsPaid();
            logger.info(`Carga marcada como pagada en MongoDB: ${fuelId}`);
          }
        } catch (error) {
          errors.push(`Error al actualizar en MongoDB: ${error.message}`);
          logger.error(`Error al marcar carga como pagada en MongoDB: ${error.message}`);
        }
      }
      
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
      
      // Verificar si al menos una operación tuvo éxito
      if (!mongoResult && !pgResult) {
        throw new Error(`No se pudo marcar la carga como pagada en ninguna base de datos: ${errors.join(', ')}`);
      }
      
      // Priorizar PostgreSQL si está configurado como primario para lecturas
      return usePostgreSQLForReads() && pgResult ? pgResult : mongoResult;
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
  static async findFuels(filters = {}, tenantId = null) {
    try {
      // Leer de PostgreSQL si está configurado como primario
      if (usePostgreSQLForReads()) {
        if (!tenantId) {
          throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
        }
        
        try {
          return await PrismaFuelService.findFuels(filters, tenantId);
        } catch (error) {
          logger.error(`Error al buscar cargas en PostgreSQL: ${error.message}`);
          // Si falla PostgreSQL y MongoDB está habilitado, intentar con MongoDB
          if (useMongoDBForReads()) {
            logger.info('Intentando buscar cargas en MongoDB como fallback');
          } else {
            throw error;
          }
        }
      }
      
      // Leer de MongoDB si está configurado o como fallback
      if (useMongoDBForReads()) {
        try {
          return await Fuel.generateReport(filters);
        } catch (error) {
          logger.error(`Error al buscar cargas en MongoDB: ${error.message}`);
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
  async findBySaleNumber(saleNumber, tenantId = null) {
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
  static async findBySaleNumberStatic(saleNumber, tenantId = null) {
    try {
      // Leer de PostgreSQL si está configurado como primario
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
          // Si falla PostgreSQL y MongoDB está habilitado, intentar con MongoDB
          if (useMongoDBForReads()) {
            logger.info('Intentando buscar carga por número de venta en MongoDB como fallback');
          } else {
            throw error;
          }
        }
      }
      
      // Leer de MongoDB si está configurado o como fallback
      if (useMongoDBForReads()) {
        try {
          return await Fuel.findOne({ saleNumber }).populate('unitId');
        } catch (error) {
          logger.error(`Error al buscar carga por número de venta en MongoDB: ${error.message}`);
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
  static async getTotalUnpaidAmount(tenantId = null) {
    try {
      logger.info('Iniciando cálculo de saldo pendiente');

      // Obtener monto desde PostgreSQL si está configurado como primario
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
          // Si falla PostgreSQL y MongoDB está habilitado, intentar con MongoDB
          if (useMongoDBForReads()) {
            logger.info('Intentando calcular saldo en MongoDB como fallback');
          } else {
            throw error;
          }
        }
      }
      
      // Obtener monto desde MongoDB si está configurado o como fallback
      if (useMongoDBForReads()) {
        try {
          const result = await Fuel.aggregate([
            { $match: { paymentStatus: 'no pagada' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]);
          
          const total = result.length > 0 ? result[0].total : 0;
          logger.info(`Total calculado desde MongoDB: ${total}`);
          return total;
        } catch (error) {
          logger.error(`Error al calcular saldo en MongoDB: ${error.message}`);
          return 0;
        }
      }
      
      throw new Error('No hay bases de datos configuradas para lectura');
    } catch (error) {
      logger.error(`Error en getTotalUnpaidAmount: ${error.message}`);
      return 0;
    }
  }
}
