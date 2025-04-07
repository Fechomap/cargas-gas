// src/views/keyboards.js
// Reemplazar completamente este archivo

import { Markup } from 'telegraf';

/**
 * Obtiene el teclado principal con las opciones básicas
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🆕 Registrar unidad', 'register_unit')], // Changed icon for consistency
    [Markup.button.callback('⛽ Registrar carga', 'register_fuel_start')], // Changed label and callback
    [Markup.button.callback('💰 Consultar saldo', 'check_balance')], // Changed label
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
  // Primero, verificar si hay unidades
  if (!units || units.length === 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')],
      [Markup.button.callback('🏠 Menú principal', 'main_menu')]
    ]);
  }
  
  // Crear botones para cada unidad (máximo 10 para evitar límites de Telegram)
  const unitButtons = units.slice(0, 10).map(unit => {
    return [Markup.button.callback(
      `${unit.operatorName} - ${unit.unitNumber}`,
      unit.buttonId
    )];
  });
  
  // Añadir botones adicionales
  unitButtons.push([Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')]);
  unitButtons.push([Markup.button.callback('🏠 Menú principal', 'main_menu')]);
  
  return Markup.inlineKeyboard(unitButtons);
}

/**
 * Obtiene el teclado para selección de tipos de combustible
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getFuelTypeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Gas ⛽', 'fuel_type_gas'),
      Markup.button.callback('Gasolina 🚗', 'fuel_type_gasolina')
    ],
    [Markup.button.callback('❌ Cancelar', 'cancel_fuel_entry')]
  ]);
}

/**
 * Obtiene el teclado para selección de estatus de pago
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPaymentStatusKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Pagada', 'payment_status_pagada'),
      Markup.button.callback('❌ No pagada', 'payment_status_no_pagada')
    ],
    [Markup.button.callback('Cancelar', 'cancel_fuel_entry')]
  ]);
}

/**
 * Obtiene el teclado para confirmación final de carga
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getFuelConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Guardar carga', 'fuel_confirm_save'),
      Markup.button.callback('❌ Cancelar', 'fuel_confirm_cancel')
    ]
  ]);
}

/**
 * Obtiene el teclado para opciones de reporte
 * @param {Object} filters - Filtros aplicados
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getReportOptionsKeyboard(filters = {}) {
  const buttons = [];
  
  // Opciones de filtrado
  buttons.push([Markup.button.callback('📅 Filtrar por fechas', 'filter_by_date')]);
  buttons.push([Markup.button.callback('👤 Filtrar por operador', 'filter_by_operator')]);
  buttons.push([Markup.button.callback('⛽ Filtrar por tipo de combustible', 'filter_by_fuel_type')]);
  buttons.push([Markup.button.callback('💰 Filtrar por estatus de pago', 'filter_by_payment_status')]);
  
  // Opción de reporte global (reemplaza los botones individuales)
  buttons.push([Markup.button.callback('📊 Generar Reporte Global', 'generate_global_report')]);
  
  // Botón para limpiar filtros (si hay filtros aplicados)
  if (Object.keys(filters || {}).length > 0) {
    buttons.push([Markup.button.callback('🗑️ Limpiar filtros', 'clear_all_filters')]);
  }
  
  // Botón para cancelar
  buttons.push([Markup.button.callback('❌ Cancelar', 'cancel_report')]);
  
  return Markup.inlineKeyboard(buttons);
}

/**
 * Obtiene teclado para cancelar cualquier operación
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getCancelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancelar', 'cancel_operation')]
  ]);
}

/**
 * Obtiene el teclado para post-operación
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPostOperationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
  ]);
}
