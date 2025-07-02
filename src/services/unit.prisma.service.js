// src/services/unit.prisma.service.js
import { prisma } from '../db/index.js';

/**
 * Servicio para gestionar operaciones relacionadas con unidades/operadores
 */
export class UnitService {
  /**
   * Genera un buttonId único para la unidad
   * @param {String} operatorName - Nombre del operador
   * @param {String} unitNumber - Número de unidad
   * @returns {String} - ButtonId generado
   */
  static generateButtonId(operatorName, unitNumber) {
    // Formato: unit_NombreOperador_NumeroUnidad
    return `unit_${operatorName.replace(/\s+/g, '_')}_${unitNumber}`;
  }

  /**
   * Crea una nueva unidad
   * @param {Object} unitData - Datos de la unidad
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Unidad creada
   */
  static async createUnit(unitData, tenantId) {
    const buttonId = this.generateButtonId(unitData.operatorName, unitData.unitNumber);

    // Extraer solo los campos válidos para evitar que se pase un id incorrectamente
    const { operatorName, unitNumber, isActive } = unitData;

    return prisma.unit.create({
      data: {
        operatorName,
        unitNumber,
        isActive: isActive ?? true, // Usar true como valor por defecto
        buttonId,
        tenantId
      }
    });
  }

  /**
   * Busca una unidad por su buttonId dentro de un tenant
   * @param {String} buttonId - ID del botón
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object|null>} - Unidad encontrada o null
   */
  static async findUnitByButtonId(buttonId, tenantId) {
    return prisma.unit.findUnique({
      where: {
        tenantId_buttonId: {
          tenantId,
          buttonId
        }
      }
    });
  }

  /**
   * Obtiene o crea una unidad
   * @param {Object} unitData - Datos de la unidad
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Unidad existente o creada
   */
  static async findOrCreateUnit(unitData, tenantId) {
    const buttonId = this.generateButtonId(unitData.operatorName, unitData.unitNumber);

    // Buscar unidad existente
    const existingUnit = await this.findUnitByButtonId(buttonId, tenantId);

    // Si existe, retornarla
    if (existingUnit) {
      return existingUnit;
    }

    // Si no existe, crearla
    return this.createUnit(unitData, tenantId);
  }

  /**
   * Obtiene todas las unidades activas de un tenant
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Lista de unidades activas
   */
  static async getActiveUnits(tenantId) {
    return prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true
      },
      orderBy: {
        operatorName: 'asc'
      }
    });
  }

  /**
   * Actualiza una unidad
   * @param {String} unitId - ID de la unidad
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} - Unidad actualizada
   */
  static async updateUnit(unitId, updateData) {
    return prisma.unit.update({
      where: { id: unitId },
      data: updateData
    });
  }

  /**
   * Desactiva una unidad (borrado lógico)
   * @param {String} unitId - ID de la unidad
   * @param {String} tenantId - ID del tenant (opcional)
   * @returns {Promise<Object>} - Unidad desactivada
   */
  static async deactivateUnit(unitId, tenantId) {
    if (tenantId) {
      return prisma.unit.update({
        where: {
          id: unitId,
          tenantId // Importante: verificar que la unidad pertenezca al tenant
        },
        data: {
          isActive: false
        }
      });
    } else {
      // Versión sin tenantId (para compatibilidad con código existente)
      return this.updateUnit(unitId, { isActive: false });
    }
  }

  /**
   * Busca unidades por nombre de operador (búsqueda parcial)
   * @param {String} operatorName - Nombre o parte del nombre del operador
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Unidades encontradas
   */
  static async findUnitsByOperatorName(operatorName, tenantId) {
    return prisma.unit.findMany({
      where: {
        tenantId,
        operatorName: {
          contains: operatorName,
          mode: 'insensitive' // Búsqueda case-insensitive
        },
        isActive: true
      },
      orderBy: {
        operatorName: 'asc'
      }
    });
  }
}
