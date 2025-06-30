// src/services/kilometer.prisma.service.js
import { prisma } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar operaciones relacionadas con registros de kilómetros
 * Maneja tanto los logs de turnos como las validaciones de kilómetros en cargas
 */
export class KilometerService {
  /**
   * Obtiene el último kilómetro registrado para una unidad
   * Busca tanto en KilometerLog como en registros de Fuel
   * @param {String} tenantId - ID del tenant
   * @param {String} unitId - ID de la unidad
   * @returns {Promise<Object|null>} - Objeto con información del último kilómetro
   */
  static async getLastKilometer(tenantId, unitId) {
    try {
      logger.info(`Buscando último kilómetro para unidad ${unitId} del tenant ${tenantId}`);
      
      // Buscar en KilometerLog (registros de turno)
      const lastTurnLog = await prisma.kilometerLog.findFirst({
        where: {
          tenantId,
          unitId,
          isOmitted: false
        },
        orderBy: [
          { logDate: 'desc' },
          { logTime: 'desc' }
        ]
      });
      
      // Buscar en Fuel (registros de carga con kilómetros)
      const lastFuelWithKm = await prisma.fuel.findFirst({
        where: {
          tenantId,
          unitId,
          isActive: true,
          kilometers: {
            not: null
          }
        },
        orderBy: {
          recordDate: 'desc'
        },
        select: {
          kilometers: true,
          recordDate: true,
          id: true
        }
      });
      
      // Determinar cuál es más reciente
      let lastKilometer = null;
      
      if (lastTurnLog && lastFuelWithKm) {
        // Comparar fechas para determinar el más reciente
        const turnLogDate = new Date(lastTurnLog.logDate);
        const fuelDate = new Date(lastFuelWithKm.recordDate);
        
        if (turnLogDate >= fuelDate) {
          lastKilometer = {
            kilometers: lastTurnLog.kilometers,
            date: lastTurnLog.logDate,
            source: 'turn_log',
            sourceId: lastTurnLog.id,
            logType: lastTurnLog.logType
          };
        } else {
          lastKilometer = {
            kilometers: lastFuelWithKm.kilometers,
            date: lastFuelWithKm.recordDate,
            source: 'fuel',
            sourceId: lastFuelWithKm.id
          };
        }
      } else if (lastTurnLog) {
        lastKilometer = {
          kilometers: lastTurnLog.kilometers,
          date: lastTurnLog.logDate,
          source: 'turn_log',
          sourceId: lastTurnLog.id,
          logType: lastTurnLog.logType
        };
      } else if (lastFuelWithKm) {
        lastKilometer = {
          kilometers: lastFuelWithKm.kilometers,
          date: lastFuelWithKm.recordDate,
          source: 'fuel',
          sourceId: lastFuelWithKm.id
        };
      }
      
      logger.info(`Último kilómetro encontrado: ${lastKilometer ? lastKilometer.kilometers : 'ninguno'}`);
      return lastKilometer;
      
    } catch (error) {
      logger.error(`Error al obtener último kilómetro: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida un nuevo registro de kilómetros contra el histórico
   * @param {String} tenantId - ID del tenant
   * @param {String} unitId - ID de la unidad
   * @param {Number} newKilometer - Nuevo kilómetro a validar
   * @returns {Promise<Object>} - Resultado de la validación
   */
  static async validateKilometer(tenantId, unitId, newKilometer) {
    try {
      logger.info(`Validando kilómetro ${newKilometer} para unidad ${unitId}`);
      
      // Convertir a número y validar formato
      const newKm = parseFloat(newKilometer);
      
      if (isNaN(newKm) || newKm < 0) {
        return {
          isValid: false,
          error: 'INVALID_FORMAT',
          message: 'El kilómetro debe ser un número positivo'
        };
      }
      
      // Validar máximo 2 decimales
      const decimalPlaces = (newKm.toString().split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        return {
          isValid: false,
          error: 'TOO_MANY_DECIMALS',
          message: 'El kilómetro no puede tener más de 2 decimales'
        };
      }
      
      // Obtener último kilómetro registrado
      const lastKilometer = await this.getLastKilometer(tenantId, unitId);
      
      // Si es el primer registro, es válido
      if (!lastKilometer) {
        logger.info('Primer registro de kilómetros para esta unidad - válido');
        return {
          isValid: true,
          isFirstRecord: true,
          newKilometer: newKm
        };
      }
      
      const lastKm = parseFloat(lastKilometer.kilometers);
      
      // Validar que el nuevo kilómetro sea >= al último
      if (newKm < lastKm) {
        return {
          isValid: false,
          error: 'KILOMETER_BELOW_LAST',
          message: `El kilómetro (${newKm}) no puede ser menor al último registrado (${lastKm})`,
          lastKilometer: lastKilometer
        };
      }
      
      // Validación de incremento razonable (opcional - configurable)
      const increment = newKm - lastKm;
      const MAX_REASONABLE_INCREMENT = 1000; // 1000 km por registro
      
      if (increment > MAX_REASONABLE_INCREMENT) {
        logger.warn(`Incremento de kilómetros muy alto: ${increment} km`);
        return {
          isValid: true,
          warning: 'HIGH_INCREMENT',
          message: `Incremento muy alto: ${increment} km. Verifica que sea correcto.`,
          lastKilometer: lastKilometer,
          newKilometer: newKm,
          increment: increment
        };
      }
      
      logger.info(`Kilómetro válido: ${newKm} (incremento: +${increment})`);
      return {
        isValid: true,
        lastKilometer: lastKilometer,
        newKilometer: newKm,
        increment: increment
      };
      
    } catch (error) {
      logger.error(`Error al validar kilómetro: ${error.message}`);
      throw error;
    }
  }

  /**
   * Registra un log de turno (inicio o fin)
   * @param {Object} data - Datos del log de turno
   * @returns {Promise<Object>} - Log de turno creado
   */
  static async createTurnLog(data) {
    try {
      const { tenantId, unitId, kilometers, logType, logDate, userId } = data;
      
      logger.info(`Creando log de turno ${logType} para unidad ${unitId}`);
      
      // Validar que no existe un log del mismo tipo para la misma fecha
      const existingLog = await prisma.kilometerLog.findUnique({
        where: {
          tenantId_unitId_logDate_logType: {
            tenantId,
            unitId,
            logDate: new Date(logDate),
            logType
          }
        }
      });
      
      if (existingLog && !existingLog.isOmitted) {
        throw new Error(`Ya existe un registro de ${logType} para esta unidad en la fecha ${logDate}`);
      }
      
      // Si existe pero está omitido, lo reactivamos
      if (existingLog && existingLog.isOmitted) {
        logger.info('Reactivando log de turno previamente omitido');
        return prisma.kilometerLog.update({
          where: { id: existingLog.id },
          data: {
            kilometers: parseFloat(kilometers),
            userId,
            isOmitted: false,
            logTime: new Date()
          }
        });
      }
      
      // Crear nuevo registro
      const turnLog = await prisma.kilometerLog.create({
        data: {
          tenantId,
          unitId,
          kilometers: parseFloat(kilometers),
          logType,
          logDate: new Date(logDate),
          userId,
          isOmitted: false
        }
      });
      
      logger.info(`Log de turno creado exitosamente: ${turnLog.id}`);
      return turnLog;
      
    } catch (error) {
      logger.error(`Error al crear log de turno: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene los logs de turno para una fecha específica
   * @param {String} tenantId - ID del tenant
   * @param {String|Date} date - Fecha a consultar
   * @param {String} logType - Tipo de log (opcional)
   * @returns {Promise<Array>} - Logs de turno encontrados
   */
  static async getTurnLogsByDate(tenantId, date, logType = null) {
    try {
      const queryDate = new Date(date);
      logger.info(`Obteniendo logs de turno para fecha ${queryDate.toISOString().split('T')[0]}`);
      
      const where = {
        tenantId,
        logDate: queryDate,
        isOmitted: false
      };
      
      if (logType) {
        where.logType = logType;
      }
      
      const logs = await prisma.kilometerLog.findMany({
        where,
        include: {
          Unit: true
        },
        orderBy: [
          { logTime: 'asc' }
        ]
      });
      
      logger.info(`Encontrados ${logs.length} logs de turno`);
      return logs;
      
    } catch (error) {
      logger.error(`Error al obtener logs de turno: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene unidades que no tienen registro de un tipo específico para una fecha
   * @param {String} tenantId - ID del tenant
   * @param {String|Date} date - Fecha a verificar
   * @param {String} logType - Tipo de log (INICIO_TURNO o FIN_TURNO)
   * @returns {Promise<Array>} - Unidades sin registro
   */
  static async getUnitsWithoutLog(tenantId, date, logType) {
    try {
      const queryDate = new Date(date);
      logger.info(`Buscando unidades sin ${logType} para fecha ${queryDate.toISOString().split('T')[0]}`);
      
      // Obtener todas las unidades activas del tenant
      const allUnits = await prisma.unit.findMany({
        where: {
          tenantId,
          isActive: true
        }
      });
      
      // Obtener unidades que SÍ tienen registro para esta fecha y tipo
      const unitsWithLog = await prisma.kilometerLog.findMany({
        where: {
          tenantId,
          logDate: queryDate,
          logType,
          isOmitted: false
        },
        select: {
          unitId: true
        }
      });
      
      const unitIdsWithLog = new Set(unitsWithLog.map(log => log.unitId));
      
      // Filtrar unidades que NO tienen registro
      const unitsWithoutLog = allUnits.filter(unit => !unitIdsWithLog.has(unit.id));
      
      logger.info(`Encontradas ${unitsWithoutLog.length} unidades sin ${logType}`);
      return unitsWithoutLog;
      
    } catch (error) {
      logger.error(`Error al obtener unidades sin log: ${error.message}`);
      throw error;
    }
  }

  /**
   * Omite (desactiva) un log de turno específico
   * @param {String} logId - ID del log a omitir
   * @param {String} tenantId - ID del tenant (para seguridad)
   * @returns {Promise<Object>} - Log actualizado
   */
  static async omitTurnLog(logId, tenantId) {
    try {
      logger.info(`Omitiendo log de turno ${logId}`);
      
      const updatedLog = await prisma.kilometerLog.update({
        where: {
          id: logId,
          tenantId // Seguridad: solo puede omitir logs de su tenant
        },
        data: {
          isOmitted: true
        }
      });
      
      logger.info(`Log de turno omitido exitosamente`);
      return updatedLog;
      
    } catch (error) {
      logger.error(`Error al omitir log de turno: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de kilómetros para un período
   * @param {String} tenantId - ID del tenant
   * @param {String} unitId - ID de la unidad (opcional)
   * @param {Object} dateRange - Rango de fechas {startDate, endDate}
   * @returns {Promise<Object>} - Estadísticas de kilómetros
   */
  static async getKilometerStats(tenantId, unitId = null, dateRange) {
    try {
      logger.info(`Obteniendo estadísticas de kilómetros para tenant ${tenantId}`);
      
      const where = {
        tenantId,
        isOmitted: false,
        logDate: {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate)
        }
      };
      
      if (unitId) {
        where.unitId = unitId;
      }
      
      const logs = await prisma.kilometerLog.findMany({
        where,
        include: {
          Unit: true
        },
        orderBy: [
          { unitId: 'asc' },
          { logDate: 'asc' },
          { logType: 'asc' }
        ]
      });
      
      // Procesar estadísticas por unidad
      const statsByUnit = {};
      
      logs.forEach(log => {
        const unitKey = log.unitId;
        if (!statsByUnit[unitKey]) {
          statsByUnit[unitKey] = {
            unitId: log.unitId,
            operatorName: log.Unit.operatorName,
            unitNumber: log.Unit.unitNumber,
            totalLogs: 0,
            inicioTurnoLogs: 0,
            finTurnoLogs: 0,
            firstKilometer: null,
            lastKilometer: null,
            totalDistance: 0
          };
        }
        
        const stats = statsByUnit[unitKey];
        stats.totalLogs++;
        
        if (log.logType === 'INICIO_TURNO') {
          stats.inicioTurnoLogs++;
        } else {
          stats.finTurnoLogs++;
        }
        
        const km = parseFloat(log.kilometers);
        if (!stats.firstKilometer || km < stats.firstKilometer) {
          stats.firstKilometer = km;
        }
        if (!stats.lastKilometer || km > stats.lastKilometer) {
          stats.lastKilometer = km;
        }
      });
      
      // Calcular distancia total para cada unidad
      Object.values(statsByUnit).forEach(stats => {
        if (stats.firstKilometer && stats.lastKilometer) {
          stats.totalDistance = stats.lastKilometer - stats.firstKilometer;
        }
      });
      
      logger.info(`Estadísticas generadas para ${Object.keys(statsByUnit).length} unidades`);
      
      return {
        totalUnits: Object.keys(statsByUnit).length,
        totalLogs: logs.length,
        dateRange,
        unitStats: Object.values(statsByUnit)
      };
      
    } catch (error) {
      logger.error(`Error al obtener estadísticas de kilómetros: ${error.message}`);
      throw error;
    }
  }
}