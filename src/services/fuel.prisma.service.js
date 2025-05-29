// src/services/fuel.prisma.service.js
import prisma from '../db/prisma.js';

/**
 * Servicio para gestionar operaciones relacionadas con cargas de combustible
 */
export class FuelService {
  /**
   * Registra una nueva carga de combustible
   * @param {Object} fuelData - Datos de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga creada
   */
  static async createFuelRecord(fuelData, tenantId) {
    // Obtener información de la unidad para los campos desnormalizados
    const unit = await prisma.unit.findUnique({
      where: { id: fuelData.unitId }
    });

    if (!unit) {
      throw new Error('Unidad no encontrada');
    }

    // Crear registro de carga
    return prisma.fuel.create({
      data: {
        ...fuelData,
        tenantId,
        // Campos desnormalizados para facilitar reportes
        operatorName: unit.operatorName,
        unitNumber: unit.unitNumber
      }
    });
  }

  /**
   * Obtiene una carga de combustible por ID
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object|null>} - Carga encontrada o null
   */
  static async getFuelById(fuelId, tenantId) {
    return prisma.fuel.findFirst({
      where: {
        id: fuelId,
        tenantId
      },
      include: {
        unit: true
      }
    });
  }

  /**
   * Marca una carga como pagada
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async markAsPaid(fuelId, tenantId) {
    return prisma.fuel.update({
      where: {
        id: fuelId,
        tenantId
      },
      data: {
        paymentStatus: 'PAGADA',
        paymentDate: new Date()
      }
    });
  }

  /**
   * Obtiene el total de cargas no pagadas para un tenant
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Number>} - Total en pesos
   */
  static async getTotalUnpaidAmount(tenantId) {
    const result = await prisma.fuel.aggregate({
      where: {
        tenantId,
        paymentStatus: 'NO_PAGADA'
      },
      _sum: {
        amount: true
      }
    });

    return result._sum.amount || 0;
  }

  /**
   * Actualiza la información de una carga
   * @param {String} fuelId - ID de la carga
   * @param {Object} updateData - Datos a actualizar
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async updateFuel(fuelId, updateData, tenantId) {
    return prisma.fuel.update({
      where: {
        id: fuelId,
        tenantId
      },
      data: updateData
    });
  }

  /**
   * Busca cargas de combustible con filtros
   * @param {Object} filters - Filtros a aplicar
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Cargas encontradas
   */
  static async findFuels(filters = {}, tenantId) {
    const where = { tenantId };

    // Aplicar filtros
    if (filters.startDate && filters.endDate) {
      where.recordDate = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    }

    if (filters.operatorName) {
      where.operatorName = {
        contains: filters.operatorName,
        mode: 'insensitive'
      };
    }

    if (filters.unitId) {
      where.unitId = filters.unitId;
    }

    if (filters.fuelType) {
      where.fuelType = filters.fuelType;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.saleNumber) {
      where.saleNumber = filters.saleNumber;
    }

    // Ejecutar consulta
    return prisma.fuel.findMany({
      where,
      include: {
        unit: true
      },
      orderBy: {
        recordDate: 'desc'
      }
    });
  }

  /**
   * Genera estadísticas por operador para un período
   * @param {Object} dateRange - Rango de fechas
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Estadísticas por operador
   */
  static async getOperatorStats(dateRange, tenantId) {
    return prisma.fuel.groupBy({
      by: ['operatorName', 'unitNumber'],
      where: {
        tenantId,
        recordDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate)
        }
      },
      _sum: {
        liters: true,
        amount: true
      },
      _count: {
        id: true
      }
    });
  }

  /**
   * Elimina una carga de combustible
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga eliminada
   */
  static async deleteFuel(fuelId, tenantId) {
    return prisma.fuel.delete({
      where: {
        id: fuelId,
        tenantId
      }
    });
  }
}
