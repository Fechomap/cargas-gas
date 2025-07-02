// src/services/fuel.prisma.service.js
import { prisma } from '../db/index.js';
import { KilometerService } from './kilometer.prisma.service.js';

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

    // Verificar si el número de folio ya existe (solo si se proporcionó)
    if (fuelData.saleNumber) {
      const existingFuel = await prisma.fuel.findFirst({
        where: {
          tenantId,
          saleNumber: fuelData.saleNumber,
          isActive: true
        }
      });

      if (existingFuel) {
        throw new Error(`Ya existe un registro activo con el número de nota ${fuelData.saleNumber}`);
      }
    }

    // Validar y procesar campos de kilómetros (opcional)
    let validatedKilometers = null;
    let calculatedAmount = fuelData.amount; // Usar monto proporcionado por defecto

    if (fuelData.kilometers !== null && fuelData.kilometers !== undefined) {
      // Validar kilómetros contra el histórico
      const validation = await KilometerService.validateKilometer(
        tenantId,
        fuelData.unitId,
        fuelData.kilometers
      );

      if (!validation.isValid) {
        throw new Error(`Error en kilómetros: ${validation.message}`);
      }

      validatedKilometers = validation.newKilometer;

      // Si hay precio por litro y kilómetros, verificar cálculo automático
      if (fuelData.pricePerLiter && fuelData.liters) {
        const autoCalculatedAmount = parseFloat(fuelData.liters) * parseFloat(fuelData.pricePerLiter);

        // Si no se proporcionó monto, calcularlo automáticamente
        if (!fuelData.amount) {
          calculatedAmount = autoCalculatedAmount;
        } else {
          // Si se proporcionó monto, verificar que sea consistente (tolerancia de ±1 peso)
          const providedAmount = parseFloat(fuelData.amount);
          const difference = Math.abs(providedAmount - autoCalculatedAmount);

          if (difference > 1.0) {
            console.warn(`Discrepancia en cálculo: Proporcionado $${providedAmount}, Calculado $${autoCalculatedAmount.toFixed(2)}`);
          }
        }
      }
    }

    // Preparar datos para inserción
    const { id, updatedAt, ...cleanFuelData } = fuelData;
    const dataToInsert = {
      ...cleanFuelData,
      tenantId,
      amount: calculatedAmount,
      kilometers: validatedKilometers,
      // Campos desnormalizados para facilitar reportes
      operatorName: unit.operatorName,
      unitNumber: unit.unitNumber
    };

    return prisma.fuel.create({
      data: dataToInsert
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
        Unit: true
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
        Unit: true
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

  /**
   * Obtiene registros de combustible con información de kilómetros
   * Incluye validación de consistencia entre registros
   * @param {Object} filters - Filtros para la consulta
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Array>} - Registros con información de kilómetros
   */
  static async findFuelsWithKilometers(filters = {}, tenantId) {
    const fuels = await this.findFuels(filters, tenantId);

    // Agregar información adicional de kilómetros a cada registro
    const enrichedFuels = await Promise.all(
      fuels.map(async (fuel) => {
        if (fuel.kilometers) {
          // Obtener último kilómetro conocido antes de este registro
          const lastKm = await KilometerService.getLastKilometer(tenantId, fuel.unitId);

          // Calcular eficiencia si hay datos completos
          let efficiency = null;
          if (fuel.kilometers && lastKm && fuel.liters) {
            const distance = parseFloat(fuel.kilometers) - parseFloat(lastKm.kilometers);
            if (distance > 0) {
              efficiency = distance / parseFloat(fuel.liters); // km por litro
            }
          }

          return {
            ...fuel,
            kilometerInfo: {
              hasKilometers: true,
              currentKm: fuel.kilometers,
              lastKnownKm: lastKm ? lastKm.kilometers : null,
              efficiency: efficiency
            }
          };
        }

        return {
          ...fuel,
          kilometerInfo: {
            hasKilometers: false,
            currentKm: null,
            lastKnownKm: null,
            efficiency: null
          }
        };
      })
    );

    return enrichedFuels;
  }

  /**
   * Valida datos de carga antes de crear registro
   * Incluye validaciones específicas para kilómetros
   * @param {Object} fuelData - Datos a validar
   * @param {String} tenantId - ID del tenant
   * @returns {Promise<Object>} - Resultado de validación
   */
  static async validateFuelData(fuelData, tenantId) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validaciones básicas
    if (!fuelData.unitId) {
      validation.errors.push('ID de unidad es requerido');
    }

    if (!fuelData.liters || parseFloat(fuelData.liters) <= 0) {
      validation.errors.push('Cantidad de litros debe ser mayor a 0');
    }

    if (!fuelData.fuelType) {
      validation.errors.push('Tipo de combustible es requerido');
    }

    // Validaciones específicas de kilómetros
    if (fuelData.kilometers !== null && fuelData.kilometers !== undefined) {
      try {
        const kilometerValidation = await KilometerService.validateKilometer(
          tenantId,
          fuelData.unitId,
          fuelData.kilometers
        );

        if (!kilometerValidation.isValid) {
          validation.errors.push(`Kilómetros: ${kilometerValidation.message}`);
        } else if (kilometerValidation.warning) {
          validation.warnings.push(`Kilómetros: ${kilometerValidation.message}`);
        }
      } catch (error) {
        validation.errors.push(`Error validando kilómetros: ${error.message}`);
      }
    }

    // Validación de cálculo de monto
    if (fuelData.pricePerLiter && fuelData.liters && fuelData.amount) {
      const calculatedAmount = parseFloat(fuelData.liters) * parseFloat(fuelData.pricePerLiter);
      const providedAmount = parseFloat(fuelData.amount);
      const difference = Math.abs(providedAmount - calculatedAmount);

      if (difference > 1.0) {
        validation.warnings.push(
          `Discrepancia en monto: Calculado $${calculatedAmount.toFixed(2)}, Proporcionado $${providedAmount.toFixed(2)}`
        );
      }
    }

    validation.isValid = validation.errors.length === 0;
    return validation;
  }
}