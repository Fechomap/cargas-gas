// src/services/fuel.service.js
import { Fuel } from '../models/fuel.model.js';
import { Unit } from '../models/unit.model.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar la lógica de negocio relacionada con cargas de combustible
 */
class FuelService {
  /**
   * Crea una nueva carga de combustible
   * @param {Object} fuelData - Datos de la carga
   * @returns {Promise<Object>} - Carga creada
   */
  async createFuelEntry(fuelData) {
    try {
      // Verificar que la unidad existe
      const unit = await Unit.findById(fuelData.unitId);
      if (!unit) {
        throw new Error(`Unidad con ID ${fuelData.unitId} no encontrada`);
      }
      
      // Crear nueva carga
      const newFuel = new Fuel({
        unitId: fuelData.unitId,
        liters: fuelData.liters,
        amount: fuelData.amount,
        fuelType: fuelData.fuelType,
        paymentStatus: fuelData.paymentStatus,
        ticketPhoto: fuelData.ticketPhoto,
        operatorName: fuelData.operatorName,
        unitNumber: fuelData.unitNumber,
        recordDate: new Date(),
        paymentDate: fuelData.paymentStatus === 'pagada' ? new Date() : null
      });
      
      await newFuel.save();
      return newFuel;
    } catch (error) {
      logger.error(`Error en servicio de combustible (createFuelEntry): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene una carga por su ID
   * @param {string} fuelId - ID de la carga
   * @returns {Promise<Object>} - Carga encontrada
   */
  async getFuelById(fuelId) {
    try {
      const fuel = await Fuel.findById(fuelId);
      
      if (!fuel) {
        throw new Error(`Carga con ID ${fuelId} no encontrada`);
      }
      
      return fuel;
    } catch (error) {
      logger.error(`Error en servicio de combustible (getFuelById): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene todas las cargas de una unidad
   * @param {string} unitId - ID de la unidad
   * @returns {Promise<Array>} - Lista de cargas
   */
  async getFuelsByUnit(unitId) {
    try {
      return await Fuel.find({ unitId }).sort({ recordDate: -1 });
    } catch (error) {
      logger.error(`Error en servicio de combustible (getFuelsByUnit): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Marca una carga como pagada
   * @param {string} fuelId - ID de la carga
   * @returns {Promise<Object>} - Carga actualizada
   */
  async markAsPaid(fuelId) {
    try {
      const fuel = await this.getFuelById(fuelId);
      
      if (fuel.paymentStatus === 'pagada') {
        return fuel; // Ya está pagada
      }
      
      fuel.paymentStatus = 'pagada';
      fuel.paymentDate = new Date();
      await fuel.save();
      
      return fuel;
    } catch (error) {
      logger.error(`Error en servicio de combustible (markAsPaid): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Marca todas las cargas no pagadas como pagadas
   * @returns {Promise<number>} - Cantidad de cargas actualizadas
   */
  async markAllUnpaidAsPaid() {
    try {
      const result = await Fuel.updateMany(
        { paymentStatus: 'no pagada' },
        { 
          $set: { 
            paymentStatus: 'pagada',
            paymentDate: new Date() 
          } 
        }
      );
      
      return result.modifiedCount;
    } catch (error) {
      logger.error(`Error en servicio de combustible (markAllUnpaidAsPaid): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene el total de montos no pagados
   * @returns {Promise<number>} - Monto total pendiente
   */
  async getTotalUnpaidAmount() {
    try {
      return await Fuel.getTotalUnpaidAmount();
    } catch (error) {
      logger.error(`Error en servicio de combustible (getTotalUnpaidAmount): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Genera un reporte según los filtros especificados
   * @param {Object} filters - Filtros para el reporte
   * @returns {Promise<Object>} - Datos del reporte y resumen
   */
  async generateReport(filters) {
    try {
      // Obtener registros según filtros
      const fuelEntries = await Fuel.generateReport(filters);
      
      // Calcular totales para el resumen
      const summary = {
        totalEntries: fuelEntries.length,
        totalLiters: 0,
        totalAmount: 0,
        countByFuelType: {
          gas: 0,
          gasolina: 0
        },
        countByPaymentStatus: {
          pagada: 0,
          'no pagada': 0
        }
      };
      
      // Calcular resumen
      fuelEntries.forEach(entry => {
        summary.totalLiters += entry.liters;
        summary.totalAmount += entry.amount;
        summary.countByFuelType[entry.fuelType]++;
        summary.countByPaymentStatus[entry.paymentStatus]++;
      });
      
      return {
        entries: fuelEntries,
        summary
      };
    } catch (error) {
      logger.error(`Error en servicio de combustible (generateReport): ${error.message}`);
      throw error;
    }
  }
}

export const fuelService = new FuelService();