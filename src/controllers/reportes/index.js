// src/controllers/reportes/index.js
import { FiltrosController } from './filtros.controller.js';
import { GeneracionController } from './generacion.controller.js';
import { AccionesController } from './acciones.controller.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador principal para reportes
 */
class ReportController {
  constructor() {
    this.filtrosController = new FiltrosController();
    this.generacionController = new GeneracionController();
    this.accionesController = new AccionesController();
    
    logger.info('ReportController: Inicializado');
  }
  
  /**
   * Inicia el flujo de generación de reportes
   */
  async startReportGeneration(ctx) {
    return await this.generacionController.startReportGeneration(ctx);
  }
  
  /**
   * Muestra las opciones de filtros disponibles
   */
  async showFilterOptions(ctx, isEdit = false) {
    return await this.filtrosController.showFilterOptions(ctx, isEdit);
  }
  
  /**
   * Maneja la selección de un filtro específico
   */
  async handleFilterSelection(ctx, filterKey) {
    return await this.filtrosController.handleFilterSelection(ctx, filterKey);
  }
  
  /**
   * Muestra opciones estáticas (ej: tipo de combustible)
   */
  async showStaticOptions(ctx, definition) {
    return await this.filtrosController.showStaticOptions(ctx, definition);
  }
  
  /**
   * Muestra opciones dinámicas (ej: operadores)
   */
  async showDynamicOptions(ctx, definition) {
    return await this.filtrosController.showDynamicOptions(ctx, definition);
  }
  
  /**
   * Muestra opciones de fecha
   */
  async showDateOptions(ctx, definition) {
    return await this.filtrosController.showDateOptions(ctx, definition);
  }
  
  /**
   * Procesa el valor seleccionado para un filtro
   */
  async processFilterValue(ctx, value) {
    return await this.filtrosController.processFilterValue(ctx, value);
  }
  
  /**
   * Cancela la selección de filtro y vuelve al menú principal
   */
  async cancelFilter(ctx) {
    return await this.filtrosController.cancelFilter(ctx);
  }
  
  /**
   * Genera el reporte con los filtros aplicados
   */
  async generateReport(ctx) {
    return await this.generacionController.generateReport(ctx);
  }
  
  /**
   * Limpia todos los filtros aplicados
   */
  async clearFilters(ctx) {
    return await this.accionesController.clearFilters(ctx);
  }
  
  /**
   * Marca todas las cargas no pagadas como pagadas
   */
  async markAllAsPaid(ctx) {
    return await this.accionesController.markAllAsPaid(ctx);
  }
}

export const reportController = new ReportController();