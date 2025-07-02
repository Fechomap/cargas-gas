// src/controllers/fuel/index.js
import { RegistroController } from './registro.controller.js';
import { FechaController } from './fecha.controller.js';
import { PagosController } from './pagos.controller.js';
import { SaldoController } from './saldo.controller.js';
import { DesactivacionController } from './desactivacion.controller.js';
import { logger } from '../../utils/logger.js';

/**
 * Controlador principal para gestionar cargas de combustible
 */
class FuelController {
  constructor() {
    this.registroController = new RegistroController();
    this.fechaController = new FechaController();
    this.pagosController = new PagosController();
    this.saldoController = new SaldoController();
    this.desactivacionController = new DesactivacionController();

    logger.info('FuelController: Inicializado');
  }

  /**
   * Inicia el flujo de captura de carga de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} unitButtonId - ID del botón de la unidad
   */
  async startFuelEntry(ctx, unitButtonId) {
    return await this.registroController.startFuelEntry(ctx, unitButtonId);
  }

  /**
   * Maneja la entrada de kilómetros en el flujo de captura (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleKilometersEntry(ctx) {
    return await this.registroController.handleKilometersEntry(ctx);
  }

  /**
   * Maneja la entrada de litros en el flujo de captura
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleLitersEntry(ctx) {
    return await this.registroController.handleLitersEntry(ctx);
  }

  /**
   * Maneja la entrada del precio por litro en el flujo de captura (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handlePricePerLiterEntry(ctx) {
    return await this.registroController.handlePricePerLiterEntry(ctx);
  }

  /**
   * Maneja la confirmación del monto calculado (NUEVO)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {boolean} confirmed - Si el usuario confirmó el monto
   */
  async handleAmountConfirmation(ctx, confirmed) {
    return await this.registroController.handleAmountConfirmation(ctx, confirmed);
  }

  /**
   * Maneja la entrada del monto en el flujo de captura (OBSOLETO - mantenido para compatibilidad)
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleAmountEntry(ctx) {
    return await this.registroController.handleAmountEntry(ctx);
  }

  /**
   * Procesa la selección del tipo de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} fuelType - Tipo de combustible seleccionado
   */
  async handleFuelTypeSelection(ctx, fuelType) {
    return await this.registroController.handleFuelTypeSelection(ctx, fuelType);
  }

  /**
   * Procesa la foto del ticket o su omisión
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleTicketPhoto(ctx) {
    return await this.registroController.handleTicketPhoto(ctx);
  }

  /**
   * Procesa la entrada del número de venta
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleSaleNumberEntry(ctx) {
    return await this.registroController.handleSaleNumberEntry(ctx);
  }

  /**
   * Procesa la selección del estatus de pago
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {string} paymentStatus - Estatus de pago seleccionado
   */
  async handlePaymentStatusSelection(ctx, paymentStatus) {
    return await this.registroController.handlePaymentStatusSelection(ctx, paymentStatus);
  }

  /**
   * Guarda la carga de combustible en la base de datos
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async saveFuelEntry(ctx) {
    return await this.registroController.saveFuelEntry(ctx);
  }

  /**
   * Verifica si la fecha de registro debe ser ajustada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} savedFuel - Registro de combustible guardado
   */
  async checkRecordDate(ctx, savedFuel) {
    return await this.fechaController.checkRecordDate(ctx, savedFuel);
  }

  /**
   * Muestra opciones para seleccionar una fecha reciente
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showDateOptions(ctx) {
    return await this.fechaController.showDateOptions(ctx);
  }

  /**
   * Ajusta la fecha de registro según los días seleccionados
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {number} daysAgo - Días hacia atrás desde hoy
   */
  async updateRecordDate(ctx, daysAgo) {
    return await this.fechaController.updateRecordDate(ctx, daysAgo);
  }

  /**
   * Solicita al usuario ingresar una fecha manual
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async requestCustomDate(ctx) {
    return await this.fechaController.requestCustomDate(ctx);
  }

  /**
   * Procesa la entrada de fecha manual del usuario
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateInput(ctx) {
    return await this.fechaController.handleCustomDateInput(ctx);
  }

  /**
   * Finaliza el proceso de registro después de la verificación de fecha
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async completeFuelRegistration(ctx) {
    return await this.registroController.completeFuelRegistration(ctx);
  }

  /**
   * Obtiene el saldo total pendiente (cargas no pagadas)
   * @param {TelegrafContext} ctx - Contexto de Telegraf (opcional)
   * @returns {Promise<number>} - Monto total pendiente
   */
  async getTotalPendingBalance(ctx = null) {
    return await this.saldoController.getTotalPendingBalance(ctx);
  }

  /**
   * Marca una carga como pagada
   * @param {string} fuelId - ID de la carga a marcar
   * @returns {Promise<Object>} - Carga actualizada
   */
  async markFuelAsPaid(fuelId) {
    return await this.pagosController.markFuelAsPaid(fuelId);
  }

  /**
   * Marca todas las cargas no pagadas como pagadas
   * @returns {Promise<number>} - Cantidad de cargas actualizadas
   */
  async markAllUnpaidAsPaid() {
    return await this.pagosController.markAllUnpaidAsPaid();
  }

  /**
   * Inicia el flujo de búsqueda de nota por número de venta
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async startNoteSearch(ctx) {
    return await this.pagosController.startNoteSearch(ctx);
  }

  /**
   * Procesa la entrada del número de venta para búsqueda
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleNoteSearchInput(ctx) {
    return await this.pagosController.handleNoteSearchInput(ctx);
  }

  /**
   * Marca la nota seleccionada como pagada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleMarkAsPaid(ctx) {
    return await this.pagosController.handleMarkAsPaid(ctx);
  }

  /**
   * Cancela la operación de búsqueda de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async cancelNoteSearch(ctx) {
    return await this.pagosController.cancelNoteSearch(ctx);
  }

  /**
   * Alias para handleMarkAsPaid - mantiene compatibilidad con nombre anterior
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async markAsPaid(ctx) {
    return await this.handleMarkAsPaid(ctx);
  }

  /**
   * Muestra el formulario para buscar registros por número de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showSearchForm(ctx) {
    return await this.desactivacionController.showSearchForm(ctx);
  }

  /**
   * Busca registros por número de nota
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async searchRecords(ctx) {
    return await this.desactivacionController.searchRecords(ctx);
  }

  /**
   * Muestra confirmación antes de desactivar, con resumen detallado y advertencia
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {String} fuelId - ID del registro de combustible
   */
  async showDeactivationConfirmation(ctx, fuelId) {
    return await this.desactivacionController.showDeactivationConfirmation(ctx, fuelId);
  }

  /**
   * Desactiva un registro de combustible
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Boolean} isConfirmed - Indica si ya fue confirmado por el usuario
   */
  async deactivateFuel(ctx, isConfirmed = false) {
    return await this.desactivacionController.deactivateFuel(ctx, isConfirmed);
  }
}

// Exportar instancia del controlador
export const fuelController = new FuelController();
