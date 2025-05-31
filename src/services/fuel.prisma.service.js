// src/services/fuel.prisma.service.js
import { prisma } from '../db/index.js';

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
    // Buscar el registro sin filtrar por isActive
    const record = await prisma.fuel.findFirst({
      where: {
        id: fuelId,
        tenantId
      },
      include: {
        unit: true
      }
    });
    
    // Si se requiere que esté activo y el registro no lo está, retornar null
    if (record && record.isActive === false) {
      return null;
    }
    
    return record;
  }

  /**
   * Marca una carga como pagada
   * @param {String} fuelId - ID de la carga
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async markAsPaid(fuelId, tenantId) {
    // Primero verificamos si el registro existe y está activo
    const record = await this.getFuelById(fuelId, tenantId);
    
    if (!record) {
      throw new Error('Registro no encontrado o inactivo');
    }
    
    // Actualizamos el registro
    await prisma.fuel.update({
      where: {
        id: fuelId
      },
      data: {
        paymentStatus: 'PAGADA',
        paymentDate: new Date()
      }
    });
    
    // Obtenemos el registro actualizado para devolverlo completo
    return this.getFuelById(fuelId, tenantId);
  }

  /**
   * Obtiene el total de cargas no pagadas para un tenant
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Number>} - Total en pesos
   */
  static async getTotalUnpaidAmount(tenantId) {
    // Obtenemos directamente los registros activos no pagados
    const activeRecords = await prisma.fuel.findMany({
      where: {
        tenantId,
        paymentStatus: 'NO_PAGADA',
        isActive: true
      },
      select: {
        amount: true
      }
    });

    // Sumamos manualmente los montos
    if (activeRecords.length > 0) {
      const total = activeRecords.reduce((sum, record) => {
        return sum + (parseFloat(record.amount) || 0);
      }, 0);
      return total;
    }

    return 0;
  }

  /**
   * Actualiza la información de una carga
   * @param {String} fuelId - ID de la carga
   * @param {Object} data - Datos a actualizar
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async updateFuel(fuelId, data, tenantId) {
    // Primero verificamos si el registro existe y está activo
    const record = await this.getFuelById(fuelId, tenantId);
    
    if (!record) {
      throw new Error('Registro no encontrado o inactivo');
    }
    
    // Actualizamos el registro
    return prisma.fuel.update({
      where: {
        id: fuelId,
        tenantId
      },
      data
    });
  }

  /**
   * Actualiza la fecha de registro de una carga
   * @param {String} fuelId - ID de la carga
   * @param {Date} newDate - Nueva fecha
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Carga actualizada
   */
  static async updateRecordDate(fuelId, newDate, tenantId) {
    // Verificar que el registro existe
    const record = await this.getFuelById(fuelId, tenantId);
    
    if (!record) {
      throw new Error('Registro no encontrado o inactivo');
    }
    
    // Actualizar la fecha
    return prisma.fuel.update({
      where: {
        id: fuelId,
        tenantId
      },
      data: {
        recordDate: newDate
      }
    });
  }

  /**
   * Desactiva un registro de combustible (borrado lógico)
   * @param {String} fuelId - ID del registro de combustible
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Registro desactivado
   */
  static async deactivateFuel(fuelId, tenantId) {
    return prisma.fuel.update({
      where: {
        id: fuelId,
        tenantId
      },
      data: {
        isActive: false
      }
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
    
    // IMPORTANTE: Aplicar filtro isActive ANTES de la consulta
    // Por defecto, solo buscar registros activos a menos que se especifique lo contrario
    where.isActive = filters.hasOwnProperty('isActive') ? filters.isActive : true;
    
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
      // Si queremos búsqueda exacta, usamos equals en lugar de contains
      if (filters.exactMatch) {
        where.saleNumber = {
          equals: filters.saleNumber,
          mode: 'insensitive'
        };
      } 
      // Si queremos búsqueda por prefijo (empieza con), usamos startsWith
      else if (filters.prefixMatch) {
        where.saleNumber = {
          startsWith: filters.saleNumber,
          mode: 'insensitive'
        };
      }
      // Por defecto, seguimos usando contains para compatibilidad con código existente
      else {
        where.saleNumber = {
          contains: filters.saleNumber,
          mode: 'insensitive'
        };
      }
    }

    // Ejecutar consulta con el filtro isActive incluido en el WHERE
    const results = await prisma.fuel.findMany({
      where,
      include: {
        unit: true
      },
      orderBy: {
        recordDate: 'desc'
      }
    });
    
    // Ya no necesitamos filtrar manualmente porque se aplicó en la consulta
    return results;
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