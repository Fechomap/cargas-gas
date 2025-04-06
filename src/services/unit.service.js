// src/services/unit.service.js
import { Unit } from '../models/unit.model.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar la lógica de negocio relacionada con unidades
 */
class UnitService {
  /**
   * Crea una nueva unidad en la base de datos
   * @param {Object} unitData - Datos de la unidad
   * @returns {Promise<Object>} - Unidad creada
   */
  async createUnit(unitData) {
    try {
      // Generar el ID de botón para esta unidad
      const buttonId = Unit.generateButtonId(unitData.operatorName, unitData.unitNumber);
      
      // Verificar si ya existe una unidad con esos datos
      const existingUnit = await Unit.findOne({ buttonId });
      
      if (existingUnit) {
        if (!existingUnit.isActive) {
          // Si existe pero está inactiva, reactivarla
          existingUnit.isActive = true;
          await existingUnit.save();
          return existingUnit;
        }
        
        throw new Error(`La unidad ${unitData.operatorName} - ${unitData.unitNumber} ya existe`);
      }
      
      // Crear nueva unidad
      const newUnit = new Unit({
        operatorName: unitData.operatorName,
        unitNumber: unitData.unitNumber,
        buttonId,
        isActive: true
      });
      
      await newUnit.save();
      return newUnit;
    } catch (error) {
      logger.error(`Error en servicio de unidades (createUnit): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene todas las unidades activas
   * @returns {Promise<Array>} - Lista de unidades activas
   */
  async getAllActiveUnits() {
    try {
      return await Unit.find({ isActive: true }).sort({ operatorName: 1, unitNumber: 1 });
    } catch (error) {
      logger.error(`Error en servicio de unidades (getAllActiveUnits): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Obtiene una unidad por su ID de botón
   * @param {string} buttonId - ID del botón de la unidad
   * @returns {Promise<Object>} - Unidad encontrada
   */
  async getUnitByButtonId(buttonId) {
    try {
      const unit = await Unit.findOne({ buttonId, isActive: true });
      
      if (!unit) {
        throw new Error(`Unidad con buttonId ${buttonId} no encontrada`);
      }
      
      return unit;
    } catch (error) {
      logger.error(`Error en servicio de unidades (getUnitByButtonId): ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Desactiva una unidad (borrado lógico)
   * @param {string} unitId - ID de la unidad a desactivar
   * @returns {Promise<Object>} - Unidad desactivada
   */
  async deactivateUnit(unitId) {
    try {
      const unit = await Unit.findById(unitId);
      
      if (!unit) {
        throw new Error(`Unidad con ID ${unitId} no encontrada`);
      }
      
      unit.isActive = false;
      await unit.save();
      
      return unit;
    } catch (error) {
      logger.error(`Error en servicio de unidades (deactivateUnit): ${error.message}`);
      throw error;
    }
  }
}

export const unitService = new UnitService();