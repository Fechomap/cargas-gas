// src/views/keyboards.js
import { Markup } from 'telegraf';

/**
 * Obtiene el teclado principal con las opciones básicas
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
    [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
    [Markup.button.callback('📊 Generar reporte', 'generate_report')],
    [Markup.button.callback('❓ Ayuda', 'show_help')]
  ]);
}

/**
 * Genera un teclado con las unidades registradas
 * @param {Array} units - Lista de unidades registradas
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getUnitsKeyboard(units) {
  const buttons = units.map(unit => {
    return [Markup.button.callback(
      `${unit.operatorName} - ${unit.unitNumber}`,
      unit.buttonId
    )];
  });
  
  // Añadir botones adicionales
  buttons.push([Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')]);
  buttons.push([Markup.button.callback('🏠 Menú principal', 'main_menu')]);
  
  return Markup.inlineKeyboard(buttons);
}

/**
 * Obtiene el teclado para la confirmación de pago
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPaymentConfirmationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Sí, marcar como pagadas', 'confirm_payment'),
      Markup.button.callback('❌ No', 'cancel_payment')
    ]
  ]);
}

/**
 * Obtiene el teclado para selección de tipos de combustible
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getFuelTypeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Gas', 'fuel_type_gas'),
      Markup.button.callback('Gasolina', 'fuel_type_gasolina')
    ]
  ]);
}

/**
 * Obtiene el teclado para selección de estatus de pago
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPaymentStatusKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Pagada', 'payment_status_pagada'),
      Markup.button.callback('No pagada', 'payment_status_no_pagada')
    ]
  ]);
}

/**
 * Obtiene el teclado para confirmar o cancelar una acción
 * @param {string} confirmAction - Acción a realizar al confirmar
 * @param {string} cancelAction - Acción a realizar al cancelar
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getConfirmationKeyboard(confirmAction, cancelAction) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirmar', confirmAction),
      Markup.button.callback('❌ Cancelar', cancelAction)
    ]
  ]);
}

/**
 * Obtiene el teclado para opciones después de una acción
 * @param {string} repeatAction - Acción para repetir el proceso
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPostActionKeyboard(repeatAction) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Realizar otra acción similar', repeatAction)],
    [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
  ]);
}