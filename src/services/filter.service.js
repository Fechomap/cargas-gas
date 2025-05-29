// src/services/filter.service.js
import { logger } from '../utils/logger.js';
import { unitService } from './unit.service.js';

/**
 * Configuración de filtros disponibles
 */
const FILTER_DEFINITIONS = {
  date: {
    name: 'Fechas',
    icon: '📅',
    type: 'date_range',
    options: [
      { label: 'Hoy', value: 'today' },
      { label: 'Esta semana', value: 'this_week' },
      { label: 'Últimas 2 semanas', value: 'last_2_weeks' },
      { label: 'Este mes', value: 'this_month' },
      { label: 'Últimos 3 meses', value: 'last_3_months' },
      { label: 'Fechas personalizadas', value: 'custom' }
    ]
  },
  operator: {
    name: 'Operador',
    icon: '👤',
    type: 'dynamic_list',
    dataSource: 'operators'
  },
  fuelType: {
    name: 'Tipo de combustible',
    icon: '⛽',
    type: 'static_list',
    options: [
      { label: 'Gas', value: 'gas' },
      { label: 'Gasolina', value: 'gasolina' }
    ]
  },
  paymentStatus: {
    name: 'Estatus de pago',
    icon: '💰',
    type: 'static_list',
    options: [
      { label: 'Pagado', value: 'pagada' },
      { label: 'No pagado', value: 'no pagada' }
    ]
  }
};

/**
 * Servicio unificado para manejo de filtros
 */
class FilterService {
  constructor() {
    this.definitions = FILTER_DEFINITIONS;
    logger.info('FilterService inicializado correctamente');
    logger.info(`Filtros disponibles: ${Object.keys(this.definitions).join(', ')}`);
  }

  /**
   * Obtiene la configuración de un filtro
   */
  getFilterDefinition(filterKey) {
    logger.info(`Obteniendo definición para filtro: ${filterKey}`);
    const definition = this.definitions[filterKey];
    logger.info(`Definición encontrada: ${definition ? 'sí' : 'no'}`);
    return definition;
  }

  /**
   * Obtiene todos los filtros disponibles
   */
  getAvailableFilters() {
    try {
      logger.info('Obteniendo todos los filtros disponibles');
      const keys = Object.keys(this.definitions);
      logger.info(`Claves de filtros: ${keys.join(', ')}`);
      
      const filters = keys.map(key => {
        const filter = {
          key,
          ...this.definitions[key]
        };
        logger.info(`Filtro ${key}: ${JSON.stringify(filter)}`);
        return filter;
      });
      
      logger.info(`Total filtros disponibles: ${filters.length}`);
      return filters;
    } catch (error) {
      logger.error(`Error al obtener filtros disponibles: ${error.message}`);
      return [];
    }
  }

  /**
   * Procesa un valor de filtro según su tipo
   */
  async processFilterValue(filterKey, value) {
    const definition = this.getFilterDefinition(filterKey);
    
    switch (definition.type) {
      case 'date_range':
        return this.processDateRange(value);
      case 'dynamic_list':
        return this.processDynamicList(definition.dataSource, value);
      case 'static_list':
        return value;
      default:
        return value;
    }
  }

  /**
   * Procesa rangos de fecha predefinidos
   */
  processDateRange(rangeType) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (rangeType) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        const dayOfWeek = startDate.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_2_weeks':
        startDate.setDate(startDate.getDate() - 14);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'this_month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_3_months':
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }

    return { startDate, endDate };
  }

  /**
   * Obtiene datos dinámicos para listas
   */
  async processDynamicList(dataSource, value) {
    switch (dataSource) {
      case 'operators':
        if (value === 'get_options') {
          const units = await unitService.getAllActiveUnits();
          const operators = [...new Set(units.map(unit => unit.operatorName))];
          return operators.map(op => ({ label: op, value: op }));
        }
        return value;
      default:
        return value;
    }
  }

  /**
   * Valida que un filtro sea válido
   */
  validateFilter(filterKey, value) {
    const definition = this.getFilterDefinition(filterKey);
    if (!definition) {
      throw new Error(`Filtro desconocido: ${filterKey}`);
    }

    // Aquí puedes agregar más validaciones específicas
    return true;
  }

  /**
   * Convierte filtros aplicados a texto descriptivo
   */
  filtersToText(filters) {
    const descriptions = [];

    for (const [key, value] of Object.entries(filters)) {
      const definition = this.getFilterDefinition(key);
      if (!definition) continue;

      if (key === 'startDate' && filters.endDate) {
        descriptions.push(`📅 Fechas: ${this.formatDate(value)} - ${this.formatDate(filters.endDate)}`);
        delete filters.endDate; // Evitar duplicado
      } else if (key !== 'endDate') {
        descriptions.push(`${definition.icon} ${definition.name}: ${value}`);
      }
    }

    return descriptions;
  }

  /**
   * Formatea una fecha para mostrar
   */
  formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Mapea los nombres de filtros del sistema unificado a los nombres esperados por el modelo
   */
  mapFiltersForDatabase(filters) {
    const mappedFilters = {};
    
    // Mapeo de nombres de campos
    const fieldMapping = {
      'operator': 'operatorName',        // operator → operatorName
      'fuelType': 'fuelType',           // fuelType → fuelType (sin cambio)
      'paymentStatus': 'paymentStatus', // paymentStatus → paymentStatus (sin cambio)
      'startDate': 'startDate',         // startDate → startDate (sin cambio)
      'endDate': 'endDate'              // endDate → endDate (sin cambio)
    };
    
    // Aplicar mapeo
    for (const [filterKey, filterValue] of Object.entries(filters)) {
      const mappedKey = fieldMapping[filterKey] || filterKey;
      mappedFilters[mappedKey] = filterValue;
      
      logger.info(`Mapeo de filtro: ${filterKey} → ${mappedKey} = ${filterValue}`);
    }
    
    logger.info(`Filtros mapeados: ${JSON.stringify(mappedFilters)}`);
    return mappedFilters;
  }
}

export const filterService = new FilterService();