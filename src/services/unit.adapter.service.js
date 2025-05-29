// src/services/unit.adapter.service.js
// VERSIÓN SIMPLIFICADA - SOLO POSTGRESQL
import { UnitService as PrismaUnitService } from './unit.prisma.service.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio adaptador para unidades que usa exclusivamente PostgreSQL
 */
export class UnitService {
  /**
   * Genera un buttonId único para la unidad
   * @param {String} operatorName - Nombre del operador
   * @param {String} unitNumber - Número de unidad
   * @returns {String} - ButtonId generado
   */
  static generateButtonId(operatorName, unitNumber) {
    return `unit_${operatorName.replace(/\s+/g, '_')}_${unitNumber}`;
  }

  /**
   * Busca o crea una unidad
   * @param {Object} unitData - Datos de la unidad
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Unidad existente o creada
   */
  static async findOrCreateUnit(unitData, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
      }
      
      const buttonId = this.generateButtonId(unitData.operatorName, unitData.unitNumber);
      
      try {
        return await PrismaUnitService.findOrCreateUnit({
          ...unitData,
          buttonId
        }, tenantId);
      } catch (error) {
        logger.error(`Error al leer/crear unidad en PostgreSQL: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Error en findOrCreateUnit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene todas las unidades activas
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Lista de unidades activas
   */
  static async getActiveUnits(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
      }
      
      try {
        return await PrismaUnitService.getActiveUnits(tenantId);
      } catch (error) {
        logger.error(`Error al leer unidades activas de PostgreSQL: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Error en getActiveUnits: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene todas las unidades activas
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Lista de unidades activas
   */
  static async getAllActiveUnits(tenantId) {
    return this.getActiveUnits(tenantId);
  }

  /**
   * Busca una unidad por su buttonId
   * @param {String} buttonId - ID del botón
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object|null>} - Unidad encontrada o null
   */
  static async findUnitByButtonId(buttonId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
      }
      
      try {
        return await PrismaUnitService.findUnitByButtonId(buttonId, tenantId);
      } catch (error) {
        logger.error(`Error al buscar unidad en PostgreSQL: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Error en findUnitByButtonId: ${error.message}`);
      throw error;
    }
  }

  /**
   * Desactiva una unidad por su buttonId
   * @param {String} buttonId - ID del botón
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<boolean>} - true si se desactivó correctamente
   */
  static async deactivateUnit(buttonId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Se requiere tenantId para operaciones con PostgreSQL');
      }
      
      try {
        return await PrismaUnitService.deactivateUnit(buttonId, tenantId);
      } catch (error) {
        logger.error(`Error al desactivar unidad en PostgreSQL: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Error en deactivateUnit: ${error.message}`);
      throw error;
    }
  }
}

export const unitService = UnitService;
